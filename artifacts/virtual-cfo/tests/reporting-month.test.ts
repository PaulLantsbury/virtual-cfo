import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHistoryMonthVersion,reportingMonthLabel} from '../src/lib/reportingMonth.ts';
import {advanceReviewHandoff,createReviewHandoff} from '../src/lib/reviewHandoff.ts';
const base={from:'2026-10-01',to:'2026-10-31',snapshotId:'base'};
const versions=[{versionId:'base',status:'selected' as const,kind:'base' as const},{versionId:'correction',status:'selected' as const,kind:'expense-correction' as const}];
test('declared validated server head wins without consulting array order',()=>{
 for(const order of [versions,[...versions].reverse()])assert.equal(resolveHistoryMonthVersion({...base,snapshotId:'correction',versionId:'correction',requiresExplicitSelection:true,versions:order}).versionId,'correction');
});
test('unique selected candidate can resolve when server omits a declared head',()=>{
 assert.equal(resolveHistoryMonthVersion({...base,versions:[versions[0],{...versions[1],status:'invalidated'}]}).versionId,'base');
});
test('multiple selected candidates never choose first/newest or snapshot fallback',()=>{
 for(const order of [versions,[...versions].reverse()])assert.equal(resolveHistoryMonthVersion({...base,versions:order}).versionId,'');
 assert.equal(resolveHistoryMonthVersion(base).versionId,'');
});
test('declared withdrawn/missing/conflicting head never falls back to another selected candidate',()=>{
 for(const m of [{...base,versionId:'gone',versions},{...base,versionId:'correction',versions},{...base,versionId:'base',versions:[{...versions[0],status:'invalidated' as const},versions[1]]}])assert.equal(resolveHistoryMonthVersion(m).versionId,'');
});
test('empty and duplicate candidate lists withhold',()=>{
 for(const m of [undefined,{...base,versions:[]},{...base,versions:[versions[0],versions[0]]}])assert.equal(resolveHistoryMonthVersion(m).versionId,'');
});
test('compact month labels retain calendar month and year',()=>{
 assert.equal(reportingMonthLabel('2026-10-01'),'Oct 2026');assert.equal(reportingMonthLabel('2025-01-01'),'Jan 2025');
 for(const bad of ['2026-13-01','2026-10-02','Oct 2026',''])assert.equal(reportingMonthLabel(bad),'Month unavailable');
});
test('explicit compatible linked version remains exact even with alternative candidates',()=>{
 const state=createReviewHandoff('?reviewStore=store&reviewFrom=2026-10-01&reviewTo=2026-10-31&reviewVersion=base','current');
 assert.equal(advanceReviewHandoff(state,{userId:'user',storeId:'store',availabilityReady:true,months:[{...base,versions}]}).choice?.versionId,'base');
});
test('withdrawn URL version does not fall forward to declared replacement or across company',()=>{
 const state=createReviewHandoff('?reviewStore=store&reviewFrom=2026-10-01&reviewTo=2026-10-31&reviewVersion=base','current');
 const months=[{...base,snapshotId:'correction',versionId:'correction',versions:[{...versions[0],status:'invalidated' as const},versions[1]]}];
 assert.equal(advanceReviewHandoff(state,{userId:'user',storeId:'store',availabilityReady:true,months}).choice,null);
 assert.equal(advanceReviewHandoff(state,{userId:'user',storeId:'other',availabilityReady:true,months}).choice,null);
});
