import test from 'node:test';import assert from 'node:assert/strict';
import {cashReviewPlanKey,createCashReviewPlan,readCashReviewPlan,writeCashReviewPlan,clearCashReviewPlan,describeCashReviewChange,type CashReviewSnapshot} from './cashReviewPlan.ts';
const now=new Date('2026-10-15T12:00:00Z'),model:CashReviewSnapshot={asOf:'2026-10-11',currentCash:18600000,minimumBuffer:5000000,horizonDays:42,lowestCash:800000,lowestDate:'2026-11-01',forecastStatus:'Incomplete',gaps:['Future stock commitments not reviewed']},key=cashReviewPlanKey('user','store');
const memory=()=>{const rows=new Map<string,string>();return {getItem:(k:string)=>rows.get(k)??null,setItem:(k:string,v:string)=>{rows.set(k,v);},removeItem:(k:string)=>{rows.delete(k);}};};
test('review freezes dates, buffer and gaps, supports reload/done/reopen/clear',()=>{
 const s=memory(),p=createCashReviewPlan('check-commitments',' Paul ','2026-10-20',model,now);writeCashReviewPlan(s,key,p);
 model.gaps.push('Later edit');assert.equal(p.baseline.gaps.length,1);model.gaps.pop();
 const r=readCashReviewPlan(s,key)!;assert.equal(r.owner,'Paul');assert.equal(r.baseline.horizonDays,42);assert.equal(r.baseline.currentCash,18600000);
 for(const status of ['done','planned'] as const){writeCashReviewPlan(s,key,{...r,status});assert.equal(readCashReviewPlan(s,key)!.status,status);}
 clearCashReviewPlan(s,key);assert.equal(readCashReviewPlan(s,key),null);
});
test('missing forecast stays unavailable, requires matching nullable date',()=>{
 const p=createCashReviewPlan('check-settlements','Me','2026-10-20',{...model,lowestCash:null,lowestDate:null},now);assert.equal(p.baseline.lowestCash,null);
 assert.throws(()=>createCashReviewPlan('check-stock','Me','2026-10-20',{...model,lowestCash:null},now));
 assert.throws(()=>createCashReviewPlan('check-stock','Me','2026-10-20',{...model,lowestDate:'2027-01-01'},now));
});
test('scope isolation; rejects old version/action, unsafe money, bad dates and malformed gaps',()=>{
 assert.notEqual(key,cashReviewPlanKey('user2','store'));assert.notEqual(key,cashReviewPlanKey('user','store2'));assert.throws(()=>cashReviewPlanKey('','store'));
 const s=memory(),p=createCashReviewPlan('check-stock','Me','2026-10-20',model,now);s.setItem(key,JSON.stringify({...p,version:1,actionId:'stock-order'}));assert.throws(()=>readCashReviewPlan(s,key),/older/);
 for(const patch of [{currentCash:Infinity},{minimumBuffer:-1},{lowestCash:1.5},{horizonDays:0},{gaps:[null]},{forecastStatus:''}])assert.throws(()=>createCashReviewPlan('check-stock','Me','2026-10-20',{...model,...patch} as CashReviewSnapshot,now));
 assert.throws(()=>createCashReviewPlan('check-stock','','2026-10-20',model,now));assert.throws(()=>createCashReviewPlan('check-stock','Me','2026-10-15',model,now));assert.throws(()=>createCashReviewPlan('check-stock','Me','2026-02-30',model,now));
});
test('comparisons need a later saved snapshot; do not claim action outcomes',()=>{
 assert.match(describeCashReviewChange(model,{...model,currentCash:999}),/no later cash snapshot/);
 assert.match(describeCashReviewChange(model,{...model,asOf:'2026-10-12',currentCash:18500000}),/£1,000 lower/);
 assert.match(describeCashReviewChange(model,{...model,asOf:'2026-10-12'}),/does not attribute/);
});
test('corrupt, oversized and storage errors surface',()=>{
 const s=memory();s.setItem(key,'{');assert.throws(()=>readCashReviewPlan(s,key));s.setItem(key,'x'.repeat(16385));assert.throws(()=>readCashReviewPlan(s,key));
 const p=createCashReviewPlan('check-stock','Me','2026-10-20',model,now);assert.throws(()=>writeCashReviewPlan({...s,setItem:()=>{throw Error('quota');}},key,p));assert.throws(()=>clearCashReviewPlan({...s,removeItem:()=>{throw Error('denied');}},key));
});
