import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {operatorOrigin} from '../test-programme/operator-origin.mjs';
import {publicOwnerAuthConfig} from '../test-programme/operator-owner-page.mjs';
import {validDemoBootstrapIdentity} from '../../deployments/demo-staging/demo-database-identity.mjs';
import {encryptDemoEnvelope} from '../../deployments/demo-staging/demo-envelope-crypto.mjs';
export const DEMO_STORE='f59e3a44-7106-4df8-9c08-52da30c9de30';
export const DEMO_PROJECT='bioalckltvkhlczusdvl';
export const DEMO_READER_BOOTSTRAP_START='2026-10-30T00:00:00.000Z';
export const DEMO_READER_HARD_STOP='2026-11-06T03:00:00.000Z';
const trialOpen=at=>Number.isSafeInteger(at)&&at>=Date.parse(DEMO_READER_BOOTSTRAP_START)&&at<Date.parse(DEMO_READER_HARD_STOP);
const assertTrial=at=>{if(!trialOpen(at))throw unavailable();};
export const DEMO_DISCOVERY_SCOPES=Object.freeze(['openid','profile','email','accounting.settings.read']);
export const DEMO_READER_SCOPES=Object.freeze([...DEMO_DISCOVERY_SCOPES,'accounting.reports.profitandloss.read','accounting.reports.balancesheet.read','accounting.reports.trialbalance.read','accounting.reports.banksummary.read','offline_access']);
export const DEMO_CATEGORIES=Object.freeze(['revenue','processingFee','advertising','software','includedCash']);
const allowedTypes={revenue:new Set(['REVENUE','SALES']),processingFee:new Set(['EXPENSE','OVERHEADS']),advertising:new Set(['EXPENSE','OVERHEADS']),software:new Set(['EXPENSE','OVERHEADS']),includedCash:new Set(['BANK'])};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const unavailable=()=>Error('Demo reader setup unavailable');
const digest=value=>createHash('sha256').update(value).digest('base64url');
const canonical=value=>typeof value==='string'&&/^[A-Za-z0-9._-]{1,128}$/.test(value);
export function readDemoReaderConsentConfig(env={}){
 if(env.NIGHT_SCOUT_DEMO_READER_BOOTSTRAP_ENABLED!=='true')return undefined;
 const origin=operatorOrigin(env.NIGHT_SCOUT_DEMO_READER_OPERATOR_ORIGIN),redirectUri=origin+'/api/xero-demo/reader/callback';
 const authUrl=env.NIGHT_SCOUT_REVIEW_AUTH_URL,publicKey=env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY;
 publicOwnerAuthConfig({authUrl,publicKey});
 const clientId=env.NIGHT_SCOUT_DEMO_READER_CLIENT_ID,clientSecret=env.NIGHT_SCOUT_DEMO_READER_CLIENT_SECRET,ownerId=env.NIGHT_SCOUT_DEMO_READER_OWNER_ID,masterKey=env.NIGHT_SCOUT_DEMO_READER_ENVELOPE_MASTER_KEY,keyVersion=env.NIGHT_SCOUT_DEMO_READER_ENVELOPE_KEY_VERSION;
 if(env.NIGHT_SCOUT_RUNTIME_ENV!=='staging'||env.NIGHT_SCOUT_DEMO_PROJECT_REF!==DEMO_PROJECT||env.NIGHT_SCOUT_DEMO_STORE_ID!==DEMO_STORE||env.NIGHT_SCOUT_DEMO_READER_REDIRECT_URI!==redirectUri||!(uuid(clientId)||typeof clientId==='string'&&/^[0-9a-f]{32}$/i.test(clientId))||typeof clientSecret!=='string'||clientSecret.length<24||clientSecret.length>2048||!uuid(ownerId)||typeof masterKey!=='string'||Buffer.byteLength(masterKey)<32||!canonical(keyVersion))throw unavailable();
 // A dedicated app and encryption material are not borrowed from another host.
 if(clientId===env.NIGHT_SCOUT_XERO_CLIENT_ID||clientId===env.NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID||masterKey===env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY||masterKey===env.NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY)throw unavailable();
 let url;try{url=new URL(env.NIGHT_SCOUT_DEMO_BOOTSTRAP_DATABASE_URL);}catch{throw unavailable();}
 if(url.protocol!=='postgresql:'||url.hostname!=='aws-1-eu-west-1.pooler.supabase.com'||url.port!=='5432'||url.pathname!=='/postgres'||decodeURIComponent(url.username)!==`night_scout_demo_bootstrap_login.${DEMO_PROJECT}`||!url.password||url.search||url.hash)throw unavailable();
 const ca=env.NIGHT_SCOUT_DEMO_STAGING_CA_PEM;
 if(typeof ca!=='string'||!ca.includes('BEGIN CERTIFICATE'))throw unavailable();
 return Object.freeze({origin,redirectUri,authUrl,publicKey,clientId,clientSecret,ownerId,masterKey,keyVersion,databaseUrl:url.toString(),ca});
}
export function createDemoReaderConsentRuntime(env={},deps={}){
 const config=readDemoReaderConsentConfig(env);if(!config)return undefined;
 if(typeof deps.createPool!=='function'||typeof deps.createAuthClient!=='function')throw unavailable();
 const now=deps.now??Date.now,fetchImpl=deps.fetchImpl??fetch;assertTrial(now());
 const boundedFetch=async(input,init)=>{assertTrial(now());const response=await fetchImpl(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});assertTrial(now());return response;};
 const auth=deps.createAuthClient(config.authUrl,config.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch}});
 const pool=deps.createPool({connectionString:config.databaseUrl,ssl:{ca:config.ca,rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,query_timeout:10000});pool.on('error',()=>{});
 const states=new Map(),discoveries=new Map(),selections=new Map();
 const prune=map=>{for(const [key,value] of map)if(value.expires<=now())map.delete(key);};
 const issue=(map,value,ttl)=>{prune(map);if(map.size>=32)throw unavailable();const handle=randomBytes(32).toString('base64url');map.set(digest(handle),Object.freeze({...value,expires:Math.min(now()+ttl,value.authExpires??Infinity)}));return handle;};
 const consume=(map,handle,ownerId)=>{if(!opaque(handle))throw unavailable();const key=digest(handle),item=map.get(key);map.delete(key);prune(map);if(!item||item.expires<=now()||item.ownerId!==ownerId)throw unavailable();return item;};
 const authenticate=async authorization=>{
  assertTrial(now());
  if(typeof authorization!=='string'||!/^Bearer [-A-Za-z0-9._]{1,8192}$/i.test(authorization)||typeof auth.auth.getClaims!=='function')throw unavailable();
  const token=authorization.slice(7),verified=await auth.auth.getClaims(token),claims=verified.data?.claims,at=Math.floor(now()/1000);
  if(verified.error||claims?.sub!==config.ownerId||claims.iss!==config.authUrl+'/auth/v1'||claims.role!=='authenticated'||claims.aal!=='aal2'||claims.is_anonymous===true||!Number.isInteger(claims.exp)||claims.exp<=at||!Number.isInteger(claims.iat)||claims.iat>at+60||!(claims.aud==='authenticated'||Array.isArray(claims.aud)&&claims.aud.includes('authenticated')))throw unavailable();
  const current=await auth.auth.getUser(token);if(current.error||current.data?.user?.id!==config.ownerId||current.data.user.is_anonymous===true)throw unavailable();
  // The fixed public RPC itself requires current auth.uid membership, including
  // before a reader connection exists. Its status body is not accepted as proof
  // of reader health; only the authenticated fixed-store authorization is used.
  const membership=await requestJson(boundedFetch,config.authUrl+'/rest/v1/rpc/xero_demo_reader_status_v1',{method:'POST',redirect:'error',headers:{apikey:config.publicKey,authorization:'Bearer '+token,'content-type':'application/json','accept-profile':'public','content-profile':'public'},body:JSON.stringify({p_store_id:DEMO_STORE})},32768);
  if(!plain(membership)||membership.storeId!==DEMO_STORE)throw unavailable();
  return Object.freeze({userId:config.ownerId,isOwner:true,authExpires:claims.exp*1000});
 };
 const owner=principal=>{assertTrial(now());if(principal?.isOwner!==true||principal.userId!==config.ownerId||!Number.isFinite(principal.authExpires)||principal.authExpires<=now())throw unavailable();};
 const authorize=(principal,value,scopes)=>{owner(principal);const state=issue(states,{...value,ownerId:principal.userId,authExpires:principal.authExpires,scopes},600000),url=new URL('https://login.xero.com/identity/connect/authorize');for(const [key,value] of Object.entries({response_type:'code',client_id:config.clientId,redirect_uri:config.redirectUri,scope:scopes.join(' '),state}))url.searchParams.set(key,value);return Object.freeze({url:url.href});};
 const service=Object.freeze({
  startDiscovery(principal){return authorize(principal,{phase:'discovery'},DEMO_DISCOVERY_SCOPES);},
  readDiscovery(principal,handle){owner(principal);const item=consume(discoveries,handle,principal.userId),period=demoReaderPeriod(now()),selectionHandle=issue(selections,{ownerId:principal.userId,authExpires:principal.authExpires,tenants:item.tenants,period},600000);return Object.freeze({state:'demo_accounts_ready',selectionHandle,tenants:item.tenants,period});},
  start(principal,input){owner(principal);if(!plain(input)||Object.keys(input).sort().join(',')!=='effectiveFrom,mapping,selectionHandle,tenantId')throw unavailable();const selected=consume(selections,input.selectionHandle,principal.userId),tenant=selected.tenants.find(row=>row.id===input.tenantId);if(!tenant||!validDay(input.effectiveFrom,now())||input.effectiveFrom>selected.period.from)throw unavailable();const mapping=materialise(input.mapping,tenant.accounts);return authorize(principal,{phase:'retain',tenantId:tenant.id,effectiveFrom:input.effectiveFrom,mapping},DEMO_READER_SCOPES);},
  async complete({state,code,scope}){
   assertTrial(now());
   if(!opaque(state)||typeof code!=='string'||!/^[-A-Za-z0-9._~]{8,4096}$/.test(code))throw unavailable();
   const binding=consume(states,state,config.ownerId);if(scope!==undefined&&!matchesScopes(scope,binding.scopes))throw unavailable();
   let refresh='';
   try{
    const tokens=await requestJson(boundedFetch,'https://identity.xero.com/connect/token',{method:'POST',redirect:'error',headers:{authorization:'Basic '+Buffer.from(config.clientId+':'+config.clientSecret).toString('base64'),'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:config.redirectUri}).toString()},32768);
    if(typeof tokens.access_token!=='string'||tokens.access_token.length<16||tokens.access_token.length>8192||!matchesScopes(tokens.scope,binding.scopes)||binding.phase==='retain'&&(typeof tokens.refresh_token!=='string'||tokens.refresh_token.length<16||tokens.refresh_token.length>8192))throw unavailable();
    const connections=await requestJson(boundedFetch,'https://api.xero.com/connections',{method:'GET',redirect:'error',headers:{authorization:'Bearer '+tokens.access_token}},65536);
    if(!Array.isArray(connections)||connections.length<1||connections.length>5||connections.some(row=>!uuid(row?.tenantId)||row.tenantType!=='ORGANISATION'||typeof row.tenantName!=='string'||row.tenantName.length>256)||new Set(connections.map(row=>row.tenantId)).size!==connections.length)throw unavailable();
    if(binding.phase==='discovery'){
     const tenants=[];for(const connection of connections){const organisation=await readOrganisation(boundedFetch,tokens.access_token,connection.tenantId);if(!organisation.isDemoCompany||organisation.currency!=='GBP')continue;const accounts=await readAccounts(boundedFetch,tokens.access_token,connection.tenantId);tenants.push(Object.freeze({id:connection.tenantId,name:connection.tenantName,currency:'GBP',isDemoCompany:true,observedAt:new Date(now()).toISOString(),accounts}));}
     if(tenants.length===0)throw unavailable();const handle=issue(discoveries,{ownerId:binding.ownerId,tenants:Object.freeze(tenants)},300000);return Object.freeze({state:'demo_discovery_received',handle});
    }
    if(!connections.some(row=>row.tenantId===binding.tenantId))throw unavailable();
    const organisation=await readOrganisation(boundedFetch,tokens.access_token,binding.tenantId);if(organisation.isDemoCompany!==true||organisation.currency!=='GBP')throw unavailable();
    const observedAt=new Date(now()).toISOString(),accounts=await readAccounts(boundedFetch,tokens.access_token,binding.tenantId),mapping=materialiseRows(binding.mapping,accounts),connectionId=randomUUID();
    assertTrial(now());refresh=tokens.refresh_token;const envelope=encryptDemoEnvelope(config.masterKey,{connectionId,tenantId:binding.tenantId,keyVersion:config.keyVersion},refresh);
    const directory=accounts.map(row=>({accountId:row.id,accountName:row.name,accountType:row.type,accountStatus:row.status}));
    const receipt={connectionId,storeId:DEMO_STORE,ownerId:binding.ownerId,tenantId:binding.tenantId,isDemoCompany:true,baseCurrency:'GBP',observedAt};
    assertTrial(now());const client=await pool.connect();
    try{
     await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='5s'");
     const identity=await client.query('SELECT session_user::text AS session_user,current_user::text AS current_user');
     if(identity.rows.length!==1||identity.rows[0].session_user!=='night_scout_demo_bootstrap_login'||identity.rows[0].current_user!=='night_scout_demo_bootstrap_login')throw unavailable();
     const roles=(await client.query("SELECT rolname,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolcanlogin,rolconnlimit,session_user::text AS session_login FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_demo_bootstrap_login','night_scout_demo_bootstrap_service')")).rows;
     const memberships=(await client.query("SELECT r.rolname AS role_name,u.rolname AS member_name,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname IN ('night_scout_demo_bootstrap_login','night_scout_demo_bootstrap_service')")).rows;
     if(!validDemoBootstrapIdentity(roles,memberships))throw unavailable();
     await client.query('SET LOCAL ROLE night_scout_demo_bootstrap_service');
     await client.query("SELECT set_config('night_scout.demo_reader_source_receipt',$1,true)",[JSON.stringify(receipt)]);
     const values=[connectionId,DEMO_STORE,binding.tenantId,binding.ownerId,binding.effectiveFrom,observedAt,JSON.stringify(directory),JSON.stringify(mapping),envelope.ciphertext,envelope.encryptedDek,config.keyVersion,'AES-256-GCM'];
     assertTrial(now());const result=await client.query('SELECT * FROM xero_demo_v1.bootstrap_create_initial_connection($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12)',values);
     if(result.rows.length!==1||result.rows[0].connection_id!==connectionId||!uuid(result.rows[0].mapping_version_id))throw unavailable();
     await client.query('COMMIT');return Object.freeze({state:'demo_reader_connected',storeId:DEMO_STORE,connectionId,mappingVersionId:result.rows[0].mapping_version_id,tenantId:binding.tenantId,readerHealthVerified:false,generationEnabled:false});
    }catch{await client.query('ROLLBACK').catch(()=>{});throw unavailable();}finally{client.release();}
   }catch{throw unavailable();}finally{refresh='';}
  }
 });
 return Object.freeze({publicConfig:Object.freeze({origin:config.origin,authUrl:config.authUrl,publicKey:config.publicKey,ownerId:config.ownerId}),service,authenticate,close:async()=>{states.clear();discoveries.clear();selections.clear();await pool.end();}});
}
function validDay(value,now){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00.000Z');return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value&&value>='2000-01-01'&&value<=new Date(now).toISOString().slice(0,10);}
function matchesScopes(raw,expected){if(typeof raw!=='string')return false;const values=raw.split(' '),set=new Set(values);return values.length===set.size&&values.every(value=>DEMO_READER_SCOPES.includes(value))&&expected.every(value=>set.has(value))&&!values.some(value=>!expected.includes(value));}
function materialise(mapping,accounts){if(!plain(mapping)||Object.keys(mapping).sort().join(',')!==[...DEMO_CATEGORIES].sort().join(','))throw unavailable();const rows=[];for(const category of DEMO_CATEGORIES){if(!Array.isArray(mapping[category])||mapping[category].length<1||mapping[category].length>20)throw unavailable();for(const id of mapping[category])rows.push({category,accountId:id});}return materialiseRows(rows,accounts);}
function materialiseRows(rows,accounts){const directory=new Map(accounts.map(row=>[row.id,row])),used=new Set();for(const {category,accountId} of rows){const account=directory.get(accountId);if(!uuid(accountId)||!allowedTypes[category]?.has(account?.type)||account?.status!=='ACTIVE'||used.has(accountId))throw unavailable();used.add(accountId);}return Object.freeze(rows.map(row=>Object.freeze({...row})));}
async function readOrganisation(fetchImpl,token,tenantId){const body=await requestJson(fetchImpl,'https://api.xero.com/api.xro/2.0/Organisation',{method:'GET',redirect:'error',headers:{authorization:'Bearer '+token,'xero-tenant-id':tenantId,accept:'application/json'}},262144),row=body?.Organisations?.[0];if(!Array.isArray(body?.Organisations)||body.Organisations.length!==1||typeof row?.IsDemoCompany!=='boolean'||typeof row.BaseCurrency!=='string')throw unavailable();return {isDemoCompany:row.IsDemoCompany,currency:row.BaseCurrency};}
async function readAccounts(fetchImpl,token,tenantId){const body=await requestJson(fetchImpl,'https://api.xero.com/api.xro/2.0/Accounts',{method:'GET',redirect:'error',headers:{authorization:'Bearer '+token,'xero-tenant-id':tenantId,accept:'application/json'}},1048576);if(!Array.isArray(body?.Accounts)||body.Accounts.length<1||body.Accounts.length>500)throw unavailable();const rows=body.Accounts.map(row=>{if(!uuid(row?.AccountID)||typeof row.Name!=='string'||row.Name.length<1||row.Name.length>256||typeof row.Type!=='string'||row.Type.length>32||typeof row.Status!=='string'||row.Status.length>32||row.Code!=null&&(typeof row.Code!=='string'||row.Code.length>64))throw unavailable();return Object.freeze({id:row.AccountID,code:row.Code??null,name:row.Name,type:row.Type,status:row.Status});});if(new Set(rows.map(row=>row.id)).size!==rows.length)throw unavailable();return Object.freeze(rows);}
async function requestJson(fetchImpl,url,options,maxBytes){let response;try{response=await fetchImpl(url,options);}catch{throw unavailable();}if(!response?.ok||response.redirected||!response.body)throw unavailable();const length=Number(response.headers.get('content-length'));if(Number.isFinite(length)&&length>maxBytes)throw unavailable();const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw unavailable();}chunks.push(value);}}return JSON.parse(Buffer.concat(chunks,size).toString('utf8'));}catch{throw unavailable();}finally{reader.releaseLock();}}

export function demoReaderPeriod(now=Date.now()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)),get=type=>parts.find(row=>row.type===type).value,day=get('year')+'-'+get('month')+'-'+get('day'),yesterday=new Date(new Date(day+'T00:00:00.000Z').valueOf()-86400000).toISOString().slice(0,10);return Object.freeze({from:(get('day')==='01'?yesterday.slice(0,7):day.slice(0,7))+'-01',to:yesterday,currency:'GBP',timezone:'Europe/London'});}
