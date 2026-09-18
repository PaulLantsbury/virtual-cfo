import test from 'node:test';
import assert from 'node:assert/strict';
import {validateXeroAccountMapping,xeroAccountingView} from './account-mapping-contract.mjs';

const mapping=Object.freeze({revenue:'sales',processingFee:'fees',advertising:'ads',software:'software',includedCash:['bank-main','bank-reserve']});
const totals=Object.freeze({sales:10320,fees:-300,ads:-2000,software:-5000,'bank-main':70000,'bank-reserve':30000});

test('maps the five explicitly selected Xero accounting categories by account id',()=>{
 assert.deepEqual(validateXeroAccountMapping(mapping),{revenue:['sales'],processingFee:['fees'],advertising:['ads'],software:['software'],includedCash:['bank-main','bank-reserve']});
 assert.deepEqual(xeroAccountingView({mapping,accountTotals:totals}),{available:true,reason:null,revenue:10320,processingFee:-300,advertising:-2000,software:-5000,includedCash:100000,shopifyComparison:'not_requested'});
});

test('mapping absence makes every accounting value unavailable',()=>{
 assert.deepEqual(xeroAccountingView({accountTotals:totals}),{available:false,reason:'account_mapping_incomplete',revenue:null,processingFee:null,advertising:null,software:null,includedCash:null,shopifyComparison:'not_requested'});
});

test('an incomplete mapping makes every accounting value unavailable',()=>{
 const incomplete={...mapping};delete incomplete.software;
 const result=xeroAccountingView({mapping:incomplete,accountTotals:totals});
 assert.equal(result.available,false);
 assert.deepEqual([result.revenue,result.processingFee,result.advertising,result.software,result.includedCash],[null,null,null,null,null]);
});

test('an overlapping or empty account mapping is rejected',()=>{
 assert.equal(validateXeroAccountMapping({...mapping,advertising:'fees'}),null);
 assert.equal(validateXeroAccountMapping({...mapping,includedCash:[]}),null);
});

test('a missing or non-integer selected account total withholds every value',()=>{
 const missing={...totals};delete missing.ads;
 assert.equal(xeroAccountingView({mapping,accountTotals:missing}).available,false);
 assert.equal(xeroAccountingView({mapping,accountTotals:{...totals,software:1.5}}).available,false);
});

test('the accounting contract does not accept or produce Shopify comparison values',()=>{
 const view=xeroAccountingView({mapping,accountTotals:totals,shopifyNetSales:999999});
 assert.equal('shopifyNetSales' in view,false);
 assert.equal(view.shopifyComparison,'not_requested');
});
