import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistoryRehearsal,importHistory} from './history-rehearsal.mjs';
import {calculateHistorySources} from './history-reader.mjs';
import {createHistoryCfoAnalysis,prepareHistoryCfoAnalysis} from './history-cfo-analysis.mjs';
import {analyzeFinancialChange} from '../../lib/cfo-analysis/index.mjs';
import {summarise,generate} from './generator.mjs';

const now=()=>new Date('2026-11-27T12:00:00.000Z');
let h,current,prior;
test.before(async()=>{
 h=await createHistoryRehearsal({withLoadedJanuary:false,now});
 await importHistory(h,{from:'2025-01-01',asOf:'2025-03-01'});
 const read=async(from,to)=>{
  const scope={storeId:h.storeId,currency:'GBP',from,to};
  const seal=(await h.db.query('SELECT snapshot_id,coverage_id,source_manifest FROM finance_history_v2.seals WHERE store_id=$1 AND date_from=$2 AND date_to=$3',[scope.storeId,from,to])).rows[0];
  const report=await h.db.transaction(tx=>calculateHistorySources(tx,scope,{coverage_id:seal.coverage_id}));
  return {scope,report,financialVersionId:seal.snapshot_id,observedAt:seal.source_manifest.observedAt};
 };
 prior=await read('2025-01-01','2025-01-31');current=await read('2025-02-01','2025-02-28');
});
test.after(async()=>{await h?.db.close();});
const analyze=(changes={})=>createHistoryCfoAnalysis({current,prior,now:now(),access:'allowed',freshness:'current',...changes});
test('canonical generated two-month records reconcile all comparison facts and profit bridge',()=>{
 const before=structuredClone({current,prior}),result=analyze();
 assert.equal(result.status,'ready');
 const expectedCurrent=summarise(generate({from:'2025-01-01',asOf:'2025-03-01'}),current.scope.from,current.scope.to);
 const expectedPrior=summarise(generate({from:'2025-01-01',asOf:'2025-03-01'}),prior.scope.from,prior.scope.to);
 const profit=result.facts.find(f=>f.key==='operatingProfit');
 assert.equal(profit.currentPence,expectedCurrent.operatingProfit);
 assert.equal(profit.priorPence,expectedPrior.operatingProfit);
 assert.equal(profit.changePence,expectedCurrent.operatingProfit-expectedPrior.operatingProfit);
 for(const f of result.facts){
  assert.ok(Number.isSafeInteger(f.currentPence));assert.ok(Number.isSafeInteger(f.priorPence));
  assert.equal(f.changePence,f.currentPence-f.priorPence);
  assert.deepEqual(f.evidenceRefs,[`history-v2:${current.financialVersionId}`,`history-v2:${prior.financialVersionId}`]);
 }
 assert.deepEqual({current,prior},before);
 assert.doesNotMatch(JSON.stringify(result),/postings|historic_unit_cost|costEvidence|source_return_id/);
 assert.equal(result.canExecute,false);
});
test('server-only model seam reproduces exactly the bounded deterministic result',()=>{
 const packet=prepareHistoryCfoAnalysis({current,prior,now:now(),access:'allowed',freshness:'current'});
 assert.deepEqual(analyzeFinancialChange(packet.input,packet.expected),analyze());
 assert.equal(packet.input.sources.length,2);
 assert.equal(packet.input.sources[0].scope.selectionVersion,current.financialVersionId);
 assert.equal(packet.input.sources[1].scope.selectionVersion,current.financialVersionId);
 assert.equal(packet.input.sources[1].reportVersion,prior.financialVersionId);
});
test('malformed current returns a complete denied request sentinel and no evidence',()=>{
 for(const selected of [null,undefined,{}]){
  const request={current:selected,prior,now:now(),access:'allowed',freshness:'current'};
  const packet=prepareHistoryCfoAnalysis(request);
  assert.equal(packet.input,null);
  assert.equal(packet.expected.access,'denied');
  for(const key of ['companyId','storeId','currency','timeZone','selectionVersion','from','to','asOf'])assert.equal(packet.expected[key],'');
  assert.equal(packet.expected.formulaVersion,'profit-evidence-v1');
  const result=createHistoryCfoAnalysis(request);
  assert.equal(result.status,'withheld');assert.equal(result.scope,null);assert.deepEqual(result.facts,[]);
 }
});
test('missing or tampered prior preserves only valid current facts with no investigation',()=>{
 const bad=structuredClone(prior);bad.report.profit.operatingProfit++;
 for(const p of [null,bad]){
  const result=analyze({prior:p});assert.equal(result.status,'withheld');assert.equal(result.investigation,null);
  assert.equal(result.facts.find(f=>f.key==='operatingProfit').currentPence,current.report.profit.operatingProfit);
  assert.ok(result.facts.every(f=>f.priorPence===null&&f.changePence===null));
 }
});
test('tampered source hash, totals, components and scope never become comparative advice',()=>{
 for(const mutate of [r=>r.report.selectedLines[0].body.historic_unit_cost_pence++,r=>r.report.components.advertising++,r=>r.report.profit.operatingProfit++,r=>r.scope.storeId='other-company',r=>r.scope.currency='USD',r=>r.observedAt='2027-01-01T00:00:00Z']){
  const selected=structuredClone(current);mutate(selected);
  const result=analyze({current:selected});assert.equal(result.status,'withheld');assert.equal(result.investigation,null);assert.deepEqual(result.facts,[]);
 }
});
test('prior company, period and revision mismatch withhold comparison',()=>{
 for(const mutate of [p=>p.scope.storeId='other-company',p=>p.scope.from='2024-12-01',p=>p.financialVersionId='bad',p=>p.report.costRevision='bad']){
  const p=structuredClone(prior);mutate(p);const result=analyze({prior:p});
  assert.equal(result.status,'withheld');assert.equal(result.investigation,null);
 }
});
test('stale data permits dated facts only; denied or invalidated clears all facts',()=>{
 const stale=analyze({freshness:'stale'});assert.equal(stale.status,'withheld');assert.equal(stale.investigation,null);
 assert.ok(stale.facts.length>0);assert.ok(stale.facts.every(f=>f.changePence===null));
 for(const changes of [{access:'denied'},{access:undefined},{freshness:'invalidated'},{freshness:undefined}]){
  const result=analyze(changes);assert.equal(result.status,'withheld');assert.deepEqual(result.facts,[]);assert.equal(result.scope,null);
 }
});
test('duplicate selected month as comparator preserves current facts and withholds comparison',()=>{
 const result=analyze({prior:structuredClone(current)});
 assert.equal(result.status,'withheld');assert.equal(result.investigation,null);assert.deepEqual(result.bridge,[]);
 assert.equal(result.facts.find(f=>f.key==='operatingProfit').currentPence,current.report.profit.operatingProfit);
 assert.ok(result.facts.every(f=>f.priorPence===null&&f.changePence===null));
 assert.equal(result.sources.length,1);assert.equal(result.sources[0].reportVersion,current.financialVersionId);
});
