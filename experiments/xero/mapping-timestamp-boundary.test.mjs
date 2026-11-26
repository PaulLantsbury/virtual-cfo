import test from 'node:test';
import assert from 'node:assert/strict';
import {validateXeroMappingVersion} from './mapping-version-contract.mjs';
import {parseXeroMappingView} from './mapping-api-contract.mjs';
import {parseSavedXeroMapping,XERO_SAVED_CATEGORIES} from './saved-mapping-view.mjs';
const store='11111111-1111-4111-8111-111111111111';
const mapping={revenue:'sales',processingFee:'fees',advertising:'ads',software:'software',includedCash:'bank'};
const version={versionId:'version-1',storeId:store,tenantId:'tenant-1',effectiveFrom:'2026-09-18',confirmedAt:'2026-09-18T12:00:00Z',confirmedBy:'member-1',mapping};
const view={storeId:store,connectionId:'22222222-2222-4222-8222-222222222222',mappingVersionId:'33333333-3333-4333-8333-333333333333',tenantId:'tenant-1',effectiveFrom:version.effectiveFrom,confirmedAt:version.confirmedAt,mapping,readiness:{available:true,reason:null},shopifyComparison:'not_requested'};
const saved={storeId:store,state:'available',mapping:{version:1,effectiveFrom:'2026-09-01',confirmedAt:'2026-09-01T12:00:00Z',directoryRetrievedAt:'2026-09-01T11:00:00Z',reviewRequired:false,categories:XERO_SAVED_CATEGORIES.map((category,i)=>({category,accounts:[{accountId:`account-${i}`,name:`Synthetic ${i}`,type:category==='includedCash'?'BANK':category==='revenue'?'REVENUE':'EXPENSE',status:'ACTIVE'}]}))}};
test('mapping version and API reject date-only, local and rolled-over confirmation instants',()=>{
 for(const stamp of ['2026-09-18','2026-09-18T12:00:00','2026-09-18T24:00:00Z','2026-02-30T12:00:00Z','2025-02-29T12:00:00Z','2026-09-18T12:00:00+14:01','2026-09-18T12:00:00+15:00']){
  assert.equal(validateXeroMappingVersion({...version,confirmedAt:stamp}),null,stamp);
  assert.equal(parseXeroMappingView({...view,confirmedAt:stamp}),null,stamp);
 }
});
test('saved mapping rejects invalid confirmation/directory instants without broadening UTC-only wire',()=>{
 for(const field of ['confirmedAt','directoryRetrievedAt'])for(const stamp of ['2026-09-18T24:00:00Z','2026-02-30T12:00:00Z','2026-09-18T12:00:00+01:00'])assert.equal(parseSavedXeroMapping({...saved,mapping:{...saved.mapping,[field]:stamp}},store),null,`${field} ${stamp}`);
 assert.ok(parseSavedXeroMapping(saved,store));
});
test('valid bounded instants keep their original confirmation text and exact scopes',()=>{
 for(const stamp of ['2024-02-29T12:00:00Z','2026-09-18T12:00:00.123456Z','2026-09-18T13:00:00+01:00','2026-09-18T12:00:00-14:00']){
  assert.equal(validateXeroMappingVersion({...version,confirmedAt:stamp})?.confirmedAt,stamp);
  assert.equal(parseXeroMappingView({...view,confirmedAt:stamp})?.confirmedAt,stamp);
 }
});
