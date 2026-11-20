import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {amendedExpense} from './history-expense-correction.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
import {generate,summarise,addDays} from './generator.mjs';
import {createSyntheticCashSource,EXISTING_CAPITAL_ASSUMPTION} from './cash-source-model.mjs';
import {eligibleCashView} from '../../artifacts/virtual-cfo/src/lib/cashSourceAdapter.ts';
import {prepareSyntheticCashEvidence} from '../../artifacts/virtual-cfo/src/lib/syntheticCashEvidence.ts';
const fixture=generate({from:'2024-11-01',asOf:'2026-11-20'}),originalHash=fixture.fingerprint;
const observedAt='2026-11-20T12:00:00Z',now=new Date('2026-11-20T13:00:00Z'),storeId='fictional-cash-test';
const source=createSyntheticCashSource(fixture,{openingCapital:EXISTING_CAPITAL_ASSUMPTION,observedAt});
const month=(from,to)=>source.month({from,to,storeId,now});
const sum=xs=>xs.reduce((n,x)=>n+x,0);
function financial(from,to){const t=summarise(fixture,from,to),scope={storeId,currency:'GBP',from,to};const selection={storeId,currency:'GBP',timezone:'Europe/London',edition:'synthetic-history-v2-2026-11',anchor:fixture.from,versionId:'fictional-financial:'+from,period:{from,to}};
 let sourceAsOf=addDays(to,1)+'T00:00:00Z';const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'numeric',hourCycle:'h23'}).format(new Date(sourceAsOf)));sourceAsOf=new Date(Date.parse(sourceAsOf)-hour*3600000).toISOString();
 const raw={state:'supported',versionId:selection.versionId,contract:'history-v2-proposal',scope,snapshotId:selection.versionId,salesRevision:'sales-test',costRevision:'cost-test',metadata:{versionId:selection.versionId,edition:selection.edition,anchor:selection.anchor,sourceAsOf,observedAt,formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},sales:{grossProductSales:t.gross,discounts:t.discounts,netProductSales:t.netProduct,netShipping:t.shipping,originalOrders:t.orders,aov:{value:(t.gross-t.discounts)/t.orders,reason:null},provenance:scope},components:{cogs:t.cogs,variableCosts:t.variableCosts,advertising:t.marketing,overheadIncludingDA:t.overheads,depreciationAmortisation:t.da},profit:{state:'complete',grossProfit:t.grossProfit,contributionBeforeMarketing:t.contribution+t.marketing,contribution:t.contribution,ebitda:t.ebitda}};
 return {raw,selection};
}
test('every closed month reconciles signed EBITDA and control movements to an independent bank journal, balances continuously and preserves source',()=>{
 let prior;let n=0;
 for(let i=0;i<24;i++){const d=new Date(Date.UTC(2024,10+i,1)),from=d.toISOString().slice(0,10),to=new Date(Date.UTC(2024,11+i,0)).toISOString().slice(0,10),p=month(from,to);n++;
  const actual=sum(fixture.events.filter(e=>e.date>=from&&e.date<=to&&e.kind!=='opening').flatMap(e=>e.postings.filter(x=>x.account==='bank').map(x=>x.amount)));
  assert.equal(p.reconciliation.difference,0);assert.equal(p.evidence.operatingCash,actual);assert.equal(p.evidence.accounts[0].opening+actual,p.evidence.accounts[0].closing);
  if(prior!==undefined)assert.equal(p.evidence.accounts[0].opening,prior);else assert.equal(p.evidence.accounts[0].opening,6000000);prior=p.evidence.accounts[0].closing;
  assert.ok(eligibleCashView(p.evidence,{storeId,currency:'GBP',timezone:'Europe/London',from,to},now));
  const f=financial(from,to),prepared=prepareSyntheticCashEvidence(f.raw,f.selection,p.inputs,now);assert.equal(prepared.view.closingBankCash,prior);assert.equal(prepared.evidence.ebitda,p.evidence.ebitda);
 }
 assert.equal(n,24);assert.equal(fixture.fingerprint,originalHash);
 const {fingerprint,...payload}=fixture;assert.equal(createHash('sha256').update(JSON.stringify(payload)).digest('hex'),fingerprint);
});
test('Christmas, June payroll, cross-month refunds and processor lag remain actual dated sources rather than monthly cash allocations',()=>{
 const june=month('2026-06-01','2026-06-30'),christmas=month('2025-12-01','2025-12-31'),jan=month('2026-01-01','2026-01-31');
 assert.equal(june.sourceManifest.sourceRows.filter(e=>e.kind==='payroll_accrual').length,4);assert.ok(june.bankLedger.some(e=>e.kind==='payroll_payment'));assert.ok(june.bankLedger.some(e=>e.kind==='payroll_remittance'));
 assert.ok(christmas.bankLedger.some(e=>e.kind==='supplier_payment'));assert.ok(christmas.evidence.unsettledProviderFunds>0);assert.ok(jan.bankLedger.some(e=>e.kind==='refund'));
 const refund=fixture.events.find(e=>e.kind==='refund'&&e.date==='2026-01-01'&&e.refs.originalDate.startsWith('2025-12'));assert.ok(refund);assert.ok(jan.bankLedger.some(r=>r.eventId===refund.id&&r.amount===-refund.metrics.refunds-refund.metrics.refundedVat));
 assert.equal(christmas.sourceManifest.sourceRows.find(r=>r.id===refund.id),undefined);assert.equal(christmas.evidence.accounts[0].closing,jan.evidence.accounts[0].opening);
 const byDay=new Map();for(const r of christmas.bankLedger)byDay.set(r.date,(byDay.get(r.date)||0)+r.amount);assert.ok(new Set(byDay.values()).size>20);
});
test('VAT and payroll payments are included exactly once through operating liabilities, with no invented corporation tax or financing',()=>{
 const p=month('2026-08-01','2026-08-31'),vatEvents=p.bankLedger.filter(e=>e.kind==='vat_settlement');assert.ok(vatEvents.length>0);
 for(const r of vatEvents){const wc=p.inputs.workingCapital.other.find(x=>x.eventId===r.eventId&&x.account==='vat_control');assert.ok(wc);assert.equal(wc.amount,r.amount);}
 assert.deepEqual(p.evidence.bankMovements,{taxAndInterest:0,investing:0,financing:0,other:0});
 const actualVAT=fixture.events.filter(e=>e.kind==='vat_settlement'&&e.date>=p.evidence.from&&e.date<=p.evidence.to);assert.equal(actualVAT.length,vatEvents.length);
 assert.equal(p.evidence.operatingCash,sum(p.bankLedger.map(e=>e.amount)));assert.equal(p.evidence.workingCapital.other,sum(p.inputs.workingCapital.other.map(r=>r.amount)));
 assert.equal(p.evidence.unsettledProviderFunds,p.sourceManifest.closingControlBalances.processor);assert.notEqual(p.evidence.accounts[0].closing+p.evidence.unsettledProviderFunds,p.evidence.accounts[0].closing);
});
test('capital acknowledgement, exact immutable source, pinned anchor, complete months and truthful observation are mandatory',()=>{
 assert.throws(()=>createSyntheticCashSource(fixture,{observedAt}),/capital/);
 assert.throws(()=>createSyntheticCashSource(fixture,{openingCapital:{...EXISTING_CAPITAL_ASSUMPTION,bank:6000001},observedAt}),/capital/);
 const bad=structuredClone(fixture);bad.events.find(e=>e.kind==='processor_fee').postings[0].amount++;const {fingerprint,...payload}=bad;bad.fingerprint=createHash('sha256').update(JSON.stringify(payload)).digest('hex');assert.throws(()=>createSyntheticCashSource(bad,{openingCapital:EXISTING_CAPITAL_ASSUMPTION,observedAt}),/immutable/);
 assert.throws(()=>createSyntheticCashSource({...fixture,from:'2024-01-01'},{openingCapital:EXISTING_CAPITAL_ASSUMPTION,observedAt}),/isolated/);
 for(const range of [['2026-11-01','2026-11-30'],['2026-06-01','2026-06-29'],['2026-06-02','2026-06-30']])assert.throws(()=>month(...range),/complete/i);
 assert.throws(()=>source.month({from:'2026-06-01',to:'2026-06-30',storeId,now:new Date('2026-01-01T00:00:00Z')}),/truthful/);
});
test('a reviewed corrected profit month cannot be silently paired with uncorrected cash; returned manifests cannot mutate future reads',()=>{
 const p=month('2026-08-01','2026-08-31'),f=financial(p.evidence.from,p.evidence.to);f.raw.components.overheadIncludingDA+=400;f.raw.profit.ebitda-=400;f.raw.versionId+=':corrected';f.raw.snapshotId=f.raw.versionId;f.raw.metadata.versionId=f.raw.versionId;f.selection.versionId=f.raw.versionId;
 assert.throws(()=>prepareSyntheticCashEvidence(f.raw,f.selection,p.inputs,now),/reconcile/);
 p.bankLedger[0].amount=999;p.sourceManifest.openingCapital.bank=999;
 const again=month('2026-08-01','2026-08-31');assert.notEqual(again.bankLedger[0].amount,999);assert.equal(again.sourceManifest.openingCapital.bank,6000000);assert.equal(again.reconciliation.difference,0);
});

test('later canonical daily history leaves closed-month cash evidence and prefix proof unchanged',()=>{
 const extended=generate({from:'2024-11-01',asOf:'2026-11-21'});
 const next=createSyntheticCashSource(extended,{openingCapital:EXISTING_CAPITAL_ASSUMPTION,observedAt});
 const request={from:'2026-10-01',to:'2026-10-31',storeId,now};
 const first=source.month(request),later=next.month(request);assert.deepEqual(later.evidence,first.evidence);assert.deepEqual(later.sourceManifest,first.sourceManifest);
});

function correction(body,amount,version='reviewed-aug-correction') {const afterBody=amendedExpense(body,amount);return {beforeHash:digest(body),afterBody,afterHash:digest(afterBody),financialVersionId:version};}
test('typed reviewed expense correction carries an unpaid liability across Aug/Sep/Oct without inventing bank payment',()=>{
 const before=fixture.events.find(e=>e.date==='2026-08-15'&&e.kind==='expense_accrual'&&e.refs.category==='software');assert.ok(before);
 const amount=before.postings.find(p=>p.account==='expense:software').amount,overlay=correction(before,amount+400);
 const adjusted=createSyntheticCashSource(fixture,{openingCapital:EXISTING_CAPITAL_ASSUMPTION,observedAt,verifiedExpenseOverlays:[overlay]});
 const baseAug=month('2026-08-01','2026-08-31');assert.throws(()=>adjusted.month({from:'2026-08-01',to:'2026-08-31',storeId,now}),/selected correction/);
 assert.throws(()=>adjusted.month({from:'2026-08-01',to:'2026-08-31',storeId,now,financialVersionId:overlay.financialVersionId,reviewedEbitda:baseAug.evidence.ebitda}),/differs/);
 const aug=adjusted.month({from:'2026-08-01',to:'2026-08-31',storeId,now,financialVersionId:overlay.financialVersionId,reviewedEbitda:baseAug.evidence.ebitda-400});
 assert.equal(aug.evidence.ebitda,baseAug.evidence.ebitda-400);assert.equal(aug.evidence.workingCapital.supplierCredit,baseAug.evidence.workingCapital.supplierCredit+480);assert.equal(aug.evidence.workingCapital.other,baseAug.evidence.workingCapital.other-80);
 assert.deepEqual(aug.bankLedger,baseAug.bankLedger);assert.equal(aug.evidence.operatingCash,baseAug.evidence.operatingCash);assert.equal(aug.evidence.accounts[0].closing,baseAug.evidence.accounts[0].closing);
 for(const [from,to] of [['2026-09-01','2026-09-30'],['2026-10-01','2026-10-31']]){const base=month(from,to),next=adjusted.month({from,to,storeId,now,financialVersionId:'base:'+from,reviewedEbitda:base.evidence.ebitda});assert.equal(next.evidence.ebitda,base.evidence.ebitda);assert.equal(next.evidence.operatingCash,base.evidence.operatingCash);assert.deepEqual(next.bankLedger,base.bankLedger);assert.equal(next.sourceManifest.openingControlBalances.accrued_payable,base.sourceManifest.openingControlBalances.accrued_payable-480);assert.equal(next.sourceManifest.closingControlBalances.accrued_payable,base.sourceManifest.closingControlBalances.accrued_payable-480);assert.equal(next.sourceManifest.closingControlBalances.vat_control,base.sourceManifest.closingControlBalances.vat_control+80);assert.equal(next.sourceManifest.verifiedExpenseOverlays.length,1);}
 assert.equal(fixture.events.find(e=>e.id===before.id).postings.find(p=>p.account==='expense:software').amount,amount);
});
test('overlay lineage rejects tampering, arbitrary bank/sales/date changes and stale predecessor; replacement chain is explicit',()=>{
 const before=fixture.events.find(e=>e.date==='2026-08-15'&&e.kind==='expense_accrual'&&e.refs.category==='software'),amount=before.postings.find(p=>p.account==='expense:software').amount;
 const one=correction(before,amount+400),two=correction(one.afterBody,amount+600,'reviewed-replacement');
 const args={openingCapital:EXISTING_CAPITAL_ASSUMPTION,observedAt};
 for(const overlays of [[{...one,beforeHash:'wrong'}],[{...one,afterHash:'wrong'}],[one,one],[two],[{...one,afterBody:{...one.afterBody,date:'2026-09-15'},afterHash:digest({...one.afterBody,date:'2026-09-15'})}]])assert.throws(()=>createSyntheticCashSource(fixture,{...args,verifiedExpenseOverlays:overlays}));
 const bank=structuredClone(one);bank.afterBody.postings.push({account:'bank',amount:400});bank.afterHash=digest(bank.afterBody);assert.throws(()=>createSyntheticCashSource(fixture,{...args,verifiedExpenseOverlays:[bank]}),/typed/);
 const replaced=createSyntheticCashSource(fixture,{...args,verifiedExpenseOverlays:[one,two]}),base=month('2026-08-01','2026-08-31');
 const p=replaced.month({from:'2026-08-01',to:'2026-08-31',storeId,now,financialVersionId:two.financialVersionId,reviewedEbitda:base.evidence.ebitda-600});assert.equal(p.evidence.ebitda,base.evidence.ebitda-600);assert.equal(p.evidence.operatingCash,base.evidence.operatingCash);assert.equal(p.sourceManifest.verifiedExpenseOverlays.length,2);
 p.sourceManifest.verifiedExpenseOverlays[0].beforeHash='mutated-output';
 const again=replaced.month({from:'2026-08-01',to:'2026-08-31',storeId,now,financialVersionId:two.financialVersionId,reviewedEbitda:base.evidence.ebitda-600});assert.equal(again.sourceManifest.verifiedExpenseOverlays[0].beforeHash,one.beforeHash);
});
