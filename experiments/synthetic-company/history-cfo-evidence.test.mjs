import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistoryRehearsal,importHistory} from './history-rehearsal.mjs';
import {calculateHistorySources,createHistoryService} from './history-reader.mjs';
import {createHistoryCfoBriefing,historyProfitInput} from './history-cfo-evidence.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {summarise,generate} from './generator.mjs';
const now=()=>new Date('2026-11-26T12:00:00.000Z');
let h,scope,report,versionId,observedAt;
test.before(async()=>{
 h=await createHistoryRehearsal({withLoadedJanuary:false,now});
 await importHistory(h,{from:'2025-01-01',asOf:'2025-03-01'});
 scope={storeId:h.storeId,currency:'GBP',from:'2025-02-01',to:'2025-02-28'};
 const seal=(await h.db.query('SELECT snapshot_id,coverage_id,source_manifest FROM finance_history_v2.seals WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[scope.storeId,scope.from,scope.to])).rows[0];
 versionId=seal.snapshot_id;observedAt=seal.source_manifest.observedAt;
 report=await h.db.transaction(tx=>calculateHistorySources(tx,scope,{coverage_id:seal.coverage_id}));
});
test.after(async()=>{await h?.db.close();});
const brief=r=>createHistoryCfoBriefing({report:r,scope,financialVersionId:versionId,observedAt,now:now()});
test('canonical generated rows map to exact six engine facts without altering any financial result',async()=>{
 const before=structuredClone(report),result=brief(report);
 assert.equal(result.status,'supported');assert.equal(result.facts.length,6);
 for(const f of result.facts){assert.equal(f.value,report.sales[f.key]??report.profit[f.key]);assert.deepEqual(f.ruleIds,['context','calculation','freshness']);assert.deepEqual(f.evidenceRefs,[`history-v2:${versionId}`]);}
 assert.deepEqual(report,before);assert.equal(result.observedAt,observedAt);
 assert.deepEqual(result.investigation,{text:['Check the underlying sales and classified costs before attributing a cause. These figures alone do not establish which action will improve results.'],ruleIds:['calculation','ladder']});
 const expected=summarise(generate({from:'2025-01-01',asOf:'2025-03-01'}),scope.from,scope.to);
 assert.equal(report.profit.grossProfit,expected.grossProfit);assert.equal(report.profit.operatingProfit,expected.operatingProfit);assert.equal(report.profit.ebitda,expected.ebitda);
 const input=historyProfitInput(report,scope,versionId);
 assert.equal(input.costEvidence.recoveries.length,report.costManifest.returns.length);
 assert.ok(input.costEvidence.lines.some(l=>l.soldOn<scope.from));
 for(const e of input.costEvidence.expenses){assert.match(e.id,/:posting:\d+$/);assert.equal(e.id,e.sourceId);}
});
test('actual authenticated reader adds only bounded CFO evidence after existing checks',async()=>{
 const auth={auth:{getUser:async()=>({data:{user:{id:h.reviewerId,is_anonymous:false}},error:null})}};
 const service=createHistoryService(h.db,auth,{now});
 const result=await service.read(scope,'Bearer fictional');
 assert.equal(result.state,'supported');assert.equal(result.cfoBriefing.status,'supported');
 assert.deepEqual(result.sales,report.sales);assert.deepEqual(result.components,report.components);assert.deepEqual(result.profit,report.profit);
 const encoded=JSON.stringify(result.cfoBriefing);assert.ok(encoded.length<5000);assert.doesNotMatch(encoded,/postings|historic_unit|source_return|costEvidence/);
 const denied=createHistoryService(h.db,{auth:{getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000099',is_anonymous:false}},error:null})}},{now});
 await assert.rejects(denied.read(scope,'Bearer fictional'),/membership/);
});
test('missing, tampered and mismatched totals withhold only CFO and never mutate financial fields',()=>{
 for(const change of [r=>delete r.costManifest.returns,r=>r.selectedLines[0].body.historic_unit_cost_pence++,r=>r.profit.operatingProfit++,r=>r.salesRevision='bad',r=>r.components.advertising++]){
  const r=structuredClone(report);change(r);const before=structuredClone(r),result=brief(r);
  assert.equal(result.status,'unavailable');assert.deepEqual(result.facts,[]);assert.equal(result.investigation,null);assert.deepEqual(r,before);
 }
});
test('actual negative correction posting is never abs or netted into supported engine evidence',()=>{
 const r=structuredClone(report),row=r.costEvents.find(e=>e.body.postings.some(p=>p.account.startsWith('expense:')));
 const expense=row.body.postings.find(p=>p.account.startsWith('expense:')),other=row.body.postings.find(p=>!p.account.startsWith('expense:'));
 const amount=expense.amount;expense.amount=-amount;other.amount+=2*amount;row.row_hash=digest(row.body);
 r.costManifest.expenseEvents=r.costEvents;r.costRevision=digest(r.costManifest);
 assert.equal(brief(r).status,'unavailable');assert.throws(()=>historyProfitInput(r,scope,versionId));
});

test('prior-period recovery of an original unit participates in cumulative validation',()=>{
 const r=structuredClone(report);
 const original=r.costManifest.returns.find(ret=>r.selectedLines.some(l=>l.source_id===ret.body.line_id&&l.event_date<scope.from));
 assert.ok(original,'generated cross-month original return required');
 const line=r.selectedLines.find(l=>l.source_id===original.body.line_id);
 const prior=structuredClone(original);prior.source_id='prior-recovery-proof';prior.event_date=line.event_date;prior.body.source_return_id=prior.source_id;prior.body.saleable_date=line.event_date;prior.row_hash=digest(prior.body);
 r.costManifest.returns.push(prior);r.costRevision=digest(r.costManifest);
 const input=historyProfitInput(r,scope,versionId);
 assert.ok(input.costEvidence.recoveries.some(x=>x.recoveryOn<scope.from));
 assert.equal(brief(r).status,'unavailable','prior plus current recovery cannot exceed original unit');
});
