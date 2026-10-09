import test from 'node:test';
import assert from 'node:assert/strict';
import { salesAvailabilityReason, profitHttpFailure, readProfitResponse } from './reportingAvailability.ts';

test('sales distinguishes unverified coverage from unavailable service without exposing raw details', () => {
  assert.match(salesAvailabilityReason('Sales/refund coverage evidence missing'), /exact reporting period/);
  assert.match(salesAvailabilityReason('Verified sales request unavailable'), /store access or the reporting service/);
  assert.match(salesAvailabilityReason('Missing or stale source evidence'), /need review/);
  assert.doesNotMatch(salesAvailabilityReason('secret database details'), /secret database/);
});

test('profit configuration status is distinct, while arbitrary diagnostics stay private', async () => {
  await assert.rejects(readProfitResponse(new Response(JSON.stringify({error:'Profit reporting is not configured'}), {status:503})), /has not been enabled/);
  await assert.rejects(readProfitResponse(new Response(JSON.stringify({error:'postgres password private detail'}), {status:503})), error => error instanceof Error && /service is unavailable/.test(error.message) && !/postgres|password|private detail/.test(error.message));
  await assert.rejects(readProfitResponse(new Response('<html>private proxy diagnostics</html>', {status:200})), /unreadable response/);
  await assert.rejects(readProfitResponse(new Response('<html>private proxy diagnostics</html>', {status:404})), /not available on this website/);
  assert.deepEqual(await readProfitResponse(new Response(JSON.stringify({state:'unavailable',reason:'No sealed evidence'}))), {state:'unavailable',reason:'No sealed evidence'});
});

test('profit failures distinguish authentication, membership, missing route and service availability', () => {
  assert.match(profitHttpFailure(401), /Sign in again/);
  assert.match(profitHttpFailure(403), /not accessible/);
  assert.match(profitHttpFailure(404), /not available on this website/);
  assert.match(profitHttpFailure(503), /service is unavailable/);
  assert.equal(profitHttpFailure(500), 'Profit evidence could not be checked.');
});
