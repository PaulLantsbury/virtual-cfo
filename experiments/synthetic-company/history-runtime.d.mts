import type {initialiseReviewRuntime} from '../shopify/review-runtime.mjs';
import type {SupplementalReadService,SupplementalKind} from './supplemental-reader.mjs';
import type {HistoryReadService} from './history-reader.mjs';
export function initialiseHistoryReportingRuntime(config:Parameters<typeof initialiseReviewRuntime>[0],factories:Parameters<typeof initialiseReviewRuntime>[1],options?:{enabled?:boolean;supplementalEnabled?:boolean;supplementalValidators?:Partial<Record<SupplementalKind,(payload:any,financial:any)=>boolean>>}):Promise<Awaited<ReturnType<typeof initialiseReviewRuntime>> & {historyService?:HistoryReadService;supplementalService?:SupplementalReadService}>;
