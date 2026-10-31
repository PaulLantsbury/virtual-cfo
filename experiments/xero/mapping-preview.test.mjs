import test from 'node:test';
import assert from 'node:assert/strict';
import {buildXeroMappingPreview,readLocalXeroAccountDirectory,readLocalXeroEvidenceHeader} from './mapping-preview.mjs';

const accounts=[
 {id:'sales',name:'Sales',type:'REVENUE',status:'ACTIVE'},
 {id:'shipping',name:'Shipping revenue',type:'REVENUE',status:'ACTIVE'},
 {id:'fees',name:'Bank Fees',type:'OVERHEADS',status:'ACTIVE'},
 {id:'ads',name:'Advertising & Marketing',type:'OVERHEADS',status:'ACTIVE'},
 {id:'software',name:'IT Software',type:'OVERHEADS',status:'ACTIVE'},
 {id:'bank',name:'Test Bank 1',type:'BANK',status:'ACTIVE'},
 {id:'bank2',name:'Test Bank 2',type:'BANK',status:'ACTIVE'}
];
const mapping={revenue:['sales','shipping'],processingFee:'fees',advertising:'ads',software:'software',includedCash:['bank','bank2']};

test('builds a value-free owner-confirmed mapping preview',()=>{
 const preview=buildXeroMappingPreview({accounts,mapping});
 assert.equal(preview.mappingStatus,'owner_confirmed_local_test');
 assert.deepEqual(preview.categories.find(item=>item.category==='revenue').confirmed.map(item=>item.name),['Sales','Shipping revenue']);
 assert.equal(preview.categories.find(item=>item.category==='processingFee').suggestion.candidates[0].accountName,'Bank Fees');
 assert.equal(JSON.stringify(preview).includes('amount'),false);
});
test('refuses an archived or missing confirmed account',()=>{
 assert.throws(()=>buildXeroMappingPreview({accounts:[...accounts.slice(0,-1),{...accounts.at(-1),status:'ARCHIVED'}],mapping}));
});
test('reads only the expected redacted directory shape',async()=>{
 const directory=await readLocalXeroAccountDirectory('/tmp/xero.json',{fs:{readFile:async()=>JSON.stringify({source:'xero',tenantId:'tenant',retrievedAt:'2026-09-18T12:00:00.000Z',accounts})}});
 assert.equal(directory.accounts.length,7);
 await assert.rejects(readLocalXeroAccountDirectory('/tmp/xero.json',{fs:{readFile:async()=>JSON.stringify({source:'xero',tenantId:'tenant',retrievedAt:'2026-09-18T12:00:00.000Z',accounts:[{...accounts[0],balance:100}]})}}));
});
test('reads a value-free completed-test evidence header',async()=>{
 const evidence={source:'xero',tenantId:'tenant',reportDate:'2026-09-18',retrievedAt:'2026-09-18T12:00:00.000Z',baseCurrency:'GBP',reports:{profitAndLoss:'Profit and Loss',balanceSheet:'Balance Sheet',trialBalance:'Trial Balance',bankSummary:'Bank Summary'},shopifyComparison:'not_requested'};
 const header=await readLocalXeroEvidenceHeader('/tmp/xero-evidence.json',{fs:{readFile:async()=>JSON.stringify(evidence)}});
 assert.deepEqual(header,{source:'xero',reportDate:'2026-09-18',retrievedAt:'2026-09-18T12:00:00.000Z',baseCurrency:'GBP',reports:evidence.reports,shopifyComparison:'not_requested'});
 await assert.rejects(readLocalXeroEvidenceHeader('/tmp/xero-evidence.json',{fs:{readFile:async()=>JSON.stringify({...evidence,amount:1})}}));
});
