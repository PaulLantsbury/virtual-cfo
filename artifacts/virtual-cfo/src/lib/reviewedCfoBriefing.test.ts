import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedBrowserMonth} from '../../tests/reviewed-pages.test-fixture.ts';
import {composeHistoryMonth} from './v11/history-composition.ts';
import {reviewedCfoBriefing,CFO_INVESTIGATION} from './reviewedCfoBriefing.ts';
function fixture(){
 const f=reviewedBrowserMonth('2026-10-01',1),m=f.month;
 const envelope={contract:'history-cfo-briefing-v1',scope:{...f.response.scope,timezone:'Europe/London'},sourceBasis:'synthetic-local',financialVersionId:m.selection.versionId,salesRevision:m.evidence.salesRevision,costRevision:m.evidence.costRevision,observedAt:m.evidence.observedAt,engineFormulaVersion:'profit-evidence-v1',policyVersion:'cfo-guardrails-core-v1',status:'supported',facts:['netProductSales','netShipping','grossProfit','contribution','operatingProfit','ebitda'].map(key=>({key,value:m.amounts[key as keyof typeof m.amounts],unit:'pence',evidenceRefs:[`history-v2:${m.selection.versionId}`],ruleIds:['context','calculation','freshness']})),investigation:{text:[CFO_INVESTIGATION],ruleIds:['calculation','ladder']}};
 const compose=(raw:unknown=envelope)=>composeHistoryMonth({...f.response,cfoBriefing:raw},m.selection);
 return {...f,envelope,compose};
}
test('same authenticated history envelope reconciles six facts; original figures unchanged',()=>{
 const f=fixture(),m=f.compose(),result=reviewedCfoBriefing(m);
 assert.ok(result);assert.equal(result.facts.length,6);assert.equal(result.investigation,CFO_INVESTIGATION);
 assert.deepEqual(m?.amounts,f.month.amounts);assert.deepEqual(m?.selection,f.month.selection);
 assert.equal(reviewedCfoBriefing(null),null);assert.equal(reviewedCfoBriefing(f.month),null);
});
test('each changed scope revision formula policy or observation rejects the entire narrative',()=>{
 const mutations=[(r:any)=>r.scope.storeId='other',(r:any)=>r.scope.from='2026-09-01',(r:any)=>r.scope.to='2026-10-30',(r:any)=>r.scope.currency='USD',(r:any)=>r.scope.timezone='UTC',(r:any)=>r.financialVersionId='old',(r:any)=>r.salesRevision='other',(r:any)=>r.costRevision='other',(r:any)=>r.observedAt='2026-11-21T12:00:00Z',(r:any)=>r.engineFormulaVersion='other',(r:any)=>r.policyVersion='other',(r:any)=>r.sourceBasis='fictional',(r:any)=>r.status='unavailable'];
 for(const change of mutations){const f=fixture();change(f.envelope);const m=f.compose();assert.equal(reviewedCfoBriefing(m),null);assert.deepEqual(m?.amounts,f.month.amounts);}
});
test('changed amounts units duplicate facts arbitrary prose and hidden claims are rejected',()=>{
 const mutations=[(r:any)=>r.facts[0].value++,(r:any)=>r.facts[0].unit='pounds',(r:any)=>r.facts[0].value=NaN,(r:any)=>r.facts[0].value=1.5,(r:any)=>r.facts[0].evidenceRefs=['foreign'],(r:any)=>r.facts[0].ruleIds=['invented'],(r:any)=>r.facts[0].key='cash',(r:any)=>r.facts[0]=r.facts[1],(r:any)=>r.facts.pop(),(r:any)=>r.facts[0].promise='Guaranteed growth',(r:any)=>r.investigation.text=['Increase spend now'],(r:any)=>r.investigation.ruleIds=['invented'],(r:any)=>r.advice='Spend more'];
 for(const change of mutations){const f=fixture();change(f.envelope);assert.equal(reviewedCfoBriefing(f.compose()),null);}
});
test('missing optional briefing and malformed values cannot hide or replace accepted financial figures',()=>{
 const f=fixture();for(const raw of [null,[],{},'bad',{...f.envelope,status:'unavailable',facts:[],investigation:null}]){const m=f.compose(raw);assert.deepEqual(m?.amounts,f.month.amounts);assert.equal(reviewedCfoBriefing(m),null);}
});
test('immutable source snapshot cannot be altered after composition and optional investigation may be absent',()=>{
 const f=fixture();const m=f.compose();f.envelope.facts[0].value=999;assert.equal(reviewedCfoBriefing(m)?.facts[0].value,f.month.amounts.netProductSales);assert.ok(Object.isFrozen(m?.cfoBriefing));
 const g=fixture();(g.envelope as any).investigation=null;assert.equal(reviewedCfoBriefing(g.compose())?.investigation,null);
});
