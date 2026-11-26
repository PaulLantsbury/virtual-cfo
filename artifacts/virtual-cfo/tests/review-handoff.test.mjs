import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewHandoff,advanceReviewHandoff,cancelReviewHandoff,createReviewNavigationOwnership} from '../src/lib/reviewHandoff.ts';
const search='?reviewStore=business-a&reviewFrom=2026-10-01&reviewTo=2026-10-31&reviewVersion=oct-reviewed&compareFrom=2026-09-01&compareTo=2026-09-30&compareVersion=sep-reviewed';
const months=[{from:'2026-09-01',to:'2026-09-30',snapshotId:'sep-reviewed',versionId:'sep-reviewed',versions:[{versionId:'sep-reviewed',status:'selected',kind:'base'}]},{from:'2026-10-01',to:'2026-10-31',snapshotId:'oct-reviewed',versionId:'oct-reviewed',versions:[{versionId:'oct-reviewed',status:'selected',kind:'base'},{versionId:'oct-correction',status:'selected',kind:'expense-correction'}]}];
const context={userId:'user-a',storeId:'business-a',availabilityReady:true,months};
test('current and comparison roles seed only their exact selected month/version',()=>{
 const current=advanceReviewHandoff(createReviewHandoff(search,'current'),context),previous=advanceReviewHandoff(createReviewHandoff(search,'comparison'),context);
 assert.deepEqual(current.choice,{from:'2026-10-01',to:'2026-10-31',versionId:'oct-reviewed'});assert.deepEqual(previous.choice,{from:'2026-09-01',to:'2026-09-30',versionId:'sep-reviewed'});assert.equal(current.state.phase,'applied');assert.equal(previous.state.phase,'applied');
 assert.equal(advanceReviewHandoff(createReviewHandoff(search),context).choice,null);
});
test('availability and authentication must complete before an exact scoped handoff can be consumed',()=>{
 const initial=createReviewHandoff(search,'current');const signedOut=advanceReviewHandoff(initial,{...context,userId:null});assert.equal(signedOut.choice,null);assert.equal(signedOut.state.owner,null);
 const loading=advanceReviewHandoff(initial,{...context,availabilityReady:false,months:[]});assert.equal(loading.choice,null);assert.equal(loading.state.phase,'pending');assert.deepEqual(loading.state.owner,{userId:'user-a',storeId:'business-a'});
 const result=advanceReviewHandoff(loading.state,context);assert.equal(result.choice.versionId,'oct-reviewed');
});
test('the candidate never switches the active business or uses another company’s available data',()=>{
 const r=advanceReviewHandoff(createReviewHandoff(search,'current'),{...context,storeId:'business-b'});assert.equal(r.choice,null);assert.equal(r.state.phase,'rejected');assert.match(r.warning,/different company/);
 const back=advanceReviewHandoff(r.state,context);assert.equal(back.choice,null);assert.equal(back.state.phase,'cancelled');
});
test('withdrawn, missing and replacement versions never become implicit latest evidence',()=>{
 for(const invalidMonths of [[],months.map(m=>({...m,versions:m.versions.map(v=>({...v,status:'invalidated'}))})),months.map(m=>m.from==='2026-10-01'?{...m,versions:[{versionId:'oct-correction',status:'selected',kind:'expense-correction'}]}:m)]){
  const r=advanceReviewHandoff(createReviewHandoff(search,'current'),{...context,months:invalidMonths});assert.equal(r.choice,null);assert.equal(r.state.phase,'rejected');assert.match(r.warning,/Choose a month and check the report again/);
 }
 const rejected=advanceReviewHandoff(createReviewHandoff(search,'current'),{...context,months:[]});assert.equal(advanceReviewHandoff(rejected.state,context).choice,null);
});
test('comparison requires the linked current evidence to remain available and never seeds from review fields alone',()=>{
 assert.equal(createReviewHandoff(search.split('&compareFrom')[0],'comparison').phase,'none');
 const missingCurrent=months.filter(m=>m.from!=='2026-10-01');assert.equal(advanceReviewHandoff(createReviewHandoff(search,'comparison'),{...context,months:missingCurrent}).choice,null);
 const changedCurrent=search.replace('reviewVersion=oct-reviewed','reviewVersion=missing');assert.equal(advanceReviewHandoff(createReviewHandoff(changedCurrent,'comparison'),context).choice,null);
});
test('manual month/version choice cancels a pending or applied handoff for this mounted recipient',()=>{
 const initial=createReviewHandoff(search,'current');const loading=advanceReviewHandoff(initial,{...context,availabilityReady:false});const manual=cancelReviewHandoff(loading.state);assert.equal(advanceReviewHandoff(manual,context).choice,null);assert.equal(manual.warning,null);
 const applied=advanceReviewHandoff(initial,context),cancelled=cancelReviewHandoff(applied.state);assert.equal(advanceReviewHandoff(cancelled,context).choice,null);assert.equal(advanceReviewHandoff(applied.state,context).choice,null);
});
test('sign-out, user change or company change cancels replay even after returning to the original account/company',()=>{
 for(const changed of [{...context,userId:null},{...context,userId:'user-b'},{...context,storeId:'business-b'}]){
  for(const applied of [false,true]){const initial=advanceReviewHandoff(createReviewHandoff(search,'current'),{...context,availabilityReady:applied});const swapped=advanceReviewHandoff(initial.state,changed);assert.equal(swapped.state.phase,'cancelled');assert.equal(swapped.choice,null);assert.equal(advanceReviewHandoff(swapped.state,context).choice,null);}
 }
});
test('malformed, ambiguous, partial or non-month dates are visibly rejected rather than guessed',()=>{
 for(const bad of [search+'&reviewVersion=oct-correction',search.replace('2026-10-31','2026-10-30'),search.replace('reviewFrom=2026-10-01','reviewFrom=2026-02-30'),search.replace('reviewStore=business-a&',''),search.replace('reviewVersion=oct-reviewed&',''),search.replace('reviewFrom=2026-10-01','reviewFrom=2026-10-02'),search.replace('reviewVersion=oct-reviewed','reviewVersion=')]){
  const state=createReviewHandoff(bad,'current'),r=advanceReviewHandoff(state,context);assert.equal(r.choice,null);assert.equal(r.state.phase,'rejected');assert.ok(r.warning);
 }
 const overlap=search.replace('compareFrom=2026-09-01&compareTo=2026-09-30','compareFrom=2026-10-01&compareTo=2026-10-31');assert.equal(createReviewHandoff(overlap,'comparison').phase,'rejected');
});
test('a single-version availability record can match exactly; explicit selection is never fabricated',()=>{
 const single=months.map(m=>{const {versions,...rest}=m;return rest;});const r=advanceReviewHandoff(createReviewHandoff(search,'current'),{...context,months:single});assert.equal(r.choice.versionId,'oct-reviewed');
 const none=single.map(m=>({...m,versionId:undefined}));assert.equal(advanceReviewHandoff(createReviewHandoff(search,'current'),{...context,months:none}).choice,null);
});

test('a deliberate reload/new mount revalidates the preserved bookmarked URL rather than trusting old state',()=>{const initial=advanceReviewHandoff(createReviewHandoff(search,'current'),context);assert.equal(initial.choice.versionId,'oct-reviewed');const manual=cancelReviewHandoff(initial.state);assert.equal(advanceReviewHandoff(manual,context).choice,null);const reload=advanceReviewHandoff(createReviewHandoff(search,'current'),context);assert.equal(reload.choice.versionId,'oct-reviewed');const invalidated=months.map(m=>({...m,versions:m.versions.map(v=>({...v,status:'invalidated'}))}));assert.equal(advanceReviewHandoff(createReviewHandoff(search,'current'),{...context,months:invalidated}).choice,null);});


test('navigation ownership survives keyed child remount and cannot replay after company or account change',()=>{
 const owners=createReviewNavigationOwnership(),url='/profit-engine'+search;
 assert.equal(owners.allows(url,context.userId,context.storeId),false);
 assert.equal(owners.register(url,context.userId,context.storeId),true);
 assert.equal(owners.register(url,context.userId,context.storeId),true,'current and comparison share owner');
 assert.equal(advanceReviewHandoff(createReviewHandoff(search,'current'),context).choice.versionId,'oct-reviewed');
 assert.equal(owners.register(url,context.userId,'business-b'),false);
 const remounted=createReviewHandoff(search,'current');
 assert.equal(remounted.phase,'pending');
 assert.equal(owners.register(url,context.userId,context.storeId),false,'fresh hook cannot re-arm URL');
 assert.equal(owners.allows(url,context.userId,context.storeId),false);
 const second='/cash'+search;owners.register(second,context.userId,context.storeId);assert.equal(owners.register(second,'user-b',context.storeId),false);assert.equal(owners.register(second,context.userId,context.storeId),false);
});
test('ownership registry memory bound rejects new hints without evicting old revoked records',()=>{
 const owners=createReviewNavigationOwnership(1);
 assert.equal(owners.register('first','a','one'),true);assert.equal(owners.register('second','a','one'),false);
 owners.register('first','a','two');assert.equal(owners.register('first','a','one'),false);
 assert.equal(owners.allows('second','a','one'),false);
});


test('any duplicated recognized context key and oversized URLs reject receiving roles visibly',()=>{
 for(const suffix of ['&compareVersion=sep-reviewed','&compareFrom=2026-09-01','&reviewStore=business-a']){
  const state=createReviewHandoff(search+suffix,'current');assert.equal(state.phase,'rejected');assert.ok(state.warning);assert.equal(advanceReviewHandoff(state,context).choice,null);
 }
 const long=createReviewHandoff(search+'&padding='+'x'.repeat(8192),'current');assert.equal(long.phase,'rejected');assert.ok(long.warning);
 assert.equal(createReviewHandoff(search+'&padding='+'x'.repeat(8192),'none').phase,'none');
 const partial=createReviewHandoff('?reviewStore=business-a&reviewFrom=2026-10-01&reviewTo=2026-10-31&reviewVersion=oct-reviewed&compareFrom=2026-09-01','current');assert.equal(partial.phase,'pending','unrelated partial comparison does not invalidate a complete current scope');
});
