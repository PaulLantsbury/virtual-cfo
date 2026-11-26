import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startLoggingCanary, probeLoggingCanary, captureAttestation, assertCanaryEnvironment, FIELD_CLASSES, SINK_PROFILES, MARKERS } from './logging-canary.mjs';
const expiry = () => new Date(Date.now() + 60000).toISOString();

test('default off creates no listener and sends no request', async () => {
  assert.equal(await startLoggingCanary(), undefined);
  let called = false;
  const result = await probeLoggingCanary({ fetchImpl: () => { called = true; } });
  assert.equal(called, false); assert.deepEqual(result, { sink: 'transport', fieldCount: 0, pass: false });
});

test('diagnostic process rejects provider/DB/key variable names without reading their values', () => {
  for (const key of ['NIGHT_SCOUT_META_ADS_APP_SECRET', 'NIGHT_SCOUT_GOOGLE_ADS_DEVELOPER_TOKEN', 'NIGHT_SCOUT_REVIEW_PUBLIC_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'PGPASSWORD', 'OPENAI_API_KEY', 'RENDER_API_KEY']) {
    const env = {}; let read = false;
    Object.defineProperty(env, key, { enumerable: true, get() { read = true; throw Error('must not read'); } });
    assert.throws(() => assertCanaryEnvironment(env)); assert.equal(read, false);
  }
  assert.doesNotThrow(() => assertCanaryEnvironment({ PORT: '12345', NIGHT_SCOUT_FICTIONAL_CANARY_ENABLED: 'false' }));
  for (const key of ['NIGHT_SCOUT_PROVIDER_API_HOST_ENABLED', 'NIGHT_SCOUT_META_ADS_API_RUNTIME_ENABLED', 'NIGHT_SCOUT_GOOGLE_ADS_API_RUNTIME_ENABLED', 'NIGHT_SCOUT_META_ADS_COLLECTOR_ENABLED']) {
    assert.doesNotThrow(() => assertCanaryEnvironment({ [key]: 'false' }));
    for (const value of ['true', '', 'FALSE', false]) assert.throws(() => assertCanaryEnvironment({ [key]: value }));
  }
});

test('actual HTTP exercises five fictional field classes, redacts app logs, and closes after one attempt', async () => {
  const logs = [];
  const server = await startLoggingCanary({ enabled: true, expiresAt: expiry(), log: x => logs.push(x) });
  try {
    const result = await probeLoggingCanary({ enabled: true, targetOrigin: server.targetOrigin, expiresAt: expiry() });
    assert.deepEqual(result, { sink: 'transport', fieldCount: 5, pass: true });
    assert.equal(server.requestCount, 2);
    await server.close(); assert.equal(server.closed, true);
    assert.equal(logs.filter(x => x.sink === 'application').length, 2);
    assert.equal(logs.filter(x => x.sink === 'cleanup' && x.pass).length, 1);
    for (const marker of Object.values(MARKERS)) assert.equal(JSON.stringify(logs).includes(marker), false);
    assert.ok(logs.every(x => Object.keys(x).join(',') === 'sink,fieldCount,pass'));
    const repeat = await probeLoggingCanary({ enabled: true, targetOrigin: server.targetOrigin, expiresAt: expiry() });
    assert.equal(repeat.pass, false);
    assert.equal(captureAttestation(result).pass, false, 'echo success is not hosted capture evidence');
  } finally { await server.close(); }
});

test('invalid request terminates the diagnostic without echo or forwarding', async () => {
  const logs = [];
  const server = await startLoggingCanary({ enabled: true, expiresAt: expiry(), log: x => logs.push(x) });
  try {
    const response = await fetch(server.targetOrigin + '/not-a-provider?secret=DO_NOT_ECHO', { method: 'POST', body: 'DO_NOT_ECHO' });
    assert.equal(response.status, 400);
    assert.equal((await response.text()).includes('DO_NOT_ECHO'), false);
    await server.close(); assert.equal(server.closed, true);
    assert.equal(JSON.stringify(logs).includes('DO_NOT_ECHO'), false);
  } finally { await server.close(); }
});

test('expiry is real, bounded and cannot revive old diagnostic approvals', async () => {
  for (const expiresAt of ['not-a-date', '2026-02-30T00:00:00.000Z', new Date(Date.now() - 1).toISOString(), new Date(Date.now() + 3600000).toISOString()]) {
    await assert.rejects(startLoggingCanary({ enabled: true, expiresAt }));
  }
  const server = await startLoggingCanary({ enabled: true, expiresAt: new Date(Date.now() + 75).toISOString() });
  await new Promise(resolve => setTimeout(resolve, 125));
  assert.equal(server.closed, true);
  await server.close();
});

test('remote origin requires explicit exact HTTPS binding before any HTTP', async () => {
  let calls = 0; const fetchImpl = () => { calls += 1; throw Error('must not call'); };
  for (const targetOrigin of ['https://example.com', 'http://example.com', 'https://user:secret@example.com', 'https://example.com/path', 'https://example.com?token=example']) {
    await assert.rejects(probeLoggingCanary({ enabled: true, targetOrigin, expiresAt: expiry(), fetchImpl }));
  }
  await assert.rejects(probeLoggingCanary({ enabled: true, targetOrigin: 'https://example.com', approvedRemoteOrigin: 'https://different.example', expiresAt: expiry(), fetchImpl }));
  for (const targetOrigin of ['https://graph.facebook.com', 'https://googleads.googleapis.com']) {
    await assert.rejects(probeLoggingCanary({ enabled: true, targetOrigin, approvedRemoteOrigin: targetOrigin, expiresAt: expiry(), fetchImpl }));
  }
  assert.equal(calls, 0);
  await assert.rejects(startLoggingCanary({ enabled: true, mode: 'isolated-host', expiresAt: expiry(), port: 12345 }));
});

test('complete reviewed sink matrix required; unknown or exposed fields never pass', () => {
  const transport = { sink: 'transport', fieldCount: 5, pass: true };
  const valid = SINK_PROFILES.api.map(sink => ({ sink, evidenceReviewed: true, sameConfiguration: true, fields: Object.fromEntries(FIELD_CLASSES.map(k => [k, 'absent-verified'])) }));
  const receipt = captureAttestation(transport, valid);
  assert.equal(receipt.pass, true);
  for (const sink of SINK_PROFILES.api) for (const field of FIELD_CLASSES) {
    for (const verdict of ['present', 'unobservable', undefined]) {
      const bad = structuredClone(valid); bad.find(x => x.sink === sink).fields[field] = verdict;
      assert.equal(captureAttestation(transport, bad).pass, false);
    }
  }
  assert.equal(captureAttestation(transport, valid.slice(1)).pass, false);
  assert.equal(captureAttestation(transport, [...valid, valid[0]]).pass, false);
  const changed = structuredClone(valid); changed[0].sameConfiguration = false;
  assert.equal(captureAttestation(transport, changed).pass, false);
  assert.equal(captureAttestation({ ...transport, pass: false }, valid).pass, false);
  assert.ok(receipt.sinks.every(x => Object.keys(x).join(',') === 'sink,fieldCount,pass'));
  const collector = SINK_PROFILES.collector.map(sink => ({ sink, evidenceReviewed: true, sameConfiguration: true, fields: Object.fromEntries(FIELD_CLASSES.map(k => [k, 'disabled-verified'])) }));
  assert.equal(captureAttestation(transport, collector, 'collector').pass, true);
  assert.equal(captureAttestation(transport, valid, 'collector').pass, false);
  assert.equal(captureAttestation(transport, [...valid, ...collector], 'combined').pass, true);
  assert.equal(captureAttestation(transport, [], 'ignore-all-sinks').pass, false);
});

test('offline attestation CLI evaluates saved transport after inspection without repeating probe', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'night-scout-fictional-canary-'));
  try {
    const receiptPath = join(dir, 'receipt.json'), observationsPath = join(dir, 'observations.json');
    await writeFile(receiptPath, JSON.stringify(captureAttestation({ sink: 'transport', fieldCount: 5, pass: true })));
    const observations = SINK_PROFILES.api.map(sink => ({ sink, evidenceReviewed: true, sameConfiguration: true, fields: Object.fromEntries(FIELD_CLASSES.map(k => [k, 'disabled-verified'])) }));
    await writeFile(observationsPath, JSON.stringify(observations));
    const args = [fileURLToPath(new URL('./logging-attest.mjs', import.meta.url))];
    const options = { encoding: 'utf8', env: { ...process.env, NIGHT_SCOUT_FICTIONAL_CANARY_RECEIPT_PATH: receiptPath, NIGHT_SCOUT_FICTIONAL_CANARY_OBSERVATIONS_PATH: observationsPath } };
    const result = JSON.parse(execFileSync(process.execPath, args, options));
    assert.equal(result.pass, true); assert.equal(result.sinks.length, 10);
    observations[0].fields.query = 'unobservable'; await writeFile(observationsPath, JSON.stringify(observations));
    assert.throws(() => execFileSync(process.execPath, args, options), error => JSON.parse(error.stdout).pass === false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
