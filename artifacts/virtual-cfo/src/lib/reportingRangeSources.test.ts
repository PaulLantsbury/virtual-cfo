import test from 'node:test';
import assert from 'node:assert/strict';
import {reportingRangeSources} from './reportingRangeSources.ts';
import type {HistoryAvailability} from './v11/history-supported.ts';
function source(from:string,id='selected-'+from):HistoryAvailability['months'][number]{
 const end=new Date(from+'T12:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
 return {from,to:end.toISOString().slice(0,10),snapshotId:id,versionId:id,versions:[{versionId:id,status:'selected',kind:'base'}]};
}
test('partial cross-month range requires both complete monthly witnesses and explicit selected versions',()=>{
 const jan=source('2025-01-01'),feb=source('2025-02-01');
 assert.deepEqual(reportingRangeSources([source('2024-12-01'),jan,feb,source('2025-03-01')],{from:'2025-01-26',to:'2025-02-01'}),[{from:jan.from,to:jan.to,versionId:jan.versionId!},{from:feb.from,to:feb.to,versionId:feb.versionId!}]);
});
test('missing middle month does not skip the gap or substitute an earlier or later source',()=>{
 assert.equal(reportingRangeSources([source('2025-01-01'),source('2025-03-01')],{from:'2025-01-01',to:'2025-03-31'}),null);
 assert.equal(reportingRangeSources([source('2025-01-01')],{from:'2025-01-31',to:'2025-02-01'}),null);
});
test('duplicate or ambiguous monthly candidates fail closed even when one looks selected',()=>{
 const jan=source('2025-01-01');
 assert.equal(reportingRangeSources([jan,source('2025-01-01','different-selected')],{from:'2025-01-03',to:'2025-01-17'}),null);
 const ambiguous={...jan,versionId:undefined,versions:[{versionId:'first',status:'selected' as const,kind:'base' as const},{versionId:'second',status:'selected' as const,kind:'expense-correction' as const}]};
 assert.equal(reportingRangeSources([ambiguous],{from:'2025-01-03',to:'2025-01-17'}),null);
});
test('partial or invalidated source coverage is not treated as a complete monthly witness',()=>{
 const jan=source('2025-01-01');
 assert.equal(reportingRangeSources([{...jan,to:'2025-01-30'}],{from:'2025-01-03',to:'2025-01-17'}),null);
 assert.equal(reportingRangeSources([{...jan,versions:[{versionId:jan.versionId!,status:'invalidated',kind:'base'}]}],{from:'2025-01-03',to:'2025-01-17'}),null);
});
test('only the requested source span is returned and ranges are bounded at 24 months',()=>{
 const months=Array.from({length:25},(_,i)=>source(new Date(Date.UTC(2024,10+i,1,12)).toISOString().slice(0,10)));
 assert.equal(reportingRangeSources(months,{from:'2024-11-01',to:'2026-10-31'})?.length,24);
 assert.equal(reportingRangeSources(months,{from:'2024-11-01',to:'2026-11-30'}),null);
 assert.equal(reportingRangeSources(months,null),null);
});
