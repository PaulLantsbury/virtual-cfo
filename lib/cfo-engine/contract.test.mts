import {createEvidenceContext,evaluateClaim,validateClaimResult,type EvidenceContext,type ClaimIntent} from './index.mjs';
const expected={companyId:'x',storeId:'x',currency:'GBP',timeZone:'Europe/London',from:'2026-10-01',to:'2026-10-31',selectionVersion:'v1',asOf:'2026-11-26',access:'allowed' as const,formulaVersion:'profit-evidence-v1'};
const c=createEvidenceContext(null,expected);
const intent:ClaimIntent={kind:'fact',metricId:'x'};
const r=evaluateClaim(c,intent);
validateClaimResult(c,intent,r);
// @ts-expect-error brand prevents caller constructed context
const forged:EvidenceContext={status:'ready',reason:null,scope:null,mode:null,sources:[],metrics:[],testPlan:null};
// @ts-expect-error immutable results
r.claims.push({});
// @ts-expect-error immutable scope
if(c.scope)c.scope.companyId='other';
void forged;
