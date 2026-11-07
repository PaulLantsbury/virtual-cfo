import {importSubsequentEvidence} from './import-subsequent-evidence.mjs';
import {importFirstEvidence} from './import-first-evidence.mjs';
const valid=(ok)=>{if(!ok)throw new Error('Importer configuration is invalid');};
/** Staging-only, operator-configured one-batch runner. No HTTP or environment reads. */
export function importConnectionOptions(config){
 try{
 const {projectRef,databaseUrl,scope}=config;
 valid(projectRef==='bioalckltvkhlczusdvl');
 const url=new URL(databaseUrl),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 valid(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname===`db.${projectRef}.supabase.co`&&(!url.port||url.port==='5432')&&url.pathname==='/postgres'&&!url.search&&!url.hash&&decodeURIComponent(url.username)==='night_scout_import_login'&&url.password.length>0);
 const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 valid(scope&&uuid.test(scope.storeId)&&uuid.test(scope.batchId)&&day(scope.from)&&day(scope.to)&&scope.from<=scope.to);
 return {scope:Object.freeze({storeId:scope.storeId,batchId:scope.batchId,from:scope.from,to:scope.to}),pool:{host:url.hostname,port:5432,database:'postgres',user:'night_scout_import_login',password:decodeURIComponent(url.password),ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:15000}};
 }catch{throw new Error('Importer configuration is invalid');}
}
export function importDatabase(pool){return {transaction:async fn=>{
 const client=await pool.connect();let discard=false,committing=false;
 try{await client.query('BEGIN');await client.query('SET LOCAL ROLE night_scout_import_service');const result=await fn({query:(...a)=>client.query(...a)});committing=true;await client.query('COMMIT');return result;}
 catch(e){discard=committing;try{await client.query('ROLLBACK');}catch{discard=true;}throw e;}
 finally{client.release(discard);}
}};}
export const initialiseImportRuntime=(config,deps)=>initialiseRuntime(config,deps,importFirstEvidence);
export const initialiseSubsequentImportRuntime=(config,deps)=>initialiseRuntime(config,deps,importSubsequentEvidence);
async function initialiseRuntime(config,{createPool},writer){
 const options=importConnectionOptions(config);let pool;
 try{
 pool=createPool(options.pool);const db=importDatabase(pool);
 await db.transaction(async tx=>{
 const {rows}=await tx.query(`SELECT current_user AS role,
 (SELECT rolname='night_scout_import_login' AND rolcanlogin AND NOT (rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) FROM pg_roles WHERE rolname=session_user) AS safe_login,
 has_table_privilege(current_user,'public.orders','UPDATE,DELETE,TRUNCATE') OR has_table_privilege(current_user,'public.refunds','UPDATE,DELETE,TRUNCATE') OR has_table_privilege(current_user,'ingest_v1.import_receipts','UPDATE,DELETE,TRUNCATE') OR has_table_privilege(current_user,'ingest_v1.review_authorizations','INSERT,UPDATE,DELETE,TRUNCATE') OR has_table_privilege(current_user,'ingest_v1.review_audit','INSERT,UPDATE,DELETE,TRUNCATE') AS unsafe_writes,
 to_regprocedure('ingest_v1.lock_import_dependencies()') IS NOT NULL AS lock_ready`);
 const r=rows[0];valid(rows.length===1&&r.role==='night_scout_import_service'&&r.safe_login===true&&r.unsafe_writes===false&&r.lock_ready===true);
 await tx.query('SELECT batch_id FROM ingest_v1.import_receipts LIMIT 0');
 });
 return {run:async()=>{try{return await writer(db,options.scope);}catch{throw new Error('Import outcome could not be confirmed; inspect receipt before retrying');}},close:()=>pool.end()};
 }catch{try{await pool?.end();}catch{}throw new Error('Importer could not be initialised');}
}
