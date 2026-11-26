// Operator-only explicit fictional probe. No provider endpoint or credential loading.
import { readFile } from 'node:fs/promises';
import { probeLoggingCanary, captureAttestation, assertCanaryEnvironment } from './logging-canary.mjs';
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
try {
  if (process.argv.length !== 2) throw new Error('unavailable');
  assertCanaryEnvironment(process.env);
  const transport = await probeLoggingCanary({
    enabled: process.env.NIGHT_SCOUT_FICTIONAL_CANARY_PROBE_ENABLED === 'true',
    targetOrigin: process.env.NIGHT_SCOUT_FICTIONAL_CANARY_ORIGIN,
    approvedRemoteOrigin: process.env.NIGHT_SCOUT_FICTIONAL_CANARY_APPROVED_REMOTE_ORIGIN,
    expiresAt: process.env.NIGHT_SCOUT_FICTIONAL_CANARY_EXPIRES_AT,
  });
  let observations = [];
  if (process.env.NIGHT_SCOUT_FICTIONAL_CANARY_OBSERVATIONS_PATH) {
    const raw = await readFile(process.env.NIGHT_SCOUT_FICTIONAL_CANARY_OBSERVATIONS_PATH, 'utf8');
    if (Buffer.byteLength(raw) > 16384) throw new Error('unavailable');
    observations = JSON.parse(raw);
    if (!Array.isArray(observations)) throw new Error('unavailable');
  }
  const receipt = captureAttestation(transport, observations, process.env.NIGHT_SCOUT_FICTIONAL_CANARY_PROFILE ?? 'api');
  emit(receipt);
  // A transport pass without complete external sink evidence is deliberately nonzero.
  if (!receipt.pass) process.exitCode = 1;
} catch {
  emit(captureAttestation({ sink: 'transport', fieldCount: 0, pass: false }));
  process.exitCode = 1;
}
