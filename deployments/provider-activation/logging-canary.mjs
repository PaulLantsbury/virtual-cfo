// Standalone fictional diagnostic. Never import into the customer application.
import http from 'node:http';
import { pathToFileURL } from 'node:url';

export const FIELD_CLASSES = Object.freeze(['query', 'headers', 'body', 'error', 'response']);
export const SINKS = Object.freeze([
  'website-ingress', 'website-application', 'website-runtime-agent', 'website-proxy-outbound', 'website-exports',
  'api-ingress', 'api-application', 'api-runtime-agent', 'api-outbound', 'api-exports',
  'collector-application', 'collector-runtime-agent', 'collector-outbound', 'collector-exports',
]);
export const SINK_PROFILES = Object.freeze({
  api: Object.freeze(SINKS.slice(0, 10)),
  collector: Object.freeze(SINKS.slice(10)),
  combined: SINKS,
});
export const MARKERS = Object.freeze({
  query: 'NIGHT_SCOUT_FICTIONAL_QUERY_SENTINEL',
  headers: 'NIGHT_SCOUT_FICTIONAL_HEADER_SENTINEL',
  body: 'NIGHT_SCOUT_FICTIONAL_BODY_SENTINEL',
  error: 'NIGHT_SCOUT_FICTIONAL_ERROR_SENTINEL',
  response: 'NIGHT_SCOUT_FICTIONAL_RESPONSE_SENTINEL',
});
const PREFIX = '/__night_scout_fictional_logging_canary__';
// Existing reviewed website only. A different host requires a reviewed source change.
const REMOTE_ORIGIN = 'https://night-scout-xero-staging.onrender.com';
const MAX_LIFETIME_MS = 15 * 60 * 1000;
const safe = (sink, fieldCount, pass) => Object.freeze({ sink, fieldCount, pass });
const fail = () => new Error('Fictional logging canary unavailable');
export function assertCanaryEnvironment(env) {
  // Credential names only; inspect values solely for known nonsecret disabled controls.
  const controls = new Set(['NIGHT_SCOUT_PROVIDER_API_HOST_ENABLED']);
  for (const provider of ['META', 'GOOGLE']) for (const suffix of ['API_RUNTIME_ENABLED', 'REPORT_RUNTIME_ENABLED', 'COLLECTOR_RUNTIME_ENABLED', 'COLLECTOR_ENABLED', 'ACCEPTANCE_ENABLED']) controls.add(`NIGHT_SCOUT_${provider}_ADS_${suffix}`);
  for (const key of Object.keys(env)) {
    if (controls.has(key)) {
      if (Object.getOwnPropertyDescriptor(env, key)?.value !== 'false') throw fail();
    } else if (/^NIGHT_SCOUT_(META|GOOGLE)_ADS_/.test(key)
      || /^NIGHT_SCOUT_REVIEW_/.test(key) || /^SUPABASE_/.test(key)
      || ['DATABASE_URL', 'PGPASSWORD', 'OPENAI_API_KEY', 'RENDER_API_KEY'].includes(key)) throw fail();
  }
}
function origin(value, remote = false) {
  let u; try { u = new URL(value); } catch { throw fail(); }
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/' || !['http:', 'https:'].includes(u.protocol)) throw fail();
  const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(u.hostname);
  if ((!loopback && (!remote || u.protocol !== 'https:')) || (remote && (loopback || u.origin !== REMOTE_ORIGIN))) throw fail();
  return u.origin;
}
function windowMs(expiresAt, now) {
  if (typeof expiresAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(expiresAt)) throw fail();
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end) || new Date(end).toISOString() !== expiresAt || end <= now || end - now > MAX_LIFETIME_MS) throw fail();
  return end - now;
}
async function boundedBody(req) {
  const parts = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024) throw fail();
    parts.push(chunk);
  }
  return Buffer.concat(parts).toString('utf8');
}

/** Exactly one two-request probe per process. Default off; finite expiry/close. */
export async function startLoggingCanary({ enabled = false, mode = 'local', expiresAt, port = 0, publicOrigin, log = () => {}, now = () => Date.now() } = {}) {
  if (enabled !== true) return undefined;
  if (!['local', 'isolated-host'].includes(mode) || !Number.isInteger(port) || port < 0 || port > 65535 || typeof log !== 'function') throw fail();
  if (mode === 'isolated-host' && (port === 0 || !publicOrigin)) throw fail();
  const expectedOrigin = mode === 'isolated-host' ? origin(publicOrigin, true) : null;
  const lifetime = windowMs(expiresAt, now());
  let used = 0, closed = false, inFlight = false, timer, closePromise;
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    // Never echo a request value or an Error message, even on parser failure.
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('referrer-policy', 'no-referrer');
    const reply = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    if (closed || now() >= Date.parse(expiresAt) || used >= 2 || inFlight) { reply(410, { unavailable: true }); return; }
    inFlight = true;
    let valid = false;
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      const expectedStep = used === 0 ? 'capture' : 'failure';
      const body = await boundedBody(req);
      valid = req.method === 'POST' && u.pathname === `${PREFIX}/${expectedStep}`
        && [...u.searchParams.keys()].length === 2
        && u.searchParams.get('code') === MARKERS.query && u.searchParams.get('state') === MARKERS.query
        && req.headers.authorization === `Bearer ${MARKERS.headers}`
        && req.headers['x-provider-secret'] === MARKERS.headers
        && req.headers['content-type'] === 'application/json'
        && body === JSON.stringify({ client_secret: MARKERS.body, refresh_token: MARKERS.body });
      if (!valid) throw fail();
      used += 1;
      if (expectedStep === 'failure') {
        try { throw new Error(MARKERS.error); } catch { log(safe('application', 5, true)); }
        reply(503, { unavailable: true, marker: MARKERS.response });
      } else {
        log(safe('application', 5, true));
        reply(200, { fictional: true, marker: MARKERS.response });
      }
      // Close only after the second response has finished, then close idle sockets.
      if (used === 2) res.once('finish', () => void close());
    } catch {
      log(safe('application', 0, false));
      reply(400, { unavailable: true });
      res.once('finish', () => void close());
    } finally { inFlight = false; }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.maxRequestsPerSocket = 2;
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  const close = () => {
    if (closePromise) return closePromise;
    closed = true; clearTimeout(timer);
    closePromise = new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); setTimeout(() => { for (const s of sockets) s.destroy(); }, 250).unref(); })
      .then(() => log(safe('cleanup', 0, true)));
    return closePromise;
  };
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, mode === 'local' ? '127.0.0.1' : '0.0.0.0', resolve); });
  timer = setTimeout(() => void close(), lifetime); timer.unref();
  const address = server.address();
  return Object.freeze({ targetOrigin: expectedOrigin ?? `http://127.0.0.1:${address.port}`, close, get closed() { return closed; }, get requestCount() { return used; } });
}

/** Local by default; remote probe requires explicit exact target and separate approval. */
export async function probeLoggingCanary({ enabled = false, targetOrigin, approvedRemoteOrigin, expiresAt, fetchImpl = fetch } = {}) {
  if (enabled !== true) return safe('transport', 0, false);
  windowMs(expiresAt, Date.now());
  const remote = approvedRemoteOrigin !== undefined;
  const target = origin(targetOrigin, remote);
  if (remote && target !== origin(approvedRemoteOrigin, true)) throw fail();
  let complete = 0;
  try {
    for (const [step, status] of [['capture', 200], ['failure', 503]]) {
      const u = new URL(`${PREFIX}/${step}`, target);
      u.searchParams.set('code', MARKERS.query); u.searchParams.set('state', MARKERS.query);
      const response = await fetchImpl(u, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { authorization: `Bearer ${MARKERS.headers}`, 'x-provider-secret': MARKERS.headers, 'content-type': 'application/json' },
        body: JSON.stringify({ client_secret: MARKERS.body, refresh_token: MARKERS.body }) });
      if (response.status !== status) throw fail();
      const reader = response.body?.getReader(); if (!reader) throw fail();
      let bytes = 0, text = ''; const decoder = new TextDecoder('utf8', { fatal: true });
      try { while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 1024) throw fail(); text += decoder.decode(chunk.value, { stream: true }); } text += decoder.decode(); }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const body = JSON.parse(text);
      if (body.marker !== MARKERS.response || response.headers.get('cache-control') !== 'no-store') throw fail();
      complete += 1;
    }
    return safe('transport', 5, complete === 2);
  } catch { return safe('transport', complete ? 5 : 0, false); }
}

/** External observations required: transport/echo/local logging can never pass this alone. */
export function captureAttestation(transport, observations = [], profile = 'api') {
  const required = Object.hasOwn(SINK_PROFILES, profile) ? SINK_PROFILES[profile] : [];
  const sinks = required.map(sink => {
    const rows = observations.filter(x => x?.sink === sink);
    const row = rows.length === 1 ? rows[0] : null;
    const fields = row?.fields;
    const fieldCount = fields && typeof fields === 'object' ? FIELD_CLASSES.filter(k => Object.hasOwn(fields, k)).length : 0;
    const pass = row?.evidenceReviewed === true && row?.sameConfiguration === true && fieldCount === 5
      && Object.keys(fields).length === 5 && FIELD_CLASSES.every(k => fields[k] === 'absent-verified' || fields[k] === 'disabled-verified');
    return safe(sink, fieldCount, pass);
  });
  const transportPass = transport?.sink === 'transport' && transport?.fieldCount === 5 && transport?.pass === true;
  return Object.freeze({ transport: safe('transport', transportPass ? 5 : 0, transportPass), sinks: Object.freeze(sinks), pass: transportPass && required.length > 0 && observations.length === required.length && sinks.every(x => x.pass) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
  try {
    assertCanaryEnvironment(process.env);
    const enabled = process.env.NIGHT_SCOUT_FICTIONAL_CANARY_ENABLED === 'true';
    const server = await startLoggingCanary({ enabled, mode: process.env.NIGHT_SCOUT_FICTIONAL_CANARY_MODE ?? 'local',
      expiresAt: process.env.NIGHT_SCOUT_FICTIONAL_CANARY_EXPIRES_AT,
      port: Number(process.env.PORT ?? 0), publicOrigin: process.env.NIGHT_SCOUT_FICTIONAL_CANARY_ORIGIN, log: emit });
    if (!server) emit(safe('lifecycle', 0, false));
    else {
      emit(safe('lifecycle', 0, true));
      const stop = async () => { await server.close(); };
      process.once('SIGTERM', stop); process.once('SIGINT', stop);
    }
  } catch { emit(safe('lifecycle', 0, false)); process.exitCode = 1; }
}
