import test from 'node:test';
import assert from 'node:assert/strict';
import {shopifyTestDataStatus} from './shopifyTestDataStatus.ts';
import type {ConnectionStatus} from './shopifyStatus.ts';

const base = (): ConnectionStatus => ({state:'available',storeId:'synthetic-store',latestAttempt:{state:'completed',startedAt:'2026-10-29T02:00:00Z',finishedAt:'2026-10-29T02:01:00Z',from:'2026-09-28',to:'2026-10-28',resultCode:'recorded_requires_review'},latestSuccessfulCollection:null,candidate:{state:'current_unverified',from:'2026-09-28',to:'2026-10-28',orderCount:3,refundCount:0,mappedEventCount:0,testExcludedCount:2},financialVerification:'not_assessed'});

test('observed test orders are ingestion evidence, not new revenue or writer/schedule acceptance', () => {
  const data = base(), before = JSON.stringify(data), result = shopifyTestDataStatus(data);
  assert.equal(result.state, 'observed');
  assert.match(result.title, /2 test orders received and excluded from sales/);
  assert.match(result.detail, /not orders created during the reporting period/);
  assert.match(result.detail, /do not identify the test writer’s own orders or prove a daily schedule/);
  assert.equal(JSON.stringify(data), before);
});

test('missing candidate/counts and unconfigured connection do not become zero test orders', () => {
  for (const data of [{...base(),state:'not_configured' as const}, {...base(),candidate:{...base().candidate,state:'unavailable' as const}}, {...base(),candidate:{...base().candidate,testExcludedCount:null}}, {...base(),candidate:{...base().candidate,orderCount:null}}]) {
    assert.equal(shopifyTestDataStatus(data).state, 'unavailable');
    assert.match(shopifyTestDataStatus(data).detail, /does not mean that Shopify has no test orders/);
  }
});

test('zero tests is a dated candidate observation, not proof writer has not run', () => {
  const result = shopifyTestDataStatus({...base(),candidate:{...base().candidate,testExcludedCount:0}});
  assert.equal(result.state, 'none_observed');
  assert.match(result.detail, /not a check of the writer or Shopify right now/);
});

test('inconsistent counts cannot establish ingestion', () => {
  const result = shopifyTestDataStatus({...base(),candidate:{...base().candidate,testExcludedCount:4}});
  assert.equal(result.state, 'unavailable');
  assert.match(result.detail, /exceeds the source-order count/);
});

test('retained test counts remain explicitly qualified during recheck or unfinished attempt', () => {
  const data = base();
  data.candidate.state='needs_recheck';
  data.candidate.testExcludedCount=1;
  data.latestAttempt!.state='unconfirmed';
  const result=shopifyTestDataStatus(data);
  assert.match(result.title, /^1 test order received/);
  assert.match(result.detail, /needs rechecking/);
  assert.match(result.detail, /not confirmed complete/);
});
