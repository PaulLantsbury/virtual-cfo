import type {ReviewedMonth} from './reviewedHistorySeries.ts';
/** The supplemental evidence must name the exact currently validated financial source revisions. */
export function reviewedSupplement(raw:unknown,month:ReviewedMonth|null,kind:'cash'|'acquisition',now=new Date()){
 if(!month||!raw||typeof raw!=='object')return null;
 const r=raw as Record<string,any>,s=month.selection;
 if(r.state!=='supported'||r.contract!=='reviewed-supplement-v1'||r.kind!==kind||r.sourceBasis!=='synthetic-local'||typeof r.snapshotId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.snapshotId)||r.financialVersionId!==s.versionId||r.salesRevision!==month.evidence.salesRevision||r.costRevision!==month.evidence.costRevision)return null;
 if(!r.scope||r.scope.storeId!==s.storeId||r.scope.currency!==s.currency||r.scope.timezone!==s.timezone||r.scope.from!==s.period.from||r.scope.to!==s.period.to)return null;
 if(typeof r.observedAt!=='string'||!r.observedAt.endsWith('Z')||!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>now.getTime()||Date.parse(r.observedAt)<Date.parse(month.context.snapshotAsOf)||!r.payload||typeof r.payload!=='object'||Array.isArray(r.payload))return null;
 return r;
}
