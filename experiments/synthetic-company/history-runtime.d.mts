import type {initialiseReviewRuntime} from '../shopify/review-runtime.mjs';
import type {HistoryReadService} from './history-reader.mjs';
export function initialiseHistoryReportingRuntime(config:Parameters<typeof initialiseReviewRuntime>[0],factories:Parameters<typeof initialiseReviewRuntime>[1],options?:{enabled?:boolean}):Promise<Awaited<ReturnType<typeof initialiseReviewRuntime>> & {historyService?:HistoryReadService}>;
