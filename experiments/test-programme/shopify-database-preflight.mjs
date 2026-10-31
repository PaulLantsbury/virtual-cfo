import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {validWriterDatabaseIdentity} from './writer-database-identity.mjs';

const project='bioalckltvkhlczusdvl', target='pocketlaunchpad1.myshopify.com';
const event='shopify_writer_database_preflight';
const receipt=(state,reason,extra={})=>({event,state,reason,providerWritesPerformed:false,...extra});

/** Reject shared/admin credentials before opening any socket. Keep the writer off.
 * The CA contents and connection string never enter the returned receipt/errors.
 */
export function writerPreflightOptions(env,readCa=path=>readFileSync(path,'utf8')){
 if(env.NIGHT_SCOUT_TEST_PROGRAMME_ENABLED!=='false'||env.NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF!==project||env.NIGHT_SCOUT_TEST_PROGRAMME_TARGET!==target)throw Error('Writer preflight configuration unavailable');
 const raw=env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL;
 if(typeof raw!=='string'||raw.length>4096||/[\x00-\x20\x7f]/.test(raw))throw Error('Writer preflight configuration unavailable');
 let u;try{u=new URL(raw);}catch{throw Error('Writer preflight configuration unavailable');}
 const user=decodeURIComponent(u.username);
 if(u.protocol!=='postgresql:'||u.hostname!=='aws-1-eu-west-1.pooler.supabase.com'||u.port!=='5432'||user!==`night_scout_test_writer.${project}`||u.pathname!=='/postgres'||!u.password||u.search||u.hash)throw Error('Writer preflight configuration unavailable');
 if(env.NODE_EXTRA_CA_CERTS!=='/etc/secrets/supabase-root-2021.crt')throw Error('Writer preflight configuration unavailable');
 const ca=readCa(env.NODE_EXTRA_CA_CERTS);
 if(typeof ca!=='string'||ca.length<100||ca.length>32768||!ca.startsWith('-----BEGIN CERTIFICATE-----')||!ca.includes('-----END CERTIFICATE-----'))throw Error('Writer preflight configuration unavailable');
 return {connectionString:raw,ssl:{ca,rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,statement_timeout:15000,idle_in_transaction_session_timeout:15000};
}

/** Authentication/ACL probe only. No claims, writes, OAuth, fake clocks or activation.
 * A false programme gate may mean disabled OR outside the eligible date/time; this
 * probe deliberately does not infer which. Operator metadata is a separate gate.
 */
export async function inspectShopifyWriterDatabase({env=process.env,readCa,connect}={}){
 let options;
 try{options=writerPreflightOptions(env,readCa);}catch{return receipt('unavailable','configuration_required');}
 if(typeof connect!=='function')return receipt('unavailable','connection_required');
 let client,result;
 try{
  client=await connect(options);
  await client.query('BEGIN READ ONLY');
  const identity=await client.query("SELECT session_user::text AS session_login,current_user::text AS current_role,current_setting('transaction_read_only') AS read_only");
  const id=identity.rows?.[0];
  if(identity.rows?.length!==1||id.session_login!=='night_scout_test_writer'||id.current_role!=='night_scout_test_writer'||id.read_only!=='on')throw Error();
  const roles=await client.query("SELECT rolname,rolcanlogin,rolconnlimit,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,session_user::text AS session_login FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service')");
  const memberships=await client.query("SELECT r.rolname AS role_name,u.rolname AS member_name,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname IN ('night_scout_test_writer','night_scout_test_writer_service')");
  if(!validWriterDatabaseIdentity(roles.rows,memberships.rows))throw Error();
  // The NOINHERIT login intentionally has no schema USAGE. Resolve function
  // signatures only after assuming its explicitly checked service membership.
  await client.query('SET LOCAL ROLE night_scout_test_writer_service');
  const privileges=await client.query("SELECT has_function_privilege('night_scout_test_writer_service','staging_test_programme.shopify_daily_20261029_ready(text,text,text,integer)','EXECUTE') AS service_ready,has_function_privilege('night_scout_test_writer_service','staging_test_programme.claim_action_before_20261029(text,text,text,text,text,integer)','EXECUTE') AS service_underlying,has_function_privilege('night_scout_test_writer','staging_test_programme.claim_action_before_20261029(text,text,text,text,text,integer)','EXECUTE') AS login_underlying");
  const p=privileges.rows?.[0];
  if(privileges.rows?.length!==1||p.service_ready!==true||p.service_underlying!==false||p.login_underlying!==false)throw Error();
  const gate=await client.query('SELECT staging_test_programme.shopify_daily_20261029_ready($1,$2,$3,$4) AS ready',['shopify-staging-20261029','shopify',target,7]);
  if(gate.rows?.length!==1||typeof gate.rows[0].ready!=='boolean')throw Error();
  result=receipt('restricted_connection_verified','read_only_probe_passed',{programmeWindowReady:gate.rows[0].ready,activationVerified:false});
 }catch{result=receipt('unavailable','restricted_database_probe_failed');}
 finally{
  if(client){
   try{await client.query('ROLLBACK');}catch{result=receipt('unavailable','rollback_unconfirmed');}
   try{client.release();}catch{result=receipt('unavailable','release_unconfirmed');}
  }
 }
 return result;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let pool,result;
 try{
  result=await inspectShopifyWriterDatabase({connect:async options=>{
   const require=createRequire(new URL('./.operator-runtime/package.json',import.meta.url));
   const {Pool}=require('pg');pool=new Pool(options);return pool.connect();
  }});
 }catch{result=receipt('unavailable','database_probe_unavailable');}
 finally{try{await pool?.end();}catch{result=receipt('unavailable','pool_close_unconfirmed');}}
 process.stdout.write(JSON.stringify(result)+'\n');
 if(result.state!=='restricted_connection_verified')process.exitCode=1;
}
