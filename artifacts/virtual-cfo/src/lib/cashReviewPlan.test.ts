import test from 'node:test';import assert from 'node:assert/strict';
import {buildCashDemo} from './cashDemoModel.ts';
import {cashReviewPlanKey,createCashReviewPlan,readCashReviewPlan,writeCashReviewPlan,clearCashReviewPlan} from './cashReviewPlan.ts';
const now=new Date('2026-10-15T12:00:00Z'),model=buildCashDemo(),key=cashReviewPlanKey('user','store');
const memory=()=>{const rows=new Map<string,string>();return {getItem:(k:string)=>rows.get(k)??null,setItem:(k:string,v:string)=>{rows.set(k,v);},removeItem:(k:string)=>{rows.delete(k);}};};
test('cash sample action survives reload, freezes baseline and supports done/reopen/clear',()=>{
 const store=memory(),p=createCashReviewPlan('stock-order',' Paul ','2026-10-20',model,now);writeCashReviewPlan(store,key,p);
 const restored=readCashReviewPlan(store,key)!;assert.equal(restored.owner,'Paul');assert.equal(restored.baseline.currentCash,model.currentCash);assert.equal(restored.baseline.lowestCash,model.lowestForecast.balance);
 writeCashReviewPlan(store,key,{...restored,status:'done'});assert.equal(readCashReviewPlan(store,key)!.status,'done');writeCashReviewPlan(store,key,{...restored,status:'planned'});assert.equal(readCashReviewPlan(store,key)!.status,'planned');
 assert.equal(restored.baseline.minimumBuffer,model.minimumBuffer);clearCashReviewPlan(store,key);assert.equal(readCashReviewPlan(store,key),null);
});
test('verified scope keys isolate stores/users; invalid actions, dates, owner and unsafe pence refuse',()=>{
 assert.notEqual(key,cashReviewPlanKey('user2','store'));assert.notEqual(key,cashReviewPlanKey('user','store2'));assert.throws(()=>cashReviewPlanKey('','store'));
 for(const args of [['wrong','Me','2026-10-20'],['overheads','','2026-10-20'],['overheads','x'.repeat(81),'2026-10-20'],['overheads','Me','2026-10-15'],['overheads','Me','2026-02-30']])assert.throws(()=>createCashReviewPlan(args[0] as 'overheads',args[1],args[2],model,now));
 assert.throws(()=>createCashReviewPlan('overheads','Me','2026-10-20',{...model,currentCash:Infinity},now));
});
test('corrupt, oversized and storage failures surface instead of silently succeeding',()=>{
 const s=memory();s.setItem(key,'{');assert.throws(()=>readCashReviewPlan(s,key));s.setItem(key,'x'.repeat(8193));assert.throws(()=>readCashReviewPlan(s,key));
 const p=createCashReviewPlan('supplier-deferral','Me','2026-10-20',model,now);s.setItem(key,JSON.stringify({...p,baseline:{...p.baseline,lowestCash:1.5}}));assert.throws(()=>readCashReviewPlan(s,key));
 assert.throws(()=>writeCashReviewPlan({...s,setItem:()=>{throw Error('quota');}},key,p));assert.throws(()=>clearCashReviewPlan({...s,removeItem:()=>{throw Error('denied');}},key));
});
