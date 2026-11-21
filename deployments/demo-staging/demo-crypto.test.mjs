import test from 'node:test';import assert from 'node:assert/strict';import {encryptDemoEnvelope,decryptDemoEnvelope} from './demo-envelope-crypto.mjs';import {encryptStagingEnvelope,decryptStagingEnvelope} from '../nightly-staging/xero-refresh-runtime.mjs';import {encryptStagingEnvelope as encryptWriter} from '../../experiments/test-programme/writer-envelope-crypto.mjs';
const master='synthetic-dedicated-demo-key-at-least-32',identity={connectionId:'90000000-0000-4000-8000-000000000001',tenantId:'90000000-0000-4000-8000-000000000003',keyVersion:'demo-v1'},token='synthetic-demo-refresh-token';
test('dedicated demo AAD binds new store/connection/tenant/key and rejects old/writer envelopes even with same key',()=>{
 const e=encryptDemoEnvelope(master,identity,token);assert.equal(e.ciphertext[0],1);assert.equal(decryptDemoEnvelope(master,{...identity,...e}).toString(),token);
 for(const patch of [{tenantId:'90000000-0000-4000-8000-000000000004'},{connectionId:'90000000-0000-4000-8000-000000000005'},{keyVersion:'different'},{storeId:'90000000-0000-4000-8000-000000000006'}])assert.throws(()=>decryptDemoEnvelope(master,{...identity,...patch,...e}));
 assert.throws(()=>decryptStagingEnvelope(master,{...identity,...e}));for(const encrypt of [encryptStagingEnvelope,encryptWriter])assert.throws(()=>decryptDemoEnvelope(master,{...identity,...encrypt(master,identity,token)}));
 const tampered=Buffer.from(e.ciphertext);tampered[tampered.length-1]^=1;assert.throws(()=>decryptDemoEnvelope(master,{...identity,...e,ciphertext:tampered}));
});
