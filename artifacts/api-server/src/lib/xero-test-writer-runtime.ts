import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {createXeroWriterBootstrap} from '../../../../experiments/test-programme/xero-writer-bootstrap.mjs';
import {validWriterDatabaseIdentity} from '../../../../experiments/test-programme/writer-database-identity.mjs';
const PROJECT='bioalckltvkhlczusdvl';
const REDIRECT='https://night-scout-xero-staging.onrender.com/api/xero/test-writer/callback';
const unavailable=()=>Error('Xero writer setup unavailable');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type XeroTestWriterRuntime=Readonly<{service:{start(authorization:string):Promise<unknown>;complete(input:{state:string;code:string}):Promise<unknown>};close():Promise<void>}>;
/** Separate write-consent capability: never borrows reader credentials or database privileges. */
export function createXeroTestWriterRuntime(env:NodeJS.ProcessEnv,deps:{createPool?:(config:pg.PoolConfig)=>pg.Pool;createAuthClient?:typeof createClient;fetchImpl?:typeof fetch}={}):XeroTestWriterRuntime|undefined {
 if(env.NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED!=='true')return undefined;
 const authUrl=env.NIGHT_SCOUT_REVIEW_AUTH_URL,key=env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY;
 const ownerId=env.NIGHT_SCOUT_XERO_STAGING_OWNER_ID,storeId=env.NIGHT_SCOUT_XERO_STAGING_STORE_ID;
 const clientId=env.NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID,clientSecret=env.NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_SECRET;
 const expectedTenant=env.NIGHT_SCOUT_XERO_TEST_WRITER_EXPECTED_TENANT_ID;
 const masterKey=env.NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY,keyVersion=env.NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION;
 if(env.NIGHT_SCOUT_RUNTIME_ENV!=='staging'||env.NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF!==PROJECT||authUrl!==`https://${PROJECT}.supabase.co`||typeof key!=='string'||key.length<20||!uuid.test(ownerId??'')||!uuid.test(storeId??'')||!uuid.test(clientId??'')||typeof clientSecret!=='string'||clientSecret.length<24||clientSecret.length>2048||env.NIGHT_SCOUT_XERO_TEST_WRITER_REDIRECT_URI!==REDIRECT||expectedTenant!==undefined&&!uuid.test(expectedTenant)||typeof masterKey!=='string'||Buffer.byteLength(masterKey)<32||!keyVersion||!/^[A-Za-z0-9._-]{1,128}$/.test(keyVersion))throw unavailable();
 if(clientId===env.NIGHT_SCOUT_XERO_CLIENT_ID||masterKey===env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY)throw unavailable();
 let url:URL;try{url=new URL(env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL!);}catch{throw unavailable();}
 if(url.protocol!=='postgresql:'||url.hostname!=='aws-1-eu-west-1.pooler.supabase.com'||url.port!=='5432'||url.pathname!=='/postgres'||decodeURIComponent(url.username)!==`night_scout_test_writer.${PROJECT}`||!url.password||url.search||url.hash)throw unavailable();
 const fetchImpl=deps.fetchImpl??fetch;
 const boundedFetch:typeof fetch=(input,init)=>fetchImpl(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(10_000)]):AbortSignal.timeout(10_000)});
 const auth=(deps.createAuthClient??createClient)(authUrl!,key!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch}});
 const pool=(deps.createPool??(config=>new pg.Pool(config)))({connectionString:url.toString(),ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,query_timeout:10_000});
 pool.on('error',()=>{});
 const scopedPool={query:async(sql:string,args:unknown[])=>{
  const client=await pool.connect();
  try{
   await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='5s'");
   const roles=(await client.query("SELECT rolname,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolcanlogin,rolconnlimit,session_user::text AS session_login FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service')")).rows;
   const memberships=(await client.query("SELECT r.rolname AS role_name,u.rolname AS member_name,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname IN ('night_scout_test_writer','night_scout_test_writer_service')")).rows;
   if(!validWriterDatabaseIdentity(roles,memberships))throw unavailable();
   await client.query('SET LOCAL ROLE night_scout_test_writer_service');
   const result=await client.query(sql,args);await client.query('COMMIT');return result;
  }catch{await client.query('ROLLBACK').catch(()=>{});throw unavailable();}finally{client.release();}
 }};
 const service=createXeroWriterBootstrap({enabled:true,projectRef:PROJECT,ownerId,storeId,expectedTenant,clientId,clientSecret,redirectUri:REDIRECT,masterKey,keyVersion,pool:scopedPool,fetchImpl,
  authenticate:async(authorization:string)=>{const {data,error}=await auth.auth.getUser(authorization.replace(/^Bearer\s+/i,''));if(error||data?.user?.id!==ownerId)throw unavailable();return Object.freeze({userId:ownerId,isOwner:true});},
 });
 return Object.freeze({service,close:()=>pool.end()});
}
