import {intakeConnectionOptions,INTAKE_TARGET} from './intake-runtime.mjs';
/** Explicit post-provisioning acceptance check; no automatic invocation or writes.
 * Two connections from private intake configuration, both transactions rolled back.
 * Success establishes row-lock contention only, not candidate retry/import behavior.
 */
export async function checkIntakeStoreLock(config,{createPool,confirmTarget}){
 if(confirmTarget!==`${INTAKE_TARGET.projectRef}/${INTAKE_TARGET.storeId}`)throw Error('Explicit staging lock-check target confirmation required');
 const options=intakeConnectionOptions(config);
 const pools=[],clients=[];
 let passed=false,cleanupFailed=false;
 const begin=async client=>{
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE night_scout_intake_service');
  const {rows}=await client.query('SELECT current_user AS role,session_user AS login');
  if(rows.length!==1||rows[0].role!=='night_scout_intake_service'||rows[0].login!=='night_scout_intake_login')throw Error('Unexpected lock-check role');
 };
 try{
  for(let i=0;i<2;i++){const pool=createPool({...options.pool,max:1});pools.push(pool);clients.push(await pool.connect());}
  const [first,second]=clients;
  await begin(first);await first.query("SET LOCAL lock_timeout='5s'");
  await first.query('SELECT ingest_v1.lock_intake_store($1)',[INTAKE_TARGET.storeId]);
  await begin(second);await second.query("SET LOCAL lock_timeout='250ms'");
  let blocked=false;
  try{await second.query('SELECT ingest_v1.lock_intake_store($1)',[INTAKE_TARGET.storeId]);}
  catch(error){if(error?.code!=='55P03')throw error;blocked=true;}
  if(!blocked)throw Error('Second connection did not contend on store lock');
  await second.query('ROLLBACK');await first.query('ROLLBACK');
  await begin(second);await second.query("SET LOCAL lock_timeout='5s'");
  await second.query('SELECT ingest_v1.lock_intake_store($1)',[INTAKE_TARGET.storeId]);
  await second.query('ROLLBACK');passed=true;
 }catch{
  // Do not expose connection strings, server details or private errors.
  throw Error('Staging intake lock check failed; no acceptance recorded');
 }finally{
  for(const client of clients){let discard=false;try{await client.query('ROLLBACK');}catch{discard=true;cleanupFailed=true;}try{client.release(discard);}catch{cleanupFailed=true;}}
  for(const pool of pools)try{await pool.end();}catch{cleanupFailed=true;}
 }
 if(!passed||cleanupFailed)throw Error('Staging intake lock check cleanup unconfirmed');
 return {status:'lock_contention_verified',storeId:INTAKE_TARGET.storeId,persistedRows:false,candidateReplayVerified:false};
}
