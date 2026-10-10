import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {encryptStagingEnvelope as oldEncrypt,decryptStagingEnvelope as oldDecrypt} from '../../deployments/nightly-staging/xero-refresh-runtime.mjs';
import {encryptStagingEnvelope,decryptStagingEnvelope} from './writer-envelope-crypto.mjs';
test('side-effect-free envelope codec preserves exact existing staging wire format',()=>{
 const master='synthetic-writer-master-key-minimum32',context={connectionId:'synthetic-writer-connection',tenantId:'synthetic-test-tenant',keyVersion:'writer-v1'},token='synthetic-refresh-token-only';
 const old=oldEncrypt(master,context,token),fresh=encryptStagingEnvelope(master,context,token);
 for(const [decode,envelope] of [[decryptStagingEnvelope,old],[oldDecrypt,fresh]]){const plain=decode(master,{...context,...envelope});assert.equal(plain.toString(),token);plain.fill(0);}
});
test('hosted provider modules never import executable worker, refresh runner or provider CLI',()=>{
 for(const name of ['writer-database-identity.mjs','writer-envelope-crypto.mjs','writer-oauth-scopes.mjs','xero-writer-bootstrap.mjs','xero-writer-bootstrap-router.mjs']){
  const source=readFileSync(new URL(`./${name}`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/from ['"].*(?:run-provider-test-programme|xero-writer-refresh|xero-refresh-runtime|xero-worker)\.mjs/);
  assert.doesNotMatch(source,/process\.argv|import\.meta\.url/);
 }
});
