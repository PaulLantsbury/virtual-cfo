// Bounded metadata only. Caller owns the validated dedicated-role READ ONLY transaction.
const fail = () => { throw Error('Shopify nightly metadata unavailable'); };
const states = new Set(['running', 'completed', 'unconfirmed']);
const codes = new Set(['recorded_requires_review', 'changed_requires_review', 'replay', 'historical_replay', 'stale_source', 'conflicting_source', 'missing_source']);
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const instant = v => {
  const value = v instanceof Date ? v.toISOString() : v;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail();
  return new Date(value).toISOString();
};
export async function readRecentNightlyHistory(client, { storeId, localDate, timezone }) {
  if (!client || typeof client.query !== 'function' || !/^[0-9a-f-]{36}$/i.test(storeId ?? '') || !date(localDate) || timezone !== 'Europe/London') fail();
  const from = new Date(Date.parse(localDate) - 6 * 86400000).toISOString().slice(0, 10);
  const claims = (await client.query(`SELECT local_date::text,timezone,scheduled_at,date_from::text,date_to::text,state,started_at,finished_at
FROM ingest_v1.nightly_claims WHERE store_id=$1 AND local_date BETWEEN $2::date AND $3::date
ORDER BY local_date DESC LIMIT 7`, [storeId, from, localDate])).rows;
  const attempts = (await client.query(`SELECT (started_at AT TIME ZONE $4)::date::text AS local_date,date_from::text,date_to::text,state,result_code,started_at,finished_at
FROM ingest_v1.sync_attempts WHERE store_id=$1 AND started_at >= ($2::date::timestamp AT TIME ZONE $4)
AND started_at < (($3::date+1)::timestamp AT TIME ZONE $4) ORDER BY started_at DESC,id DESC LIMIT 16`, [storeId, from, localDate, timezone])).rows;
  if (!Array.isArray(claims) || claims.length > 7 || !Array.isArray(attempts) || attempts.length > 16) fail();
  const summary = r => {
    if (!date(r.local_date) || r.local_date < from || r.local_date > localDate || !date(r.date_from) || !date(r.date_to) || r.date_from > r.date_to || Date.parse(r.date_to) - Date.parse(r.date_from) >= 31 * 86400000 || !states.has(r.state)) fail();
    const startedAt = instant(r.started_at), finishedAt = r.finished_at === null ? null : instant(r.finished_at);
    if ((r.state === 'running') !== (finishedAt === null) || (finishedAt !== null && finishedAt < startedAt)) fail();
    return { localDate: r.local_date, from: r.date_from, to: r.date_to, state: r.state, startedAt, finishedAt };
  };
  const claimDates = new Set();
  const recentClaims = claims.map(r => {
    if (claimDates.has(r.local_date) || r.timezone !== timezone) fail();
    claimDates.add(r.local_date);
    const item = summary(r), scheduledAt = instant(r.scheduled_at);
    return { ...item, timezone, scheduledAt };
  });
  const recentAttempts = attempts.map(r => {
    if (r.state === 'completed' ? !codes.has(r.result_code) : r.result_code !== null) fail();
    return { ...summary(r), resultCode: r.result_code };
  });
  return { fromLocalDate: from, toLocalDate: localDate, timezone, recentClaims, recentAttempts: recentAttempts.slice(0, 15), attemptHistoryTruncated: attempts.length > 15, hostReceiptCorrelation: 'not_assessed' };
}
