import test from 'node:test';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {generate,summarise,addDays} from './generator.mjs';
import {amendedExpense} from './history-expense-correction.mjs';
import {buildAcquisitionSource} from './acquisition-source.mjs';
import {compileSupplementalPlan} from './supplemental-plan.mjs';
import {stableId,RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
import {historySourceAsOf,HISTORY_EDITION} from './history-context.mjs';
import {supplementalDigest} from './supplemental-reader.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
const cashFixture=generate({from:'2024-11-01',asOf:'2025-01-01'}),acquisitionSource=buildAcquisitionSource(generate({from:'2024-01-01',asOf:'2025-01-01'}));
const observedAt='2026-11-20T18:00:00Z',now=new Date('2026-11-20T19:00:00Z');
function financial(from,to,fixture=cashFixture){const t=summarise(fixture,from,to),versionId=stableId('fictional-financial-test',from),scope={storeId:identity.storeId,currency:'GBP',from,to};return {state:'supported',contract:'history-v2-proposal',versionId,snapshotId:versionId,scope,salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64),metadata:{versionId,edition:HISTORY_EDITION,anchor:'2024-11-01',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only',sourceAsOf:historySourceAsOf(to),observedAt:'2026-11-20T17:00:00Z'},sales:{grossProductSales:t.gross,discounts:t.discounts,netProductSales:t.netProduct,netShipping:t.shipping,originalOrders:t.orders,aov:{value:(t.gross-t.discounts)/t.orders,reason:null},provenance:scope},components:{cogs:t.cogs,variableCosts:t.variableCosts,advertising:t.marketing,overheadIncludingDA:t.overheads,depreciationAmortisation:t.da},profit:{state:'complete',grossProfit:t.grossProfit,contributionBeforeMarketing:t.contribution+t.marketing,contribution:t.contribution,ebitda:t.ebitda}};}
const financialReports=[financial('2024-11-01','2024-11-30'),financial('2024-12-01','2024-12-31')];
const input=()=>({financialReports:structuredClone(financialReports),cashFixture,acquisitionSource,observedAt,verifiedExpenseOverlays:[]});
test('complete compiler emits deterministic exact envelopes/indexes and compact API bodies with full offline proofs',()=>{
 const source=input(),before=digest(source),plan=compileSupplementalPlan(source,{now});
 assert.deepEqual(plan.counters,{months:2,cash:2,acquisition:2,records:4,cashBankRows:plan.proofs.cash.reduce((n,p)=>n+p.bankLedger.length,0)});assert.equal(plan.state,'prepared-only');assert.equal(digest(source),before);assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.records[0].body));
 for(const row of plan.records){assert.equal(row.body_hash,supplementalDigest(row.body));assert.equal(row.snapshot_id,stableId('supplemental-v1',`${row.kind}:${row.store_id}:${row.date_from}:${row.date_to}:${row.financial_version}:${row.body_hash}`));assert.equal(row.body.financialVersionId,row.financial_version);assert.equal(row.body.salesRevision,row.sales_revision);assert.equal(row.body.costRevision,row.cost_revision);assert.equal(row.invalidated,false);assert.deepEqual(Object.keys(row.body).sort(),['contract','kind','scope','financialVersionId','salesRevision','costRevision','sourceBasis','observedAt','payload'].sort());
  if(row.kind==='cash'){assert.equal('bankLedger' in row.body.payload,false);assert.equal('sourceRows' in row.body.payload.source,false);assert.equal('workingCapitalSources' in row.body.payload.source,false);assert.ok(plan.proofs.cash.find(p=>p.financialVersionId===row.financial_version).sourceManifest.sourceRows.length>0);}else{assert.equal(row.body.payload.metrics.cac,null);assert.equal(row.body.payload.metrics.firstOrderContribution,null);assert.equal(row.body.payload.metrics.maturePaybackDays,null);}
 }
 const {planHash,...artifact}=plan;assert.equal(planHash,digest(artifact));assert.equal(plan.hashes.financialReports,digest(plan.proofs.financialReports));assert.equal(plan.hashes.proofs,digest(plan.proofs));assert.equal(plan.hashes.records,digest(plan.records));
 assert.equal(compileSupplementalPlan(input(),{now}).planHash,planHash);
});
test('kind narrowing is explicit; default package cannot silently omit a failed cash or acquisition source',()=>{
 const missing=input();delete missing.acquisitionSource;assert.throws(()=>compileSupplementalPlan(missing,{now}),/acquisition/);
 const cash=compileSupplementalPlan(missing,{now,kinds:['cash']});assert.equal(cash.records.length,2);assert.equal(cash.counters.acquisition,0);assert.equal(cash.proofs.acquisitionSource,null);
 const noCash=input();delete noCash.cashFixture;assert.throws(()=>compileSupplementalPlan(noCash,{now}));const acquisition=compileSupplementalPlan(noCash,{now,kinds:['acquisition']});assert.equal(acquisition.counters.cash,0);
 for(const kinds of [[],['cash','cash'],['bad']])assert.throws(()=>compileSupplementalPlan(input(),{now,kinds}));
});
test('wrong scope/version/revisions/cutoff, partial/noncontiguous/duplicate/month counts and future observation fail closed',()=>{
 const changes=[p=>p.financialReports[0].scope.storeId=stableId('other','business'),p=>p.financialReports[0].versionId='bad',p=>p.financialReports[0].salesRevision='bad',p=>p.financialReports[0].metadata.sourceAsOf='2024-12-02T00:00:00Z',p=>p.financialReports[0].metadata.observedAt='2027-01-01T00:00:00Z',p=>p.financialReports[0].scope.to='2024-11-29',p=>p.financialReports.reverse(),p=>{const id=p.financialReports[0].versionId;p.financialReports[1].versionId=id;p.financialReports[1].snapshotId=id;p.financialReports[1].metadata.versionId=id;},p=>p.financialReports[1]=structuredClone(p.financialReports[0]),p=>p.financialReports=[],p=>p.financialReports=Array(25).fill(p.financialReports[0]),p=>p.observedAt='2027-01-01T00:00:00Z',p=>delete p.financialReports[0].components,p=>p.financialReports[0].profit.ebitda++];
 for(const change of changes){const p=input();change(p);assert.throws(()=>compileSupplementalPlan(p,{now}));}
});
test('source mismatch never yields partially assembled artifacts or persisted CAC floats',()=>{
 const p=input();p.acquisitionSource=structuredClone(acquisitionSource);p.acquisitionSource.orderObservations[0].identityState='guest';assert.throws(()=>compileSupplementalPlan(p,{now}),/integrity/);
 const q=input();q.financialReports[1].components.advertising+=1;q.financialReports[1].profit.contribution-=1;q.financialReports[1].profit.ebitda-=1;assert.throws(()=>compileSupplementalPlan(q,{now}));
 const r=input();r.financialReports[0].sales.aov.value=Infinity;assert.throws(()=>compileSupplementalPlan(r,{now}),/proof number/);
});

test('explicit selected expense overlay compiles a matched corrected cash envelope without changing acquisition or bank activity',()=>{
 const p=input(),before=cashFixture.events.find(e=>e.kind==='expense_accrual'&&e.date==='2024-12-15'&&e.refs.category==='software'),old=before.postings.find(x=>x.account==='expense:software').amount,afterBody=amendedExpense(before,old+400),versionId=stableId('fictional-correction-test','december');
 p.verifiedExpenseOverlays=[{beforeHash:digest(before),afterBody,afterHash:digest(afterBody),financialVersionId:versionId}];
 const r=p.financialReports[1];r.versionId=versionId;r.snapshotId=versionId;r.metadata.versionId=versionId;r.components.overheadIncludingDA+=400;r.profit.ebitda-=400;
 const corrected=compileSupplementalPlan(p,{now}),base=compileSupplementalPlan(input(),{now});
 const row=corrected.records.find(x=>x.kind==='cash'&&x.date_from==='2024-12-01'),original=base.records.find(x=>x.kind==='cash'&&x.date_from==='2024-12-01');
 assert.equal(row.body.financialVersionId,versionId);assert.equal(row.body.payload.evidence.ebitda,original.body.payload.evidence.ebitda-400);assert.equal(row.body.payload.evidence.operatingCash,original.body.payload.evidence.operatingCash);assert.deepEqual(row.body.payload.source.overlayCommitments,[{financialVersionId:versionId,eventId:before.id,date:before.date,beforeHash:digest(before),afterHash:digest(afterBody)}]);
 assert.equal('afterBody' in row.body.payload.source.overlayCommitments[0],false);assert.deepEqual(corrected.proofs.cash[1].bankLedger,base.proofs.cash[1].bankLedger);
 assert.deepEqual(corrected.records.find(x=>x.kind==='acquisition'&&x.date_from==='2024-12-01').body.payload.spend,base.records.find(x=>x.kind==='acquisition'&&x.date_from==='2024-12-01').body.payload.spend);
});

test('source corpora cannot include uncompleted observation-day activity even when reporting older months',()=>{
 const cash=input();cash.cashFixture={...cashFixture,to:'2026-11-20'};assert.throws(()=>compileSupplementalPlan(cash,{now}),/uncompleted/);
 const acquisition=input();acquisition.acquisitionSource={...acquisitionSource,through:'2026-11-20'};assert.throws(()=>compileSupplementalPlan(acquisition,{now}),/uncompleted/);
});

test('economics requires explicit opt-in and canonical financial fixture even for acquisition-only records',()=>{
 const base=compileSupplementalPlan(input(),{now});assert.equal(base.economicsIncluded,false);assert.equal(base.proofs.acquisitionCosts,null);assert.ok(base.records.filter(r=>r.kind==='acquisition').every(r=>!('economics' in r.body.payload)));
 const econ=compileSupplementalPlan(input(),{now,kinds:['acquisition'],includeEconomics:true});assert.equal(econ.economicsIncluded,true);assert.ok(econ.proofs.acquisitionCosts.contributionEntries.length>0);assert.equal(econ.counters.cash,0);
 for(const row of econ.records){const e=row.body.payload.economics;assert.equal(e.policy,'synthetic-order-cost-allocation-v1');assert.equal(e.first.scope.from,row.date_from);assert.equal(e.first.scope.to,row.date_to);assert.equal(e.first.scope.observedThrough,row.date_to);assert.equal(e.mature,null);assert.equal(e.source.costSourceHash,econ.proofs.acquisitionCosts.sourceHash);assert.equal(row.body.payload.metrics.firstOrderContribution,null);assert.equal(row.body.payload.metrics.maturePaybackDays,null);assert.ok(row.body.payload.limitations.some(t=>t.includes('Allocated synthetic costs')));assert.equal(row.body.payload.limitations.some(t=>t.includes('need a separately reviewed matched cost/cohort model')),false);assert.equal(supplementalDigest(row.body),row.body_hash);}
 assert.notEqual(econ.planHash,base.planHash);
 const missing=input();delete missing.cashFixture;assert.throws(()=>compileSupplementalPlan(missing,{now,kinds:['acquisition'],includeEconomics:true}),/Cash source/);
 assert.throws(()=>compileSupplementalPlan({...input(),acquisitionCosts:{sourceHash:'pretend'}},{now,includeEconomics:true}),/caller cost proofs/);
 assert.throws(()=>compileSupplementalPlan(input(),{now,includeEconomics:'true'}),/boolean/);
 assert.throws(()=>compileSupplementalPlan(input(),{now,kinds:['cash'],includeEconomics:true}),/acquisition kind/);
});
test('canonical economic costs cannot be replaced with rehashed source edits or offsetting financial component changes',()=>{
 const changed=input();changed.cashFixture=structuredClone(cashFixture);const event=changed.cashFixture.events.find(e=>e.kind==='processor_fee');event.postings[0].amount++;event.postings[1].amount--;const {fingerprint,...body}=changed.cashFixture;changed.cashFixture.fingerprint=undefined;delete changed.cashFixture.fingerprint;
 // A caller may rehash an edited journal, but the source still must match immutable programme regeneration.
 importHash(body,changed.cashFixture);assert.throws(()=>compileSupplementalPlan(changed,{now,kinds:['acquisition'],includeEconomics:true}),/immutable/);
 const offset=input(),r=offset.financialReports[0];r.components.variableCosts++;r.components.overheadIncludingDA--;r.profit.contributionBeforeMarketing--;r.profit.contribution--;
 assert.throws(()=>compileSupplementalPlan(offset,{now,kinds:['acquisition'],includeEconomics:true}),/Economics costs/);
 const corrected=input(),old=cashFixture.events.find(e=>e.kind==='expense_accrual'&&e.date==='2024-12-15'&&e.refs.category==='storage'),expense=old.postings.find(p=>p.account==='expense:storage'),afterBody=amendedExpense(old,expense.amount+100),versionId=stableId('fictional-variable-correction','dec');
 corrected.verifiedExpenseOverlays=[{beforeHash:digest(old),afterBody,afterHash:digest(afterBody),financialVersionId:versionId}];
 const cr=corrected.financialReports[1];cr.versionId=versionId;cr.snapshotId=versionId;cr.metadata.versionId=versionId;cr.components.variableCosts+=100;cr.profit.contributionBeforeMarketing-=100;cr.profit.contribution-=100;cr.profit.ebitda-=100;
 assert.throws(()=>compileSupplementalPlan(corrected,{now,kinds:['acquisition'],includeEconomics:true}),/separately supported economics source/);

});
function importHash(body,target){target.fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex');}
test('complete mature cohort integer inputs compile in the same exact envelope with explicit separate scope and no stored ratios',()=>{
 const ledger=generate({from:'2024-11-01',asOf:'2026-10-01'}),identities=buildAcquisitionSource(generate({from:'2024-01-01',asOf:'2026-10-01'}));
 const plan=compileSupplementalPlan({financialReports:Array.from({length:6},(_,i)=>financial(`2026-${String(i+4).padStart(2,'0')}-01`,new Date(Date.UTC(2026,i+4,0)).toISOString().slice(0,10),ledger)),cashFixture:ledger,acquisitionSource:identities,observedAt},{now,kinds:['acquisition'],includeEconomics:true});
 const row=plan.records.at(-1),e=row.body.payload.economics;assert.equal(e.dependencies.length,6);assert.deepEqual(e.dependencies.map(d=>d.from),['2026-04-01','2026-05-01','2026-06-01','2026-07-01','2026-08-01','2026-09-01']);assert.ok(e.dependencies.every(d=>d.versionId&&d.salesRevision==='a'.repeat(64)&&d.costRevision==='b'.repeat(64)));assert.ok(plan.records.slice(0,-1).every(r=>r.body.payload.economics.mature===null&&r.body.payload.economics.dependencies.length===0));assert.deepEqual(e.mature.scope,{from:'2026-04-01',to:'2026-06-30',observedThrough:'2026-09-30',days:90,currency:'GBP',timezone:'Europe/London'});assert.equal(e.mature.curve.length,90);assert.ok(e.mature.customers>0&&e.mature.acquisitionSpend>0);assert.equal('cac' in e.mature,false);assert.equal('paybackDays' in e.mature,false);assert.equal(supplementalDigest(row.body),row.body_hash);assert.ok(Object.isFrozen(plan.proofs.acquisitionCosts));
 const altered=structuredClone(row.body);altered.payload.economics.mature.curve[0].variableCosts++;assert.notEqual(supplementalDigest(altered),row.body_hash);
 const onlyCurrent=compileSupplementalPlan({financialReports:[financial('2026-09-01','2026-09-30',ledger)],cashFixture:ledger,acquisitionSource:identities,observedAt},{now,kinds:['acquisition'],includeEconomics:true});assert.equal(onlyCurrent.records[0].body.payload.economics.mature,null);assert.deepEqual(onlyCurrent.records[0].body.payload.economics.dependencies,[]);
 const drifted=structuredClone(row.body);drifted.payload.economics.dependencies[0].costRevision='c'.repeat(64);assert.notEqual(supplementalDigest(drifted),row.body_hash);

});
