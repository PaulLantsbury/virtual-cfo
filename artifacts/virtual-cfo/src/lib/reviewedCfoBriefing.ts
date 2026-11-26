import type {composeHistoryMonth} from './v11/history-composition';

type Month = NonNullable<ReturnType<typeof composeHistoryMonth>>;
const labels = {
 netProductSales:'Net product sales', netShipping:'Net shipping', grossProfit:'Product gross profit',
 contribution:'Contribution after advertising', operatingProfit:'Operating profit', ebitda:'EBITDA',
} as const;
export type BriefingKey = keyof typeof labels;
export const CFO_INVESTIGATION = 'Check the underlying sales and classified costs before attributing a cause. These figures alone do not establish which action will improve results.';
export interface ReviewedCfoBriefing {
 facts: {key:BriefingKey;label:string;value:number}[];
 investigation:string|null;
 financialVersionId:string;salesRevision:string;costRevision:string;observedAt:string;
 engineFormulaVersion:'profit-evidence-v1';policyVersion:'cfo-guardrails-core-v1';evidenceRef:string;
}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const sameList=(v:unknown,expected:string[])=>Array.isArray(v)&&v.length===expected.length&&v.every((x,i)=>x===expected[i]);
/** Presentation boundary only. Authority comes from the existing authenticated
 * canonical history read; every value must also reconcile to that same month.
 * No retained result, fetch, clock policy, arbitrary narrative or sample fallback. */
export function reviewedCfoBriefing(month:Month|null):ReviewedCfoBriefing|null {
 if(!month)return null;
 const r=month.cfoBriefing,s=month.selection;
 if(!record(r)||!exact(r,['contract','scope','sourceBasis','financialVersionId','salesRevision','costRevision','observedAt','engineFormulaVersion','policyVersion','status','facts','investigation'])
  ||r.contract!=='history-cfo-briefing-v1'||r.status!=='supported'||r.sourceBasis!=='synthetic-local'
  ||r.engineFormulaVersion!=='profit-evidence-v1'||r.policyVersion!=='cfo-guardrails-core-v1'
  ||r.financialVersionId!==s.versionId||r.salesRevision!==month.evidence.salesRevision||r.costRevision!==month.evidence.costRevision||r.observedAt!==month.evidence.observedAt
  ||month.input.access!=='allowed'||month.input.freshness!=='current'||!record(r.scope)||!exact(r.scope,['storeId','currency','from','to','timezone'])
  ||r.scope.storeId!==s.storeId||r.scope.currency!==s.currency||r.scope.timezone!==s.timezone||r.scope.from!==s.period.from||r.scope.to!==s.period.to)return null;
 const keys=Object.keys(labels) as BriefingKey[],ref=`history-v2:${s.versionId}`;
 if(!Array.isArray(r.facts)||r.facts.length!==keys.length)return null;
 const facts:ReviewedCfoBriefing['facts']=[];
 for(const key of keys){
  const matches=r.facts.filter(f=>record(f)&&f.key===key);
  if(matches.length!==1)return null;
  const f=matches[0];
  if(!exact(f,['key','value','unit','evidenceRefs','ruleIds'])||f.unit!=='pence'||!Number.isSafeInteger(f.value)||f.value!==month.amounts[key]
   ||!sameList(f.evidenceRefs,[ref])||!sameList(f.ruleIds,['context','calculation','freshness']))return null;
  facts.push({key,label:labels[key],value:f.value as number});
 }
 let investigation:string|null=null;
 if(r.investigation!==null){
  if(!record(r.investigation)||!exact(r.investigation,['text','ruleIds'])||!sameList(r.investigation.text,[CFO_INVESTIGATION])||!sameList(r.investigation.ruleIds,['calculation','ladder']))return null;
  investigation=CFO_INVESTIGATION;
 }
 return {facts,investigation,financialVersionId:s.versionId,salesRevision:month.evidence.salesRevision,costRevision:month.evidence.costRevision,observedAt:month.evidence.observedAt,
  engineFormulaVersion:'profit-evidence-v1',policyVersion:'cfo-guardrails-core-v1',evidenceRef:ref};
}
