import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagingXeroConsentBootstrap} from './staging-consent-bootstrap.mjs';

const secret='refresh-token-private-value-that-must-not-leak';
const envelope={algorithm:'AES-256-GCM',ciphertext:'sealed:private-ciphertext',encryptedDek:'wrapped:private-dek',keyVersion:'staging_v1'};
const create=({exchangeAuthorizationCode=async()=>({tenantId:'tenant_test',refreshCredential:secret}),encryptRefreshCredential=async value=>{assert.equal(value,secret);return envelope},persistConnection=async input=>({connectionId:'connection_test'})}={})=>createStagingXeroConsentBootstrap({exchangeAuthorizationCode,encryptRefreshCredential,persistConnection,now:()=> '2026-09-18T19:00:00.000Z'});
const input={authorizationCode:'c'.repeat(32),storeId:'store_test',expectedTenantId:'tenant_test'};

test('one-shot consent exchanges privately, encrypts then persists an exact tenant-bound envelope',async()=>{
 let exchangeInput,persisted;
 const bootstrap=create({exchangeAuthorizationCode:async value=>{exchangeInput=value;return {tenantId:'tenant_test',refreshCredential:secret}},persistConnection:async value=>{persisted=value;return {connectionId:'connection_test'}}});
 const result=await bootstrap.complete(input);
 assert.deepEqual(exchangeInput,{authorizationCode:input.authorizationCode});
 assert.deepEqual(persisted,{storeId:'store_test',tenantId:'tenant_test',envelope,recordedAt:'2026-09-18T19:00:00.000Z'});
 assert.deepEqual(result,{connectionId:'connection_test',storeId:'store_test',tenantId:'tenant_test',status:'connected'});
 const observed=JSON.stringify({result,exchangeInput,persisted: {...persisted,envelope: undefined}});
 assert.doesNotMatch(observed,/refresh-token|private-ciphertext|private-dek/);
});

test('tenant pin mismatch fails closed before encryption or persistence',async()=>{
 let encrypted=false,persisted=false;
 const bootstrap=create({exchangeAuthorizationCode:async()=>({tenantId:'other_tenant',refreshCredential:secret}),encryptRefreshCredential:async()=>{encrypted=true;return envelope},persistConnection:async()=>{persisted=true;return {connectionId:'connection_test'}}});
 await assert.rejects(bootstrap.complete(input),error=>error.message==='Xero staging consent unavailable');
 assert.equal(encrypted,false);assert.equal(persisted,false);
});

test('provider and persistence failures never expose codes, refresh credentials or provider details',async()=>{
 for(const bootstrap of [
 create({exchangeAuthorizationCode:async()=>{throw Error(`provider rejected ${secret}`)}}),
 create({persistConnection:async()=>{throw Error(`database private-ciphertext ${secret}`)}}),
 ]){
  await assert.rejects(bootstrap.complete(input),error=>error.message==='Xero staging consent unavailable'&&!String(error.stack).includes(secret));
 }
});

test('rejects malformed exchanges, envelopes, receipts and callback inputs without calling persistence',async()=>{
 for(const exchange of [
  {tenantId:'tenant_test',refreshCredential:'short'},
  {tenantId:'tenant_test',refreshCredential:secret,accessToken:'forbidden'},
 ])await assert.rejects(create({exchangeAuthorizationCode:async()=>exchange}).complete(input),/unavailable/);
 await assert.rejects(create({encryptRefreshCredential:async()=>({algorithm:'AES-256-GCM',ciphertext:'sealed:a',encryptedDek:'wrapped:a',keyVersion:'staging_v1',extra:true})}).complete(input),/unavailable/);
 await assert.rejects(create({persistConnection:async()=>({connectionId:'connection_test',secret})}).complete(input),/unavailable/);
 await assert.rejects(create().complete({...input,authorizationCode:'short'}),/unavailable/);
});
