// Offline receipt evaluation only: never repeats the HTTP probe.
import { readFile, stat } from 'node:fs/promises';
import { captureAttestation } from './logging-canary.mjs';
const readJson = async path => {
  if (typeof path !== 'string' || !path || (await stat(path)).size > 65536) throw Error('unavailable');
  return JSON.parse(await readFile(path, 'utf8'));
};
try {
  if (process.argv.length !== 2) throw Error('unavailable');
  const saved = await readJson(process.env.NIGHT_SCOUT_FICTIONAL_CANARY_RECEIPT_PATH);
  const observations = await readJson(process.env.NIGHT_SCOUT_FICTIONAL_CANARY_OBSERVATIONS_PATH);
  if (!Array.isArray(observations)) throw Error('unavailable');
  const receipt = captureAttestation(saved.transport, observations, process.env.NIGHT_SCOUT_FICTIONAL_CANARY_PROFILE ?? 'api');
  process.stdout.write(JSON.stringify(receipt) + '\n');
  if (!receipt.pass) process.exitCode = 1;
} catch {
  process.stdout.write(JSON.stringify(captureAttestation({ sink: 'transport', fieldCount: 0, pass: false })) + '\n');
  process.exitCode = 1;
}
