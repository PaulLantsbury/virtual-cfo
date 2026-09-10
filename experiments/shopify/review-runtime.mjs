import {createReviewerService} from './reviewer-auth.mjs';
const check=(ok)=>{if(!ok)throw new Error('Review server configuration is invalid');};
/** Explicit server-only configuration. Direct Supabase connections only for now.
 * Never reads generic DATABASE_URL, browser inputs or process environment itself.
 */
export function reviewConnectionOptions(config){
 try{
  const {projectRef,authUrl,publishableKey,databaseUrl}=config;
  check(typeof projectRef==='string'&&/^[a-z]{20}$/.test(projectRef));
  const auth=new URL(authUrl),db=new URL(databaseUrl);
  check(auth.href===`https://${projectRef}.supabase.co/`);
  check(['postgres:','postgresql:'].includes(db.protocol)&&db.hostname===`db.${projectRef}.supabase.co`&&(!db.port||db.port==='5432')&&db.pathname==='/postgres'&&!db.search&&!db.hash);
  check(decodeURIComponent(db.username)==='night_scout_review_login'&&db.password.length>0);
  check(typeof publishableKey==='string'&&publishableKey.length>0);
  if(!publishableKey.startsWith('sb_publishable_')){
   const parts=publishableKey.split('.');check(parts.length===3);
   check(JSON.parse(Buffer.from(parts[1],'base64url').toString()).role==='anon');
  }
  return {authUrl:auth.origin,publishableKey,pool:{host:db.hostname,port:5432,database:'postgres',user:decodeURIComponent(db.username),password:decodeURIComponent(db.password),ssl:{rejectUnauthorized:true},max:3,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:15000}};
 }catch{throw new Error('Review server configuration is invalid');}
}
/** Fetch wrapper supplied to the Auth SDK. Bounds the full body read as well as headers. */
export function boundedAuthFetch(authUrl,fetchImpl=fetch,{timeoutMs=5000}={}){
 return async(input,init={})=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
   check(url.origin===authUrl&&url.pathname==='/auth/v1/user'&&!url.search&&!url.hash);
   const requestSignal=init.signal??(input instanceof Request?input.signal:undefined);
   const signal=requestSignal?AbortSignal.any([controller.signal,requestSignal]):controller.signal;
   const response=await fetchImpl(input,{...init,signal,redirect:'error'});
   const reader=response.body?.getReader(),chunks=[];let size=0;
   if(reader)try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){controller.abort();await reader.cancel();throw new Error('Auth response too large');}chunks.push(value);}
   }finally{reader.releaseLock();}
   const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
   return new Response(size?body:null,{status:response.status,statusText:response.statusText,headers:response.headers});
  }finally{clearTimeout(timer);}
 };
}
/** Pool is dedicated to this service. Never share it with general app queries. */
export function reviewDatabase(pool){
 return {transaction:async fn=>{
  const client=await pool.connect();let destroy=false,committing=false;
  try{
   await client.query('BEGIN');
   await client.query('SET LOCAL ROLE night_scout_review_service');
   const result=await fn({query:(...args)=>client.query(...args),exec:sql=>client.query(sql)});
   committing=true;await client.query('COMMIT');return result;
  }catch(error){
   destroy=committing;
   try{await client.query('ROLLBACK');}catch{destroy=true;}
   // An uncertain commit is never retried here.
   throw error;
  }finally{client.release(destroy);}
 }};
}
/** Factories are trusted server dependencies (pg Pool and Supabase createClient).
 * No application route is enabled by this function alone.
 */
export async function initialiseReviewRuntime(config,{createPool,createAuthClient,fetchImpl=fetch}){
 const options=reviewConnectionOptions(config);
 let pool;
 try{
  pool=createPool(options.pool);const database=reviewDatabase(pool);
  await database.transaction(async tx=>{
   const {rows}=await tx.query(`SELECT current_user AS role,
    (SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit FROM pg_roles WHERE rolname=session_user) AS unsafe_login,
    has_any_column_privilege(current_user,'public.orders','INSERT,UPDATE') OR
    has_any_column_privilege(current_user,'public.refunds','INSERT,UPDATE') OR
    has_table_privilege(current_user,'public.orders','INSERT,UPDATE,DELETE,TRUNCATE') OR
    has_table_privilege(current_user,'public.refunds','INSERT,UPDATE,DELETE,TRUNCATE') OR
    has_table_privilege(current_user,'ingest_v1.review_authorizations','INSERT,UPDATE,DELETE,TRUNCATE') OR
    has_table_privilege(current_user,'ingest_v1.review_audit','UPDATE,DELETE,TRUNCATE') AS unsafe_writes,
    to_regprocedure('ingest_v1.lock_review_dependencies()') IS NOT NULL AS lock_ready`);
   const r=rows[0];
   if(rows.length!==1||r.role!=='night_scout_review_service'||r.unsafe_login!==false||r.unsafe_writes!==false||r.lock_ready!==true)throw new Error('Review service permissions are not ready');
   await tx.query('SELECT batch_id FROM ingest_v1.heads LIMIT 0');
   await tx.query('SELECT reviewer_id FROM ingest_v1.review_authorizations LIMIT 0');
  });
  const supabase=createAuthClient(options.authUrl,options.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedAuthFetch(options.authUrl,fetchImpl)}});
  return {service:createReviewerService(database,supabase),close:()=>pool.end()};
 }catch{
  try{await pool?.end();}catch{}
  throw new Error('Review server could not be initialised');
 }
}
