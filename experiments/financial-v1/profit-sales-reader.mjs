/**
 * Transactional callback for the proposed profit reader. No network setup,
 * credentials, grants, SQL writes or existing sales-RPC changes.
 *
 * The caller MUST supply the tx owned by readProfitEvidence's repeatable-read,
 * read-only transaction. This callback never opens a second transaction and
 * never accepts cached/client-provided sales or revision values. userId must
 * come from a separately verified server identity, NOT an untrusted request.
 * Membership is rechecked inside that same transaction; this is not JWT auth.
 *
 * Reads all this store's mapped sales/refund history, conservatively retaining
 * the existing adapter's missing/stale evidence checks. Revision binds exact
 * SQL text snapshots of settings, mappings, underlying source/evidence and the
 * selected coverage record. Hashing them proves equality, not completeness of
 * the original external import. Source completeness remains evidenced upstream.
 */
import { createHash } from 'node:crypto';
import { calculateMappedSales } from './cloud-sales-adapter.mjs';

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function realDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 &&
    day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function validate(scope, userId) {
  ensure(nonempty(userId), 'Verified server user identity required');
  ensure(scope && nonempty(scope.storeId), 'Sales store scope required');
  ensure(realDate(scope.from) && realDate(scope.to) && scope.from <= scope.to, 'Invalid sales reporting dates');
  ensure(nonempty(scope.currency) && Intl.supportedValuesOf('currency').includes(scope.currency), 'Unsupported sales currency');
  const digits = new Intl.NumberFormat('en-GB', { style: 'currency', currency: scope.currency }).resolvedOptions();
  ensure(digits.minimumFractionDigits === 2 && digits.maximumFractionDigits === 2, 'Unsupported sales currency precision');
}

export function createProfitSalesReader({ userId } = {}) {
  ensure(nonempty(userId), 'Verified server user identity required');
  return (tx, scope) => readProfitSales(tx, scope, { userId });
}

export async function readProfitSales(tx, scope, { userId } = {}) {
  validate(scope, userId);
  ensure(tx && typeof tx.query === 'function', 'Existing reporting transaction required');
  const { rows: memberships } = await tx.query(
    'SELECT store_id FROM public.store_memberships WHERE user_id=$1 AND store_id=$2',
    [userId, scope.storeId],
  );
  ensure(memberships.length === 1 && memberships[0].store_id === scope.storeId, 'Store membership required');
  const { rows: settings } = await tx.query(
    'SELECT id,currency_code,timezone FROM public.stores WHERE id=$1', [scope.storeId],
  );
  ensure(settings.length === 1 && settings[0].id === scope.storeId && settings[0].currency_code === scope.currency,
    'Store reporting currency unavailable or mismatched');
  ensure(nonempty(settings[0].timezone), 'Store reporting timezone unavailable');
  try { new Intl.DateTimeFormat('en-GB', { timeZone: settings[0].timezone }).format(); }
  catch { throw new Error('Store reporting timezone invalid'); }

  // Views supply monetary components as SQL decimal strings. JSONB serialized
  // as text also preserves raw NUMERIC precision in the hashed revision; do not
  // round it through JavaScript Number before binding the evidence.
  const mappedOrders = await tx.query(
    'SELECT to_jsonb(m)::text AS snapshot FROM finance_v1.order_mapping m WHERE store_id=$1 ORDER BY id', [scope.storeId],
  );
  const mappedRefunds = await tx.query(
    'SELECT to_jsonb(m)::text AS snapshot FROM finance_v1.refund_mapping m WHERE store_id=$1 ORDER BY id', [scope.storeId],
  );
  const selectedCoverage = await tx.query(
    'SELECT to_jsonb(e)::text AS snapshot FROM finance_v1.coverage_evidence e WHERE store_id=$1 AND date_from=$2::date AND date_to=$3::date ORDER BY date_from,date_to',
    [scope.storeId, scope.from, scope.to],
  );
  const orders = mappedOrders.rows.map(row => JSON.parse(row.snapshot));
  const refunds = mappedRefunds.rows.map(row => JSON.parse(row.snapshot));
  const coverage = selectedCoverage.rows.map(row => JSON.parse(row.snapshot));
  const value = calculateMappedSales({ orders, refunds, coverage }, scope);

  // Include complete verification metadata and raw rows so edits not represented
  // by a displayed sales amount still invalidate a sealed profit source revision.
  const rawOrders = await tx.query(
    'SELECT to_jsonb(o)::text AS snapshot FROM public.orders o WHERE store_id=$1 ORDER BY id', [scope.storeId],
  );
  const rawRefunds = await tx.query(
    'SELECT to_jsonb(r)::text AS snapshot FROM public.refunds r WHERE store_id=$1 ORDER BY id', [scope.storeId],
  );
  const orderEvidence = await tx.query(
    'SELECT to_jsonb(e)::text AS snapshot FROM finance_v1.order_evidence e WHERE store_id=$1 ORDER BY order_id', [scope.storeId],
  );
  const refundEvidence = await tx.query(
    'SELECT to_jsonb(e)::text AS snapshot FROM finance_v1.refund_evidence e WHERE store_id=$1 ORDER BY refund_id', [scope.storeId],
  );
  const snapshots = query => query.rows.map(row => row.snapshot);
  const revision = createHash('sha256').update(JSON.stringify({
    contract: 'profit-sales-reader-v1',
    scope: { storeId: scope.storeId, currency: scope.currency, from: scope.from, to: scope.to },
    settings: settings[0],
    mappings: { orders: snapshots(mappedOrders), refunds: snapshots(mappedRefunds) },
    raw: { orders: snapshots(rawOrders), refunds: snapshots(rawRefunds) },
    evidence: { orders: snapshots(orderEvidence), refunds: snapshots(refundEvidence), coverage: snapshots(selectedCoverage) },
  })).digest('hex');
  const eligibleOrders = orders.filter(order => order.original_eligible === true && order.day <= scope.to)
    .map(order => ({ id: order.id, soldOn: order.day }));
  return { value, eligibleOrders, revision };
}
