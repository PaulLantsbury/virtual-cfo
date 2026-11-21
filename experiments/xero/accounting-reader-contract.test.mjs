import test from 'node:test';
import assert from 'node:assert/strict';
import {readXeroAccountingPeriod} from './accounting-reader-contract.mjs';

const scope={from:'2026-09-01',to:'2026-09-30',currency:'GBP'};
const mapping={ready:true,revenue:['r'],processingFee:['f'],advertising:['a'],software:['s'],includedCash:['c']};
const supported={state:'supported',scope,asOf:'2026-10-01',values:{revenue:12000,processingFee:-300,advertising:-2000,software:-500,includedCash:9200}};

test('reads separate Xero accrual accounting and dated cash from supported same-scope evidence',()=>{
 const result=readXeroAccountingPeriod({scope,mapping,source:supported});
 assert.equal(result.available,true);assert.equal(result.accounting.basis,'accrual_p_and_l');assert.equal(result.accounting.bookedRevenue,12000);assert.equal(result.cash.basis,'dated_unrestricted_balance');assert.equal(result.cash.includedBalance,9200);assert.equal(result.shopifyComparison,'not_requested');
});

test('never blends Shopify or cash with the accounting period',()=>{
 const result=readXeroAccountingPeriod({scope,mapping,source:{...supported,shopifyRevenue:999999}});
 assert.equal(result.available,true);assert.equal(JSON.stringify(result).includes('999999'),false);assert.equal(result.accounting.period.to,'2026-09-30');
});

test('failed, invalidated, foreign-scope and incomplete evidence withhold every accounting result',()=>{
 for(const source of [{...supported,state:'failed'},{...supported,state:'invalidated'},{...supported,scope:{...scope,currency:'USD'}},{...supported,values:{...supported.values,software:null}}]){
  const result=readXeroAccountingPeriod({scope,mapping,source});assert.equal(result.available,false);assert.equal(result.accounting,null);assert.equal(result.cash,null);
 }
 assert.equal(readXeroAccountingPeriod({scope,mapping:{...mapping,ready:false},source:supported}).reason,'account_mapping_review_required');
});
