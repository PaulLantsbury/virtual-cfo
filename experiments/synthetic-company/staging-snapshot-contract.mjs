/** Proposed private reporting-snapshot contract. Pure validation only; no SQL or authority checks.
 * Caller must authenticate and select rows/revisions in one read-only transaction.
 */
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const stamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,19) === value.slice(0,19);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const bases = new Set(['synthetic-local','shopify-operational','xero-accounting']);
const same = (row, expected) => ['store_id','date_from','date_to','currency','timezone','source_basis','formula_version','contract_version','sales_revision','profit_version_id'].every(key => row[key] === expected[key]);
/** observed_at/recorded_at/now are never substituted for source_as_of. Unknown input fails closed. */
export function validateStagingSnapshot({ expected, rows, refreshState, authorised = false } = {}) {
  const fail = reason => ({state:'unavailable',metadata:null,reason});
  if (!authorised) return fail('Member-authorised selection is required');
  if (!expected || !uuid(expected.store_id) || !date(expected.date_from) || !date(expected.date_to) || expected.date_from > expected.date_to
    || expected.currency !== 'GBP' || expected.timezone !== 'Europe/London' || !bases.has(expected.source_basis)
    || !expected.formula_version || expected.contract_version !== 1 || typeof expected.sales_revision !== 'string' || !expected.sales_revision
    || !(expected.profit_version_id === null || uuid(expected.profit_version_id))) return fail('Invalid expected scope or version');
  if (!['current','stale','failed','invalidated'].includes(refreshState)) return fail('Refresh state unavailable');
  if (refreshState === 'invalidated') return fail('Evidence invalidated');
  // Caller must return the exact-scope candidate set. Never choose an arbitrary first/latest row.
  if (!Array.isArray(rows) || rows.length !== 1) return fail('Snapshot absent or ambiguous');
  const row = rows[0];
  if (!row || !same(row, expected) || !uuid(row.snapshot_id) || row.invalidated_by != null || row.superseded_by != null) return fail('Snapshot scope/version is mismatched, invalidated or superseded');
  if (!stamp(row.source_as_of) || !stamp(row.observed_at) || Date.parse(row.source_as_of) > Date.parse(row.observed_at)) return fail('Verified source as-of is unavailable or inconsistent');
  if (typeof row.manifest_digest !== 'string' || !/^[a-f0-9]{64}$/.test(row.manifest_digest)) return fail('Manifest integrity unavailable');
  if (row.source_basis === 'synthetic-local' && (typeof row.profile_version !== 'string' || !row.profile_version)) return fail('Synthetic profile version unavailable');
  const coverage = row.coverage;
  if (!coverage || coverage.sales !== 'complete' || !['complete','incomplete','unavailable'].includes(coverage.costs)) return fail('Coverage is unavailable');
  const stale = refreshState !== 'current';
  return {state: stale ? 'stale' : coverage.costs === 'complete' ? 'supported' : 'partial', reason: stale ? 'Showing dated same-scope retained evidence' : null,
    metadata:{snapshotId:row.snapshot_id,sourceAsOf:row.source_as_of,formulaVersion:row.formula_version,contractVersion:row.contract_version,
      scope:{storeId:row.store_id,from:row.date_from,to:row.date_to,currency:row.currency,timezone:row.timezone},
      sourceBasis:row.source_basis,coverage:{sales:coverage.sales,costs:coverage.costs},freshness:stale?'stale':'current'}};
}
