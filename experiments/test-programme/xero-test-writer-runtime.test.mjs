import test from 'node:test';import assert from 'node:assert/strict';
import {createXeroTestWriterRuntime} from './xero-test-writer-runtime.ts';
const project='bioalckltvkhlczusdvl',owner='10000000-0000-4000-8000-000000000001';
const env={NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED:'true',NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_TEST_WRITER_OPERATOR_ORIGIN:'https://operator.example.test',NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF:project,NIGHT_SCOUT_REVIEW_AUTH_URL:`https://${project}.supabase.co`,NIGHT_SCOUT_REVIEW_PUBLIC_KEY:'synthetic-public-key-material',NIGHT_SCOUT_XERO_STAGING_OWNER_ID:owner,NIGHT_SCOUT_XERO_STAGING_STORE_ID:'20000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID:'30000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_SECRET:'synthetic-writer-client-secret-material',NIGHT_SCOUT_XERO_TEST_WRITER_REDIRECT_URI:'https://operator.example.test/api/xero/test-writer/callback',NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY:'synthetic-isolated-envelope-master-material',NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION:'writer-v1',NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL:`postgresql://night_scout_test_writer.${project}:synthetic-password@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`};
function harness(unsafe=false,user=owner){const calls=[];let poolConfig,closed=false,released=false;const safe={rolsuper:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,session_login:'night_scout_test_writer'};const client={query:async(sql,args)=>{calls.push(sql);if(sql.includes('FROM pg_catalog.pg_roles WHERE'))return {rows:[{...safe,rolname:'night_scout_test_writer',rolcanlogin:true,rolconnlimit:3,rolsuper:unsafe},{...safe,rolname:'night_scout_test_writer_service',rolcanlogin:false}]};if(sql.includes('pg_auth_members'))return {rows:[{role_name:'night_scout_test_writer_service',member_name:'night_scout_test_writer',admin_option:false,inherit_option:false,set_option:true}]};return {rows:[{ok:true}]};},release:()=>released=true};return {calls,get poolConfig(){return poolConfig;},get closed(){return closed;},get released(){return released;},deps:{createPool:config=>{poolConfig=config;return {on:()=>{},connect:async()=>client,end:async()=>closed=true};},createAuthClient:()=>({auth:{getClaims:async()=>({data:{claims:{sub:user,iss:`https://${project}.supabase.co/auth/v1`,aud:'authenticated',role:'authenticated',aal:'aal2',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}},error:null}),getUser:async()=>({data:{user:{id:user}},error:null})}})}};}
test('default-off and target pins require dedicated writer credentials',()=>{assert.equal(createXeroTestWriterRuntime({}),undefined);for(const patch of [{NIGHT_SCOUT_TEST_WRITER_OPERATOR_ORIGIN:'https://night-scout-xero-staging.onrender.com'},{NIGHT_SCOUT_XERO_CLIENT_ID:env.NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID},{NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY:env.NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY},{NIGHT_SCOUT_RUNTIME_ENV:'production'},{NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL:env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL.replace('night_scout_test_writer','night_scout_review_login')},{NIGHT_SCOUT_XERO_TEST_WRITER_REDIRECT_URI:'https://elsewhere.invalid/callback'},{NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF:'wrong'},{NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL:env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL+'?sslmode=no-verify'}])assert.throws(()=>createXeroTestWriterRuntime({...env,...patch}));});
test('owner verified fresh and writer RPC always identity checked in scoped transaction with verified TLS',async()=>{const h=harness(),runtime=createXeroTestWriterRuntime(env,h.deps);const out=await runtime.service.start('Bearer synthetic-member-token');assert.match(out.url,/login.xero.com/);assert.equal(h.poolConfig.ssl.rejectUnauthorized,true);assert.equal(h.poolConfig.max,1);assert.ok(h.calls.indexOf('SET LOCAL ROLE night_scout_test_writer_service')<h.calls.findIndex(v=>v.includes('start_writer_consent')));assert.equal(h.calls[0],'BEGIN');assert.equal(h.calls.at(-1),'COMMIT');assert.equal(h.released,true);await runtime.close();assert.equal(h.closed,true);});
test('wrong owner cannot reach DB and elevated role rolls back before credential RPC',async()=>{const outsider=harness(false,'40000000-0000-4000-8000-000000000001'),first=createXeroTestWriterRuntime(env,outsider.deps);await assert.rejects(first.service.start('Bearer synthetic-member-token'));assert.equal(outsider.calls.length,0);await first.close();const h=harness(true),runtime=createXeroTestWriterRuntime(env,h.deps);await assert.rejects(runtime.service.start('Bearer synthetic-member-token'));assert.equal(h.calls.at(-1),'ROLLBACK');assert.equal(h.calls.some(v=>v.includes('start_writer_consent')),false);await runtime.close();});
test('new Xero consent profile requires explicit opt-in and selects only its dedicated RPC',async()=>{
 const h=harness(),runtime=createXeroTestWriterRuntime({...env,NIGHT_SCOUT_XERO_TEST_WRITER_CONSENT_PROFILE:'daily-xero-20261030-v1'},h.deps);await runtime.service.start('Bearer synthetic-member-token');
 assert.equal(h.calls.some(sql=>sql.includes('start_xero_20261030_consent')),true);assert.equal(h.calls.some(sql=>sql.includes('start_writer_consent')),false);await runtime.close();
 const unknown=harness();assert.throws(()=>createXeroTestWriterRuntime({...env,NIGHT_SCOUT_XERO_TEST_WRITER_CONSENT_PROFILE:'auto-renew'},unknown.deps));assert.equal(unknown.poolConfig,undefined);
});
test('source proof requires an explicit flag and exact owner-confirmed selected IDs before pool creation',()=>{
 const h=harness();assert.throws(()=>createXeroTestWriterRuntime({...env,NIGHT_SCOUT_XERO_TEST_WRITER_SOURCE_PROOF_ENABLED:'true'},h.deps));assert.equal(h.poolConfig,undefined);
 const selected={...env,NIGHT_SCOUT_REVIEW_PUBLIC_KEY:'sb_publishable_'+'a'.repeat(24),NIGHT_SCOUT_XERO_TEST_WRITER_SOURCE_PROOF_ENABLED:'true',NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_CONTACT_ID:'50000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_ACCOUNT_ID:'60000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_SYNTHETIC_CONTACT_CONFIRMED_ID:'50000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_NON_STOCK_ACCOUNT_CONFIRMED_ID:'60000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_APP_BOUNDARY_VERIFIED:'true'};
 const valid=harness(),runtime=createXeroTestWriterRuntime(selected,valid.deps);assert.ok(runtime);void runtime.close();
 assert.throws(()=>createXeroTestWriterRuntime({...selected,NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_SYNTHETIC_CONTACT_CONFIRMED_ID:'70000000-0000-4000-8000-000000000001'},harness().deps));
});

test('verified AAL2 claims and a current owner are both required before any writer SQL',async()=>{
 const now=Math.floor(Date.now()/1000),claims={sub:owner,iss:`https://${project}.supabase.co/auth/v1`,aud:'authenticated',role:'authenticated',aal:'aal2',iat:now,exp:now+3600};
 const variants=[
  {claims:{...claims,aal:'aal1'}},{claims:{...claims,aal:undefined}},
  {claims:{...claims,sub:'40000000-0000-4000-8000-000000000001'}},
  {claims:{...claims,iss:'https://different.supabase.co/auth/v1'}},
  {claims:{...claims,aud:'anon'}},{claims:{...claims,role:'service_role'}},
  {claims:{...claims,is_anonymous:true}},{claims:{...claims,exp:now-1}},
  {claims:{...claims,iat:now+120}},{claims:{...claims,exp:undefined}},
  {claims,error:{message:'signature verification rejected forged aal2'}},
  {claims,currentError:{message:'revoked or unavailable current owner'}},
  {claims,currentUser:{id:'40000000-0000-4000-8000-000000000001'}},
  {claims,currentUser:{id:owner,is_anonymous:true}},
  {missingVerifier:true}
 ];
 for(const variant of variants){
  const h=harness();let currentChecks=0,verifiedBearer;
  h.deps.createAuthClient=()=>({auth:{...(variant.missingVerifier?{}:{getClaims:async token=>{verifiedBearer=token;return {data:{claims:variant.claims},error:variant.error??null};}}),getUser:async()=>{currentChecks++;return {data:{user:variant.currentUser??{id:owner}},error:variant.currentError??null};}}});
  const runtime=createXeroTestWriterRuntime(env,h.deps);
  await assert.rejects(runtime.service.start('Bearer forged-or-low-assurance-token'),/Xero writer setup unavailable/);
  assert.equal(h.calls.length,0);assert.notEqual(verifiedBearer,'Bearer forged-or-low-assurance-token');
  if(variant.currentError||variant.currentUser)assert.equal(currentChecks,1);else assert.equal(currentChecks,0);
  await runtime.close();
 }
});

const sourceSelected={...env,NIGHT_SCOUT_REVIEW_PUBLIC_KEY:'sb_publishable_'+'a'.repeat(24),NIGHT_SCOUT_XERO_TEST_WRITER_SOURCE_PROOF_ENABLED:'true',NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_CONTACT_ID:'50000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_ACCOUNT_ID:'60000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_SYNTHETIC_CONTACT_CONFIRMED_ID:'50000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_PROOF_NON_STOCK_ACCOUNT_CONFIRMED_ID:'60000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_APP_BOUNDARY_VERIFIED:'true'};
test('runtime uses public RPC only with explicit binding transport, preserves default and rejects unknown opt-in',async()=>{
 for(const transport of [undefined,'existing-schema-select','public-binding-rpc-v1']){
  const h=harness(),calls=[];
  h.deps.fetchImpl=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([{store_id:env.NIGHT_SCOUT_XERO_STAGING_STORE_ID,tenant_id:'70000000-0000-4000-8000-000000000001'}]));};
  const runtime=createXeroTestWriterRuntime({...sourceSelected,...(transport?{NIGHT_SCOUT_XERO_TEST_WRITER_READER_BINDING_TRANSPORT:transport}:{})},h.deps);
  try{
   await runtime.service.start('Bearer synthetic-aal2-owner-session');assert.equal(calls.length,1);
   const rpc=transport==='public-binding-rpc-v1',url=new URL(calls[0].url);
   assert.equal(url.pathname,rpc?'/rest/v1/rpc/xero_member_active_tenant_binding_v1':'/rest/v1/connections');
   assert.equal(calls[0].options.method,rpc?'POST':'GET');assert.equal(calls[0].options.headers['Accept-Profile'],rpc?'public':'xero_v1');
   assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-aal2-owner-session');
   if(rpc)assert.deepEqual(JSON.parse(calls[0].options.body),{p_store_id:env.NIGHT_SCOUT_XERO_STAGING_STORE_ID});
   assert.equal(h.calls.some(sql=>sql.includes('start_writer_consent')),true);
  }finally{await runtime.close();}
 }
 const invalid=harness();assert.throws(()=>createXeroTestWriterRuntime({...sourceSelected,NIGHT_SCOUT_XERO_TEST_WRITER_READER_BINDING_TRANSPORT:'auto-fallback'},invalid.deps),/setup unavailable/);assert.equal(invalid.poolConfig,undefined);
 const off=harness(),disabledProof=createXeroTestWriterRuntime({...env,NIGHT_SCOUT_XERO_TEST_WRITER_READER_BINDING_TRANSPORT:'auto-fallback'},off.deps);assert.ok(disabledProof);await disabledProof.close();
});
test('runtime public RPC unavailable remains failclosed before writer consent SQL, with no private-schema fallback',async()=>{
 const h=harness(),calls=[];h.deps.fetchImpl=async(url,options)=>{calls.push({url,options});return new Response('{}',{status:404});};
 const runtime=createXeroTestWriterRuntime({...sourceSelected,NIGHT_SCOUT_XERO_TEST_WRITER_READER_BINDING_TRANSPORT:'public-binding-rpc-v1'},h.deps);
 try{await assert.rejects(runtime.service.start('Bearer synthetic-aal2-owner-session'),/setup unavailable/);assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).pathname,'/rest/v1/rpc/xero_member_active_tenant_binding_v1');assert.equal(h.calls.length,0);}
 finally{await runtime.close();}
});

test('compact hex and canonical UUID client IDs preserve exact case/value in authorize URL and token Basic auth',async()=>{
 const tenant='80000000-0000-4000-8000-000000000001';
 for(const clientId of ['ABCD0123'.repeat(4),'AbCd0123'.repeat(4),'abcd0123'.repeat(4),env.NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID,'AbCd0123-4567-489A-BCDE-F0123456789A']){
  const h=harness(),requests=[];
  h.deps.fetchImpl=async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(String(url).endsWith('/token')?{access_token:'synthetic-fresh-access-token',refresh_token:'synthetic-fresh-refresh-token',scope:'offline_access accounting.invoices accounting.settings.read accounting.contacts.read'}:String(url).endsWith('/connections')?[{tenantId:tenant,tenantType:'ORGANISATION'}]:{Organisations:[{IsDemoCompany:true,BaseCurrency:'GBP'}]}));};
  const runtime=createXeroTestWriterRuntime({...env,NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID:clientId},h.deps);
  try{
   const authorize=new URL((await runtime.service.start('Bearer synthetic-aal2-owner-session')).url);assert.equal(authorize.searchParams.get('client_id'),clientId);const state=authorize.searchParams.get('state');
   assert.deepEqual(await runtime.service.complete({state,code:'synthetic-authorization-code'}),{state:'writer_connected_programme_disabled'});
   const tokenRequests=requests.filter(r=>String(r.url)==='https://identity.xero.com/connect/token');assert.equal(tokenRequests.length,1);const token=tokenRequests[0];
   assert.equal(token.options.method,'POST');assert.equal(Buffer.from(token.options.headers.Authorization.slice(6),'base64').toString('utf8'),clientId+':'+env.NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_SECRET);assert.equal(new URLSearchParams(token.options.body).get('grant_type'),'authorization_code');
   assert.equal(h.calls.some(sql=>sql.includes('seed_writer_consent')),true);assert.equal(h.poolConfig.ssl.rejectUnauthorized,true);
  }finally{await runtime.close();}
 }
});
test('client ID validation rejects non-hex/whitespace/length variants before creating any pool',()=>{
 const hex='ABCD0123'.repeat(4),canonical=env.NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID;
 for(const clientId of [undefined,null,'','arbitrary-client-id',hex.slice(1),hex+'0','G'+hex.slice(1),' '+hex,hex+' ',hex+'\n',hex+'\r\n','\t'+hex,canonical+'\n',' '+canonical,'{'+canonical+'}',[hex],{toString:()=>hex}]){
  const h=harness();assert.throws(()=>createXeroTestWriterRuntime({...env,NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID:clientId},h.deps),/Xero writer setup unavailable/);assert.equal(h.poolConfig,undefined);assert.equal(h.calls.length,0);
 }
});
test('accepting compact client ID preserves reader separation and AAL2 authorization gates',async()=>{
 const clientId='ABCD0123'.repeat(4),sameReader=harness();assert.throws(()=>createXeroTestWriterRuntime({...env,NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID:clientId,NIGHT_SCOUT_XERO_CLIENT_ID:clientId},sameReader.deps));assert.equal(sameReader.poolConfig,undefined);
 const h=harness();h.deps.createAuthClient=()=>({auth:{getClaims:async()=>({data:{claims:{sub:owner,iss:`https://${project}.supabase.co/auth/v1`,aud:'authenticated',role:'authenticated',aal:'aal1',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}},error:null}),getUser:async()=>{throw Error('AAL1 must stop before current-user check');}}});
 const runtime=createXeroTestWriterRuntime({...env,NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID:clientId},h.deps);try{await assert.rejects(runtime.service.start('Bearer synthetic-low-assurance-token'),/Xero writer setup unavailable/);assert.equal(h.calls.length,0);}finally{await runtime.close();}
});
