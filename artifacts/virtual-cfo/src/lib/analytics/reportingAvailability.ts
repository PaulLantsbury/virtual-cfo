/** Only fixed, customer-safe explanations are surfaced; never raw server errors. */
export function salesAvailabilityReason(message?: string) {
  if (message === 'Sales/refund coverage evidence missing') return 'Sales and refund coverage has not been verified for this exact reporting period.';
  if (message === 'Missing or stale source evidence') return 'Some sales or refund records still need review.';
  if (message === 'Verified sales request unavailable') return 'Sales evidence could not be checked. Retry the check; if this continues, store access or the reporting service needs attention.';
  return 'Sales evidence is incomplete or could not be verified for this reporting period.';
}

export function profitHttpFailure(status: number, error?: unknown) {
  if (status === 401) return 'Sign in again to check profit evidence.';
  if (status === 403) return 'Profit evidence is not accessible for this store.';
  if (status === 404) return 'Profit reporting is not available on this website yet.';
  if (status === 503 && error === 'Profit reporting is not configured') return 'Profit reporting has not been enabled on this website. Your sales evidence can still be checked separately.';
  if (status === 503) return 'The profit reporting service is unavailable. Adding test orders alone will not resolve this.';
  return 'Profit evidence could not be checked.';
}

/** Parse once, and allow only known public status explanations through. */
export async function readProfitResponse(response: Response): Promise<unknown> {
  let result: unknown;
  try { result = await response.json(); }
  catch {
    if (!response.ok) throw new Error(profitHttpFailure(response.status));
    throw new Error('The profit reporting service returned an unreadable response. Retry the evidence check.');
  }
  if (!response.ok) {
    const error = result && typeof result === 'object' ? (result as {error?: unknown}).error : undefined;
    throw new Error(profitHttpFailure(response.status, error));
  }
  return result;
}
