import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSummaryRefreshProposal } from './summary-refresh-proposal.mjs';

const kinds = ['cash', 'acquisition'];
function existingRows() {
  const out = [];
  for (let y = 2024, m = 11; y < 2026 || y === 2026 && m <= 10; ) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    for (const kind of kinds) out.push({ month, kind });
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
  return out;
}
const receipt = month => ({ month, state: 'verified', genuineScheduledReceipt: true, completeCoverage: true,
  supportedFinancialVersion: true, financialVersionId: '00000000-0000-4000-8000-000000000001',
  salesRevision: 'a'.repeat(64), costRevision: 'b'.repeat(64) });

test('keeps the existing 48 rows immutable and blocks November before it closes', () => {
  const proposal = prepareSummaryRefreshProposal({ observedThroughLondon: '2026-11-20', existingRows: existingRows() });
  assert.equal(proposal.state, 'proposal-only');
  assert.equal(proposal.remoteApplied, false);
  assert.deepEqual(proposal.existingRowsProtected, { from: '2024-11', through: '2026-10', rows: 48, updateAllowed: false, invalidationAllowed: false });
  assert.equal(proposal.nextUnpublishedMonth, '2026-11');
  assert.deepEqual(proposal.candidates, []);
});

test('only offers a closed month after genuine verified scheduled receipt and exact financial coverage', () => {
  const pending = prepareSummaryRefreshProposal({ observedThroughLondon: '2026-12-01', existingRows: existingRows() });
  assert.equal(pending.candidates.length, 1);
  assert.equal(pending.candidates[0].month, '2026-11');
  assert.equal(pending.candidates[0].eligible, false);
  const ready = prepareSummaryRefreshProposal({ observedThroughLondon: '2026-12-02', existingRows: existingRows(), verifiedMonths: [receipt('2026-11')] });
  assert.equal(ready.candidates[0].eligible, true);
});

test('rejects missing, duplicate, overlapping or altered inventories and incomplete provider evidence', () => {
  const rows = existingRows();
  assert.throws(() => prepareSummaryRefreshProposal({ observedThroughLondon: '2026-12-02', existingRows: rows.slice(1) }));
  assert.throws(() => prepareSummaryRefreshProposal({ observedThroughLondon: '2026-12-02', existingRows: [...rows, rows[0]] }));
  assert.throws(() => prepareSummaryRefreshProposal({ observedThroughLondon: '2026-12-02', existingRows: [...rows.slice(0, -1), { month: '2026-11', kind: 'cash' }] }));
  const incomplete = { ...receipt('2026-11'), genuineScheduledReceipt: false };
  const proposal = prepareSummaryRefreshProposal({ observedThroughLondon: '2026-12-02', existingRows: rows, verifiedMonths: [incomplete] });
  assert.equal(proposal.candidates[0].eligible, false);
});
