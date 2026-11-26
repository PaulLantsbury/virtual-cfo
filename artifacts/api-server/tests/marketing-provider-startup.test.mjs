import test from 'node:test';
import assert from 'node:assert/strict';
import {startMarketingProviderRuntime} from '../src/lib/marketing-provider-startup.mjs';

test('all provider web runtimes default off without reading private configuration', async () => {
  const env = new Proxy({}, {get(_target, key) {
    assert.match(String(key), /^NIGHT_SCOUT_(META|GOOGLE)_ADS_(API|REPORT)_RUNTIME_ENABLED$/);
    return undefined;
  }});
  const runtime = await startMarketingProviderRuntime(env);
  assert.deepEqual(runtime.routes, {});
  await runtime.close();
});

test('partial startup failure closes every opened provider and hides upstream secrets', async () => {
  const closed = [];
  const factories = {
    meta: async () => ({service: {}, close: async () => {closed.push('meta'); throw Error('private cleanup');}}),
    metaReport: async () => ({service: {}, close: async () => {closed.push('report');}}),
    google: async () => {throw Error('secret=fictional-canary');},
    googleReport: async () => {assert.fail('must not continue after failed startup');},
  };
  await assert.rejects(startMarketingProviderRuntime({}, factories), {message:'Marketing provider configuration unavailable'});
  assert.deepEqual(closed.sort(), ['meta','report']);
});

test('composition exposes only route ports and closes each runtime once', async () => {
  const closed = [];
  const factories = Object.fromEntries(['meta','metaReport','google','googleReport'].map(name => [name, async () => ({
    service: {name}, authenticate: () => {}, allowedOrigins: ['https://example.invalid'],
    privateCredential: 'fictional-canary', close: async () => {closed.push(name);},
  })]));
  const runtime = await startMarketingProviderRuntime({}, factories);
  assert.equal(Object.keys(runtime.routes).length,4);
  assert.doesNotMatch(JSON.stringify(runtime.routes), /privateCredential|fictional-canary/);
  await runtime.close();
  await runtime.close();
  assert.equal(closed.length,4);
});
