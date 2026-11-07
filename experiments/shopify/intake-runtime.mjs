import {createConnectionReadiness} from './connection-readiness.mjs';
export const INTAKE_TARGET=Object.freeze({projectRef:'bioalckltvkhlczusdvl',storeId:'56d92f8a-746e-4b4f-b408-81fc98c4aa17',shopId:'gid://shopify/Shop/95601983836',domain:'pocketlaunchpad1.myshopify.com',currency:'GBP',timezone:'Europe/London'});
const valid=ok=>{if(!ok)throw Error('Intake configuration is invalid');};
/** Private operator capability only: no environment reads, endpoint or financial approval. */
export function intakeConnectionOptions(config){
 try{
 const {projectRef,databaseUrl,scope}=config;
 valid(projectRef===INTAKE_TARGET.projectRef);
 const url=new URL(databaseUrl),user=decodeURIComponent(url.username);
 // Only the dashboard-verified staging SESSION pooler is allowed (never transaction port 6543).
 const direct=url.hostname===`db.${projectRef}.supabase.co`&&user==='night_scout_intake_login';
 const session=url.hostname==='aws-1-eu-west-1.pooler.supabase.com'&&user===`night_scout_intake_login.${projectRef}`;
 valid(['postgres:','postgresql:'].includes(url.protocol)&&(direct||session)&&(!url.port||url.port==='5432')&&url.pathname==='/postgres'&&!url.search&&!url.hash&&url.password.length>0);
 const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 valid(scope?.storeId===INTAKE_TARGET.storeId&&scope.shopId===INTAKE_TARGET.shopId&&day(scope.from)&&day(scope.to)&&scope.from<=scope.to);
 return {scope:Object.freeze({storeId:scope.storeId,shopId:scope.shopId,from:scope.from,to:scope.to}),pool:{host:url.hostname,port:5432,database:'postgres',user,password:decodeURIComponent(url.password),ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:15000}};
 }catch{throw Error('Intake configuration is invalid');}
}
export function intakeDatabase(pool){return {
 async lockCandidateStore(tx,storeId){valid(storeId===INTAKE_TARGET.storeId);await tx.query('SELECT ingest_v1.lock_intake_store($1)',[storeId]);},
 async transaction(fn){
 const client=await pool.connect();let discard=false,committing=false;
 try{await client.query('BEGIN');await client.query('SET LOCAL ROLE night_scout_intake_service');const result=await fn({query:(...a)=>client.query(...a)});committing=true;await client.query('COMMIT');return result;}
 catch(e){discard=committing;try{await client.query('ROLLBACK');}catch{discard=true;}throw e;}
 finally{client.release(discard);}
 }
};}
/** Initialisation checks are read-only. run requires explicit target acknowledgement.
 * Unknown outcomes never trigger automatic retries or imply an absent write.
 * Caller supplies approved private credential provider and a pg-compatible Pool.
 */
export async function initialiseIntakeRuntime(config,{createPool,resolveCredential,fetchImpl=globalThis.fetch,sleep}){
 const options=intakeConnectionOptions(config);let pool;
 try{
 valid(typeof createPool==='function'&&typeof resolveCredential==='function');
 pool=createPool(options.pool);const db=intakeDatabase(pool);
 await db.transaction(async tx=>{
 const {rows}=await tx.query(`SELECT current_user AS role,
 (SELECT rolname='night_scout_intake_login' AND rolcanlogin AND NOT (rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) FROM pg_roles WHERE rolname=session_user) AS safe_login,
 (SELECT NOT (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) FROM pg_roles WHERE rolname=current_user) AS safe_role,
 EXISTS(SELECT 1 FROM unnest(ARRAY['public.orders','public.refunds','public.stores','public.store_memberships','ingest_v1.review_authorizations','ingest_v1.review_audit','ingest_v1.import_receipts']) AS t(name) WHERE has_table_privilege(current_user,t.name,'INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege(current_user,t.name,'INSERT,UPDATE')) OR
 EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='finance_v1' AND c.relkind IN ('r','p') AND c.relname<>'coverage_evidence' AND (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE'))) AS unsafe_writes,
 EXISTS(SELECT 1 FROM pg_roles WHERE rolname NOT IN ('night_scout_intake_login','night_scout_intake_service') AND pg_has_role(session_user,oid,'MEMBER')) AS unsafe_membership,
 to_regprocedure('ingest_v1.lock_intake_store(uuid)') IS NOT NULL AS lock_ready`);
 const r=rows[0];valid(rows.length===1&&r.role==='night_scout_intake_service'&&r.safe_login===true&&r.safe_role===true&&r.unsafe_writes===false&&r.unsafe_membership===false&&r.lock_ready===true);
 const store=(await tx.query('SELECT id,shopify_domain,shopify_store_id,currency_code,timezone FROM public.stores WHERE id=$1',[INTAKE_TARGET.storeId])).rows;
 valid(store.length===1&&store[0].shopify_domain===INTAKE_TARGET.domain&&store[0].shopify_store_id==='95601983836'&&store[0].currency_code.trim()===INTAKE_TARGET.currency&&store[0].timezone===INTAKE_TARGET.timezone);
 });
 const connection=createConnectionReadiness({connection:INTAKE_TARGET,scope:options.scope,db,resolveCredential,fetchImpl,sleep});let closed=false;
 return {async run({confirmTarget,signal,maxPages=100}={}){
 if(closed)throw Error('Intake runtime is closed');
 if(confirmTarget!==`${INTAKE_TARGET.projectRef}/${INTAKE_TARGET.storeId}`)throw Error('Explicit staging intake target confirmation required');
 try{
 const result=await connection.run({signal,maxPages});
 // Deliberate allowlist: never return retained payloads or credentials.
 return {status:result.status,...(result.batchId?{batchId:result.batchId}:{}),...(result.mappingState?{mappingState:result.mappingState}:{}),storeId:options.scope.storeId,from:options.scope.from,to:options.scope.to,coverageCertified:false,reviewRequired:true,financeImported:false};
 }catch{throw Error('Intake outcome unconfirmed; inspect candidate state before retrying');}
 },async close(){closed=true;await pool.end();}};
 }catch{try{await pool?.end();}catch{}throw Error('Intake could not be initialised');}
}
