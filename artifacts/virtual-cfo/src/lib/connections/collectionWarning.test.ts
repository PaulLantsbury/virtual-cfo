import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionWarning, type ConnectionStatus} from './shopifyStatus.ts';
const base:ConnectionStatus={state:'available',storeId:'s',latestAttempt:null,latestSuccessfulCollection:null,candidate:{state:'not_assessed',from:null,to:null,orderCount:null,refundCount:null,mappedEventCount:null,testExcludedCount:null},financialVerification:'not_assessed'};
test('no collection or unresolved attempts cannot imply fresh financial figures',()=>{
 assert.match(collectionWarning(base)!,/freshness is unknown/);
 for(const state of ['running','unconfirmed'] as const){const value={...base,latestAttempt:{state,from:'2026-09-17',to:'2026-09-17',startedAt:'2026-09-18T01:00:00Z',finishedAt:null,resultCode:null}};assert.ok(collectionWarning(value));}
 assert.equal(collectionWarning({...base,state:'not_configured'}),null);
});
test('successful collection does not warn or certify; refused/historical results warn even with prior success',()=>{
 for(const resultCode of ['replay','changed_requires_review','recorded_requires_review','historical_replay','missing_source','stale_source','conflicting_source']){
 const value:ConnectionStatus={...base,latestAttempt:{state:'completed',from:'2026-09-17',to:'2026-09-17',startedAt:'2026-09-18T01:00:00Z',finishedAt:'2026-09-18T01:01:00Z',resultCode},latestSuccessfulCollection:{finishedAt:'2026-09-17T01:01:00Z',from:'2026-09-16',to:'2026-09-16',resultCode:'replay'}};
 const snapshot=JSON.stringify(value);assert.equal(collectionWarning(value)!==null,['historical_replay','missing_source','stale_source','conflicting_source'].includes(resultCode));assert.equal(JSON.stringify(value),snapshot);
 }
});
