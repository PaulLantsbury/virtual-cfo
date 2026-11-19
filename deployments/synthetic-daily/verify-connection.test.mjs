import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyHostedConnection} from './verify-connection.mjs';
function fixture({appendApproved=false,protectedAccepted=false,authorized=true,wrongSession=false,wrongInvoker=false,readOnly='on'}={}){
 const calls=[];let ended=0,cleaned=0,identities=0;
 const binding={appendApproved,connection:{role:'fictional_runtime',ssl:{rejectUnauthorized:true}},expected:{callerRole:'fictional_invoker',protectedFingerprintsAccepted:protectedAccepted}};
 const client={connection:{stream:{encrypted:true,authorized,getProtocol:()=> 'TLSv1.3'}},on(){},async connect(){calls.push('CONNECT');},async end(){ended++;},async query(sql,params){
  calls.push(sql);if(sql.startsWith('SELECT current_user')){identities++;return {rows:[{current_role:identities===1?'fictional_runtime':wrongInvoker?'unreviewed':'fictional_invoker',session_role:wrongSession?'unreviewed':'fictional_runtime',server_version:170006,read_only:readOnly}]};}
  if(sql.includes('set_config'))assert.deepEqual(params,['fictional_invoker']);return {rows:[]};
 }};
 return {calls,binding,client,get ended(){return ended;},get cleaned(){return cleaned;},options:{stage:async()=>({path:'/private/not-a-real-binding',cleanup:async()=>{cleaned++;}}),readBinding:async()=>binding,createClient:()=>client}};
}
test('hosted verification checks TLS, exact identities and read-only invoker without financial queries',async()=>{
 const f=fixture();const result=await verifyHostedConnection(f.options);
 assert.equal(result.state,'restricted-hosted-connection-verified');assert.equal(result.activationAllowed,false);assert.equal(result.financialWrites,false);
 assert.deepEqual(f.calls.filter(s=>!s.startsWith('SELECT current_user')),['CONNECT','BEGIN READ ONLY',"SELECT set_config('role',$1,false)",'ROLLBACK']);
 assert.equal(f.ended,1);assert.equal(f.cleaned,1);
});
test('enabled approval flags refuse before opening a connection and clean the copy',async()=>{
 for(const options of [{appendApproved:true},{protectedAccepted:true}]){const f=fixture(options);await assert.rejects(verifyHostedConnection(f.options));assert.deepEqual(f.calls,[]);assert.equal(f.cleaned,1);}
});
test('untrusted TLS and identity or read-only drift stop verification without financial access',async()=>{
 for(const options of [{authorized:false},{wrongSession:true},{wrongInvoker:true},{readOnly:'off'}]){
  const f=fixture(options);await assert.rejects(verifyHostedConnection(f.options));assert.equal(f.ended,1);assert.equal(f.cleaned,1);
  assert.ok(f.calls.every(sql=>sql==='CONNECT'||sql==='BEGIN READ ONLY'||sql==='ROLLBACK'||sql.startsWith('SELECT current_user')||sql.includes('set_config')));
  if(options.wrongInvoker)assert.equal(f.calls.at(-1),'ROLLBACK');
 }
});
