import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestXeroAccountMappings} from './account-mapping-suggestions.mjs';
const accounts=[
 {id:'sales',name:'Sales',type:'REVENUE',status:'ACTIVE'},
 {id:'shipping',name:'Shipping revenue',type:'SALES',status:'ACTIVE'},
 {id:'fees',name:'Bank Fees',type:'OVERHEADS',status:'ACTIVE'},
 {id:'ads',name:'Advertising & Marketing',type:'OVERHEADS',status:'ACTIVE'},
 {id:'software',name:'IT Software and Consumables',type:'OVERHEADS',status:'ACTIVE'},
 {id:'audit',name:'Audit & Accountancy fees',type:'OVERHEADS',status:'ACTIVE'},
 {id:'bank',name:'Test Bank 1',type:'BANK',status:'ACTIVE'},
 {id:'old-ads',name:'Advertising',type:'OVERHEADS',status:'ARCHIVED'}
];
test('suggests review-only mappings with explainable confidence',()=>{
 const out=suggestXeroAccountMappings(accounts);
 assert.deepEqual(out.revenue.candidates.map(x=>x.accountId),['sales','shipping']);
 assert.equal(out.processingFee.candidates[0].accountId,'fees');assert.equal(out.processingFee.candidates[0].confidence,'high');
 assert.equal(out.advertising.candidates[0].accountId,'ads');assert.equal(out.software.candidates[0].accountId,'software');assert.equal(out.includedCash.candidates[0].accountId,'bank');
 assert.equal(out.software.candidates.some(x=>x.accountId==='audit'),false);assert.equal(out.includedCash.candidates.some(x=>x.accountId==='fees'),false);
 assert.equal(out.advertising.requiresReview,true);assert.equal('mapping' in out.advertising,false);
});
test('excludes archived accounts, exposes ambiguity and fails closed on malformed input',()=>{
 const ambiguous=suggestXeroAccountMappings([{id:'a',name:'Advertising',type:'OVERHEADS',status:'ACTIVE'},{id:'b',name:'Advertising',type:'OVERHEADS',status:'ACTIVE'}]);
 assert.equal(ambiguous.advertising.status,'ambiguous');assert.equal(ambiguous.processingFee.status,'no_suggestion');
 assert.throws(()=>suggestXeroAccountMappings([{id:'x',name:'Bad',type:'BANK'}]),/unavailable/);
});
