import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXeroMerchantConnection, xeroMerchantSetupState} from './xeroMerchantConnection.ts';

const connection={id:'connection_1',storeId:'store_1',tenantId:'tenant_1',status:'active',scopeVersion:'read-only-v1',createdAt:'2026-09-18T12:00:00.000Z',lastSuccessAt:null,lastFailureAt:null,mappingReviewRequired:true};

test('merchant connection parser only accepts value-free, exact read-only connection views',()=>{
 const parsed=parseXeroMerchantConnection(connection);
 assert.equal(parsed?.status,'active');assert.equal(Object.isFrozen(parsed),true);
 for(const unsafe of [{...connection,token:'secret'},{...connection,scopeVersion:'write-v1'},{...connection,status:'unknown'},{...connection,lastSuccessAt:'not-a-time'}])assert.equal(parseXeroMerchantConnection(unsafe),null);
});

test('connection setup states stay disabled until an environment explicitly enables merchant flow',()=>{
 const disabled=xeroMerchantSetupState(parseXeroMerchantConnection(connection),false);
 assert.equal(disabled.canStartConnection,false);assert.equal(disabled.canReviewMapping,false);
 const review=xeroMerchantSetupState(parseXeroMerchantConnection(connection),true);
 assert.equal(review.canReviewMapping,true);assert.equal(review.canStartConnection,false);
 const reconnect=xeroMerchantSetupState({...connection,status:'reauthorization_required'},true);
 assert.equal(reconnect.canStartConnection,true);assert.equal(reconnect.canReviewMapping,false);
});
