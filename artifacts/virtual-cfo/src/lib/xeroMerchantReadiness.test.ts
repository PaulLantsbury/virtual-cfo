import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXeroMerchantReadiness, xeroMerchantReadinessView } from './xeroMerchantReadiness.ts';

const connection={status:'active',scopeVersion:'read-only-v1',createdAt:'2026-09-18T12:00:00.000Z',lastSuccessAt:null,lastFailureAt:null,mappingReviewRequired:false};
const ready={storeId:'store_1',connection,evidenceState:'ready',evidenceRetrievedAt:'2026-09-18T12:00:00.000Z'};

test('merchant readiness accepts only exact value-free same-store views',()=>{
 const parsed=parseXeroMerchantReadiness(ready);
 assert.equal(parsed?.evidenceState,'ready');assert.equal(Object.isFrozen(parsed),true);
 for(const unsafe of [{...ready,amount:100},{...ready,evidenceRetrievedAt:null},{...ready,connection:{...connection,tenantId:'secret'}},{...ready,evidenceState:'unknown'}])assert.equal(parseXeroMerchantReadiness(unsafe),null);
});

test('merchant readiness fails closed until enabled, mapped and supported',()=>{
 assert.equal(xeroMerchantReadinessView(parseXeroMerchantReadiness(ready),false).canUseAccountingEvidence,false);
 assert.equal(xeroMerchantReadinessView(null,true).canUseAccountingEvidence,false);
 assert.equal(xeroMerchantReadinessView(parseXeroMerchantReadiness({...ready,evidenceState:'stale',evidenceRetrievedAt:null}),true).canUseAccountingEvidence,false);
 assert.equal(xeroMerchantReadinessView(parseXeroMerchantReadiness(ready),true).canUseAccountingEvidence,true);
});

test('first refresh pending and failure are distinguished without expanding the API contract',()=>{
 const pending=xeroMerchantReadinessView(parseXeroMerchantReadiness({...ready,evidenceState:'unavailable',evidenceRetrievedAt:null}),true);
 assert.match(pending.title,/waiting to start/i);assert.equal(pending.canUseAccountingEvidence,false);
 const failed=xeroMerchantReadinessView(parseXeroMerchantReadiness({...ready,connection:{...connection,lastFailureAt:'2026-09-18T13:00:00.000Z'},evidenceState:'unavailable',evidenceRetrievedAt:null}),true);
 assert.match(failed.title,/did not complete/i);assert.equal(failed.canUseAccountingEvidence,false);
});

test('readiness messages do not disclose financial amounts',()=>{
 for(const state of ['checking','ready','stale','review_required','unavailable','denied'] as const){
  const value=parseXeroMerchantReadiness({...ready,evidenceState:state,evidenceRetrievedAt:state==='ready'?'2026-09-18T12:00:00.000Z':null});
  assert.doesNotMatch(xeroMerchantReadinessView(value,true).detail,/£|USD|GBP|revenue|balance/i);
 }
});
