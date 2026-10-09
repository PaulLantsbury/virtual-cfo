/** Only fixed, customer-safe explanations are surfaced; never raw server errors. */
export function salesAvailabilityReason(message?: string) {
  if (message === 'Sales/refund coverage evidence missing') return 'Sales and refund coverage has not been verified for this exact reporting period.';
  if (message === 'Missing or stale source evidence') return 'Some sales or refund records still need review.';
  if (message === 'Verified sales request unavailable') return 'Sales evidence could not be checked. Retry the check; if this continues, store access or the reporting service needs attention.';
  return 'Sales evidence is incomplete or could not be verified for this reporting period.';
}

export function profitHttpFailure(status: number) {
  if (status === 401) return 'Sign in again to check profit evidence.';
  if (status === 403) return 'Profit evidence is not accessible for this store.';
  if (status === 404) return 'Profit reporting is not available on this website yet.';
  if (status === 503) return 'The profit reporting service is unavailable. Adding test orders alone will not resolve this.';
  return 'Profit evidence could not be checked.';
}
