import type {AnalysisResult} from '../../lib/cfo-analysis/index.mjs';
import type {EvidenceInput,EvidenceRequest} from '../../lib/cfo-engine/index.mjs';
export interface HistoryAnalysisSnapshot {
 readonly report:unknown;
 readonly scope:{readonly storeId:string;readonly currency:string;readonly from:string;readonly to:string};
 readonly financialVersionId:string;
 readonly observedAt:string;
}
/** These assertions must come from the authenticated history reader, not the browser. */
export interface HistoryAnalysisRequest {
 readonly current:HistoryAnalysisSnapshot;
 readonly prior?:HistoryAnalysisSnapshot|null;
 readonly now?:Date;
 readonly access:'allowed'|'denied';
 readonly freshness:'current'|'stale'|'invalidated';
}
export function createHistoryCfoAnalysis(request:HistoryAnalysisRequest):AnalysisResult;
/** SERVER ONLY: contains raw source rows. Never serialize or submit this packet to a model. */
export function prepareHistoryCfoAnalysis(request:HistoryAnalysisRequest):{
 readonly input:EvidenceInput|null;
 readonly expected:EvidenceRequest;
};
