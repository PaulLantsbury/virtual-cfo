import test from 'node:test';
import assert from 'node:assert/strict';
import {assessXeroMappingReadiness} from './mapping-readiness.mjs';

const accounts=[
 {id:'sales',name:'Sales',type:'REVENUE',status:'ACTIVE'},
 {id:'fees',name:'Bank Fees',type:'OVERHEADS',status:'ACTIVE'},
 {id:'ads',name:'Advertising',type:'OVERHEADS',status:'ACTIVE'},
 {id:'software',name:'Software',type:'OVERHEADS',status:'ACTIVE'},
 {id:'bank',name:'Bank',type:'BANK',status:'ACTIVE'}
];
const mapping={revenue:'sales',processingFee:'fees',advertising:'ads',software:'software',includedCash:'bank'};

test('accepts only a complete mapping of active current accounts',()=>{
 assert.deepEqual(assessXeroMappingReadiness({accounts,mapping}),{available:true,reason:null,shopifyComparison:'not_requested'});
});
test('requires review when a confirmed account disappears or becomes inactive',()=>{
 assert.deepEqual(assessXeroMappingReadiness({accounts:accounts.filter(account=>account.id!=='ads'),mapping}),{available:false,reason:'mapped_account_missing',shopifyComparison:'not_requested'});
 assert.deepEqual(assessXeroMappingReadiness({accounts:accounts.map(account=>account.id==='bank'?{...account,status:'ARCHIVED'}:account),mapping}),{available:false,reason:'mapped_account_inactive',shopifyComparison:'not_requested'});
});
test('does not infer an incomplete mapping or accept Shopify input',()=>{
 assert.deepEqual(assessXeroMappingReadiness({accounts,mapping:{...mapping,software:[]},shopifyNetSales:12300}),{available:false,reason:'account_mapping_incomplete',shopifyComparison:'not_requested'});
});
