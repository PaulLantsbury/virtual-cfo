/** Isolated operator-only source. Not imported or deployed by the Night Scout app.
 * Separate operator hosting/callback review is required. */
import {createXeroWriterBootstrap} from './xero-writer-bootstrap.mjs';
import {createXeroOwnerSessionBindingReader} from './xero-reader-context-proof.mjs';
import {validXeroSourceSelection} from './xero-writer-source-proof.mjs';
import {validWriterDatabaseIdentity} from './writer-database-identity.mjs';
const PROJECT='bioalckltvkhlczusdvl';
import {operatorOrigin,operatorCallback} from './operator-origin.mjs';
const unavailable=()=>Error('Xero writer setup unavailable');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// OAuth client IDs are opaque: accept the observed compact hex form and the
// existing UUID form, without trimming, changing case or inserting separators.
const validOAuthClientId=(value:unknown)=>typeof value==='string'&&((value.length===32&&/^[0-9a-f]{32}$/i.test(value))||(value.length===36&&uuid.test(value)));
export type XeroTestWriterRuntime=Readonly<{service:{start(authorization:string):Promise<unknown>;complete(input:{state:string;code:string}):Promise<unknown>};close():Promise<void>}>;
/** Separate write-consent capability: never borrows reader credentials or database privileges. */
export function createXeroTestWriterRuntime(env:NodeJS.ProcessEnv,deps:{createPool?:(config:any)=>any;createAuthClient?:(...args:any[])=>any;fetchImpl?:typeof fetch;readerContextSource?:unknown}={}):XeroTestWriterRuntime|undefined {
 if(env.NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED!=='true')return undefined;
 const consentProfile=env.NIGHT_SCOUT_XERO_TEST_WRITER_CONSENT_PROFILE??'original';
 if(!['original','daily-xero-20261030-v1'].includes(consentProfile))throw unavailable();
 if(typeof deps.createPool!=='function'||typeof deps.createAuthClient!=='function')throw unavailable();
 const sourceProofEnabled=env.NIGHT_SCOUT_XERO_TEST_WRITER_SOURCE_PROOF_ENABLED==='true';
 const bindingTransport=env.NIGHT_SCOUT_XERO_TEST_WRITER_READER_BINDING_TRANSPORT??'existing-schema-select';
 if(sourceProofEnabled&&!['existing-schema-select','public-binding-rpc-v1'].includes(bindingTransport))throw unavailable();
 const proofSelection=sourceProofEnabled?{contactId:env.NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_CONTACT_ID,accountId:env.NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_ACCOUNT_ID,confirmedSyntheticContactId:env.NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_SYNTHETIC_CONTACT_CONFIRMED_ID,confirmedNonStockAccountId:env.NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_NON_STOCK_ACCOUNT_CONFIRMED_ID,separateWriterAppConfirmed:env.NIGHT_SCOUT_XERO_TEST_WRITER_APP_BOUNDARY_VERIFIED==='true'}:undefined;
 if(sourceProofEnabled&&!validXeroSourceSelection(proofSelection))throw unavailable();
 const origin=operatorOrigin(env.NIGHT_SCOUT_TEST_WRITER_OPERATOR_ORIGIN),redirect=operatorCallback(origin);
 const authUrl=env.NIGHT_SCOUT_REVIEW_AUTH_URL,key=env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY;
 const ownerId=env.NIGHT_SCOUT_XERO_STAGING_OWNER_ID,storeId=env.NIGHT_SCOUT_XERO_STAGING_STORE_ID;
 const clientId=env.NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID,clientSecret=env.NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_SECRET;
 const expectedTenant=env.NIGHT_SCOUT_XERO_TEST_WRITER_EXPECTED_TENANT_ID;
 const masterKey=env.NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY,keyVersion=env.NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION;
 if(env.NIGHT_SCOUT_RUNTIME_ENV!=='staging'||env.NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF!==PROJECT||authUrl!==`https://${PROJECT}.supabase.co`||typeof key!=='string'||key.length<20||!uuid.test(ownerId??'')||!uuid.test(storeId??'')||!validOAuthClientId(clientId)||typeof clientSecret!=='string'||clientSecret.length<24||clientSecret.length>2048||env.NIGHT_SCOUT_XERO_TEST_WRITER_REDIRECT_URI!==redirect||expectedTenant!==undefined&&!uuid.test(expectedTenant)||typeof masterKey!=='string'||Buffer.byteLength(masterKey)<32||!keyVersion||!/^[A-Za-z0-9._-]{1,128}$/.test(keyVersion))throw unavailable();
 if(clientId===env.NIGHT_SCOUT_XERO_CLIENT_ID||masterKey===env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY)throw unavailable();
 let url:URL;try{url=new URL(env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL!);}catch{throw unavailable();}
 if(url.protocol!=='postgresql:'||url.hostname!=='aws-1-eu-west-1.pooler.supabase.com'||url.port!=='5432'||url.pathname!=='/postgres'||decodeURIComponent(url.username)!==`night_scout_test_writer.${PROJECT}`||!url.password||url.search||url.hash)throw unavailable();
 const fetchImpl=deps.fetchImpl??fetch;
 const boundedFetch:typeof fetch=(input,init)=>fetchImpl(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(10_000)]):AbortSignal.timeout(10_000)});
 const auth=deps.createAuthClient(authUrl!,key!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch}});
 const pool=deps.createPool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,query_timeout:10_000});
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
 // Verify the signature/expiry with the SDK before using AAL claims, then ask
 // Auth for the current user. Decoding a bearer or reading a local session alone
 // is never authority for this separate credential-creation capability.
 const authenticateOwner=async(authorization:string)=>{
  if(typeof authorization!=='string'||!/^Bearer [-A-Za-z0-9._]{1,8192}$/i.test(authorization)||typeof auth.auth.getClaims!=='function')throw unavailable();
  const token=authorization.slice(7),verified=await auth.auth.getClaims(token),claims=verified.data?.claims;
  const now=Math.floor(Date.now()/1000);
  if(verified.error||!claims||claims.sub!==ownerId||claims.iss!==`${authUrl}/auth/v1`||claims.role!=='authenticated'||claims.aal!=='aal2'||claims.is_anonymous===true||!Number.isInteger(claims.exp)||claims.exp<=now||!Number.isInteger(claims.iat)||claims.iat>now+60||!(claims.aud==='authenticated'||Array.isArray(claims.aud)&&claims.aud.includes('authenticated')))throw unavailable();
  const {data,error}=await auth.auth.getUser(token);
  if(error||data?.user?.id!==ownerId||data.user.is_anonymous===true)throw unavailable();
  return Object.freeze({userId:ownerId,isOwner:true,assuranceLevel:'aal2'});
 };
 const ownerSessionBindingReader=sourceProofEnabled?createXeroOwnerSessionBindingReader({authUrl,publicKey:key,authenticateOwner,fetchImpl:boundedFetch,bindingTransport}):undefined;
 const service=createXeroWriterBootstrap({enabled:true,consentProfile,projectRef:PROJECT,ownerId,storeId,expectedTenant,clientId,clientSecret,operatorOrigin:origin,redirectUri:redirect,masterKey,keyVersion,pool:scopedPool,fetchImpl,...(sourceProofEnabled?{sourceProof:{selection:proofSelection,readerContextSource:deps.readerContextSource,ownerSessionBindingReader}}:{}),authenticate:authenticateOwner});
 return Object.freeze({service,close:()=>pool.end()});
}
