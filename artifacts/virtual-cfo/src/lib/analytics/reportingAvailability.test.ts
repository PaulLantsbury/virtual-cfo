import test from 'node:test';
import assert from 'node:assert/strict';
import { salesAvailabilityReason, profitHttpFailure } from './reportingAvailability.ts';

test('sales distinguishes unverified coverage from unavailable service without exposing raw details', () => {
  assert.match(salesAvailabilityReason('Sales/refund coverage evidence missing'), /exact reporting period/);
  assert.match(salesAvailabilityReason('Verified sales request unavailable'), /store access or the reporting service/);
  assert.match(salesAvailabilityReason('Missing or stale source evidence'), /need review/);
  assert.doesNotMatch(salesAvailabilityReason('secret database details'), /secret database/);
});

test('profit failures distinguish authentication, membership, missing route and service availability', () => {
  assert.match(profitHttpFailure(401), /Sign in again/);
  assert.match(profitHttpFailure(403), /not accessible/);
  assert.match(profitHttpFailure(404), /not available on this website/);
  assert.match(profitHttpFailure(503), /service is unavailable/);
  assert.equal(profitHttpFailure(500), 'Profit evidence could not be checked.');
});
