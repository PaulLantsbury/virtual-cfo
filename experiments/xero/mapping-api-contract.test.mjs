import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXeroMappingView,validXeroMappingConfirmation} from './mapping-api-contract.mjs';
const ids={storeId:'10000000-0000-4000-8000-000000000001',connectionId:'20000000-0000-4000-8000-000000000001',mappingVersionId:'30000000-0000-4000-8000-000000000001'};
const mapping={revenue:'sales',processingFee:'fees',advertising:'ads',software:'software',includedCash:'bank'};
test('accepts a narrow confirmation command without actor, tenant, values or Shopify input',()=>{
 const {mappingVersionId,...commandIds}=ids;
 assert.equal(validXeroMappingConfirmation({...commandIds,effectiveFrom:'2026-09-18',mapping}),true);
 assert.equal(validXeroMappingConfirmation({...commandIds,effectiveFrom:'2026-09-18',mapping,confirmedBy:'forged'}),false);
});
test('parses only a value-free separate-source mapping view',()=>{
 const view=parseXeroMappingView({...ids,tenantId:'tenant-1',effectiveFrom:'2026-09-18',confirmedAt:'2026-09-18T12:00:00Z',mapping,readiness:{available:true,reason:null},shopifyComparison:'not_requested'});
 assert.ok(view);assert.equal(JSON.stringify(view).match(/amount|balance|token|shopifyNet/i),null);
 assert.equal(parseXeroMappingView({...view,amount:100}),null);
});
