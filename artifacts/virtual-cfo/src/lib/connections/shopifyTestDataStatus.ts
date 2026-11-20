import type {ConnectionStatus} from './shopifyStatus';

/** Read-only ingestion evidence, never a writer/scheduler or financial readiness check. */
export function shopifyTestDataStatus(data: ConnectionStatus) {
  const candidate = data.candidate;
  const inspected = data.state === 'available' && ['current_unverified', 'needs_recheck'].includes(candidate.state);
  if (!inspected || candidate.testExcludedCount === null || candidate.orderCount === null) {
    return {state: 'unavailable' as const, title: 'Test-data ingestion not assessed', detail: 'No usable test-order count is available for the latest collection period. This does not mean that Shopify has no test orders.'};
  }
  const count = candidate.testExcludedCount;
  if (count > candidate.orderCount) {
    return {state: 'unavailable' as const, title: 'Test-data counts need checking', detail: 'The saved test-order count exceeds the source-order count. No ingestion conclusion is available.'};
  }
  if (count === 0) {
    return {state: 'none_observed' as const, title: 'No excluded test orders in this saved candidate', detail: 'This is a saved collection result, not a check of the writer or Shopify right now. Pending writes and later collections are not represented.'};
  }
  return {
    state: 'observed' as const,
    title: `${count} test ${count === 1 ? 'order' : 'orders'} received and excluded from sales`,
    detail: `The retained source contains ${candidate.orderCount} ${candidate.orderCount === 1 ? 'order' : 'orders'} in total. Counts describe the saved extraction, not orders created during the reporting period. They do not identify the test writer’s own orders or prove a daily schedule.${candidate.state === 'needs_recheck' ? ' This candidate needs rechecking.' : ''}${data.latestAttempt?.state !== 'completed' ? ' The latest collection attempt is not confirmed complete.' : ''}`,
  };
}
