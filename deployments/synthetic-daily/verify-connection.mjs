/** Explicit read-only hosted verification. Never provisions or publishes financial data. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stageRenderMountedBinding} from '../../experiments/synthetic-company/daily-render-wrapper.mjs';
import {readPrivateOperatorBinding,operatorClientConfig,operatorSessionRole} from '../../experiments/synthetic-company/daily-operator.mjs';
const require=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url));
const nativeClient=binding=>new (require('pg').Client)(operatorClientConfig(binding));
const identitySql="SELECT current_user AS current_role,session_user AS session_role,current_setting('server_version_num')::int AS server_version,current_setting('transaction_read_only') AS read_only";
export async function verifyHostedConnection({stage=stageRenderMountedBinding,readBinding=readPrivateOperatorBinding,createClient=nativeClient}={}){
 let staged,client,transaction=false,timer,expired=false;
 try{
  staged=await stage();const binding=await readBinding(staged.path);
  assert.equal(binding.appendApproved,false,'Pending binding required');
  assert.equal(binding.expected.protectedFingerprintsAccepted,false,'Unaccepted protection gate must remain false');
  assert.equal(binding.connection.ssl?.rejectUnauthorized,true,'Verified TLS required');
  client=createClient(binding);
  timer=setTimeout(()=>{expired=true;void client.end().catch(()=>{});},120000);timer.unref?.();
  client.on?.('error',()=>{});await client.connect();
  const stream=client.connection?.stream;
  assert.equal(stream?.encrypted,true,'Encrypted client transport required');
  assert.equal(stream?.authorized,true,'Verified certificate required');
  assert.ok(['TLSv1.2','TLSv1.3'].includes(stream.getProtocol()),'Modern TLS required');
  const identity=(await client.query(identitySql)).rows[0];
  assert.equal(identity.session_role,operatorSessionRole(binding));assert.equal(identity.current_role,identity.session_role);
  assert.ok(identity.server_version>=170000&&identity.server_version<180000);assert.equal(identity.read_only,'on');
  await client.query('BEGIN READ ONLY');transaction=true;
  await client.query("SELECT set_config('role',$1,false)",[binding.expected.callerRole]);
  const invoker=(await client.query(identitySql)).rows[0];
  assert.equal(invoker.current_role,binding.expected.callerRole);assert.equal(invoker.session_role,identity.session_role);assert.equal(invoker.read_only,'on');
  await client.query('ROLLBACK');transaction=false;
  assert.equal(expired,false,'Verification deadline exceeded');
  return {state:'restricted-hosted-connection-verified',clientTlsVerified:true,sessionIdentityVerified:true,restrictedInvokerVerified:true,readOnly:true,appendApproved:false,financialWrites:false,activationAllowed:false};
 }finally{
  clearTimeout(timer);if(transaction){try{await client.query('ROLLBACK');}catch{}}
  if(client){try{await client.end();}catch{}}if(staged){try{await staged.cleanup();}catch{}}
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 Promise.resolve().then(()=>{assert.equal(process.versions.node,'24.22.3','Reviewed Node runtime required');return verifyHostedConnection();}).then(result=>process.stdout.write(JSON.stringify(result)+'\n')).catch(()=>{process.stderr.write(JSON.stringify({state:'restricted-hosted-connection-blocked',financialWrites:false,activationAllowed:false})+'\n');process.exitCode=1;});
}
