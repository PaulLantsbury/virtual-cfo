import type { ReportingAdapterInput, SupportedProfitReport } from './reporting-adapter.ts';
/** Safe browser boundary. Authorization is enforced server-side; absent metadata never becomes a snapshot. */
export function trustedResponseInput(raw: unknown, expected: ReportingAdapterInput['expected']): ReportingAdapterInput {
 const unavailable: ReportingAdapterInput = {expected, sales:null,profit:null,access:'allowed',freshness:'invalidated',snapshot:null};
 if(!raw || typeof raw!=='object') return unavailable;
 const response=raw as Record<string,any>, trusted=response.trustedSnapshot, meta=trusted?.metadata;
 if(response.state!=='ready' || !['supported','partial','stale'].includes(trusted?.state) || !meta || !meta.scope
 || meta.scope.storeId!==expected.storeId || meta.scope.from!==expected.period.from || meta.scope.to!==expected.period.to
 || meta.scope.currency!==expected.currency || meta.scope.timezone!==expected.timezone || meta.contractVersion!==1
 || meta.formulaVersion!=='night-scout-v11-2026-10-30' || !['shopify-operational','synthetic-local'].includes(meta.sourceBasis)
 || !['current','stale'].includes(meta.freshness) || (trusted.state==='stale')!==(meta.freshness==='stale')
 || typeof meta.snapshotId!=='string' || !meta.snapshotId || typeof meta.sourceAsOf!=='string' || !Number.isFinite(Date.parse(meta.sourceAsOf))
 || typeof meta.coverageReference!=='string' || !meta.coverageReference || meta.coverage?.sales!=='complete') return unavailable;
 const report=response.report as SupportedProfitReport;
 if(!report?.sales?.provenance || !report.scope || report.scope.storeId!==expected.storeId || report.scope.from!==expected.period.from || report.scope.to!==expected.period.to || report.scope.currency!==expected.currency) return unavailable;
 // Scope is independently checked by the existing adapter. Never use raw source manifests as coverage text.
 const sales={...report.sales,provenance:{...report.sales.provenance,coverageEvidence:meta.coverageReference}};
 return {expected,sourceBasis:meta.sourceBasis,sales,profit:meta.coverage.costs==='complete'?{...report,sales}:null,access:'allowed',freshness:meta.freshness,snapshot:{id:meta.snapshotId,asOf:meta.sourceAsOf},
 ...(meta.freshness==='stale'?{retainedScope:{storeId:expected.storeId,currency:expected.currency,from:expected.period.from,to:expected.period.to}}:{})};
}
