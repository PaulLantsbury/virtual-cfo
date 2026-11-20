import test from 'node:test';import assert from 'node:assert/strict';
import {composeHistoryMonth} from './v11/history-composition.ts';
import {reviewedSupplement} from './reviewedSupplement.ts';
import {cashFinancialContext,cashSupplementView} from './cashSupplement.ts';
import {generate,summarise} from '../../../../experiments/synthetic-company/generator.mjs';
import {createSyntheticCashSource,EXISTING_CAPITAL_ASSUMPTION} from '../../../../experiments/synthetic-company/cash-source-model.mjs';
const fixture=generate({from:'2024-11-01',asOf:'2025-01-01'}),t=summarise(fixture,'2024-12-01','2024-12-31');
const selection={storeId:'d7500000-0000-4000-8000-000000000009',currency:'GBP' as const,timezone:'Europe/London' as const,edition:'synthetic-history-v2-2026-11' as const,anchor:'2024-11-01',versionId:'10000000-0000-4000-8000-000000000001',period:{from:'2024-12-01',to:'2024-12-31'}};
const scope={storeId:selection.storeId,currency:'GBP',...selection.period};
const raw={state:'supported',contract:'history-v2-proposal',versionId:selection.versionId,snapshotId:selection.versionId,scope,salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64),metadata:{versionId:selection.versionId,edition:selection.edition,anchor:selection.anchor,sourceAsOf:'2025-01-01T00:00:00Z',observedAt:'2026-11-20T10:00:00Z',formulaVersion:'night-scout-v11-2026-10-30',sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},sales:{grossProductSales:t.gross,discounts:t.discounts,netProductSales:t.netProduct,netShipping:t.shipping,originalOrders:t.orders,aov:{value:(t.gross-t.discounts)/t.orders,reason:null},provenance:scope},components:{cogs:t.cogs,variableCosts:t.variableCosts,advertising:t.marketing,overheadIncludingDA:t.overheads,depreciationAmortisation:t.da},profit:{state:'complete',grossProfit:t.grossProfit,contributionBeforeMarketing:t.contribution+t.marketing,contribution:t.contribution,ebitda:t.ebitda}};
const month=composeHistoryMonth(raw,selection)!;
const body={state:'supported',contract:'reviewed-supplement-v1',snapshotId:'20000000-0000-4000-8000-000000000001',kind:'cash',scope:{...scope,timezone:'Europe/London'},financialVersionId:selection.versionId,salesRevision:raw.salesRevision,costRevision:raw.costRevision,sourceBasis:'synthetic-local',observedAt:'2026-11-20T11:00:00Z',payload:{test:true}};
const now=new Date('2026-11-20T12:00:00Z');
test('client supplement display binds exact business/version/revisions and truthful evidence time',()=>{
 assert.ok(reviewedSupplement(body,month,'cash',now));assert.equal(reviewedSupplement(body,null,'cash',now),null);
 const mutations=[(r:any)=>r.scope.storeId='other',(r:any)=>r.scope.from='2024-11-01',(r:any)=>r.financialVersionId='other',(r:any)=>r.salesRevision='other',(r:any)=>r.costRevision='other',(r:any)=>r.snapshotId='-'.repeat(36),(r:any)=>r.observedAt='2026-12-01T00:00:00Z',(r:any)=>r.observedAt='2024-12-01T00:00:00Z',(r:any)=>r.state='invalidated'];
 for(const mutate of mutations){const r=structuredClone(body);mutate(r);assert.equal(reviewedSupplement(r,month,'cash',now),null);}
 assert.equal(reviewedSupplement(body,month,'acquisition',now),null);
});
test('cash presentation accepts reconciled source inputs only when matching selected EBITDA and model boundary',()=>{
 const prepared=createSyntheticCashSource(fixture,{openingCapital:EXISTING_CAPITAL_ASSUMPTION,observedAt:'2026-11-20T11:00:00Z'}).month({...scope,now});
 const source=Object.fromEntries(['contract','sourceBasis','profile','anchor','from','to','sourceRevision','mappingVersion','sourcePrefixHash','bankLedgerHash'].map(k=>[k,prepared.sourceManifest[k]]));
 const payload={evidence:prepared.evidence,source},f=cashFinancialContext(month);
 assert.ok(cashSupplementView(payload,f,now));assert.equal(cashSupplementView(payload,{...f,profit:{state:'complete',ebitda:t.ebitda+1}},now),null);
 const bad=structuredClone(payload);bad.evidence.accounts[0].closing++;assert.equal(cashSupplementView(bad,f,now),null);
 const wrong=structuredClone(payload);wrong.source.anchor='2025-01-01';assert.equal(cashSupplementView(wrong,f,now),null);
 assert.equal(cashSupplementView(payload,null,now),null);
});
