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

test('rejects malformed financial-version proof and duplicate month evidence instead of accepting a first match', () => {
 const args={observedThroughLondon:'2027-01-02',existingRows:existingRows()};
 for(const financialVersionId of ['-'.repeat(36),'a'.repeat(36),'00000000000040008000000000000001','00000000-0000-4000-8000-00000000000g']){
  assert.throws(()=>prepareSummaryRefreshProposal({...args,verifiedMonths:[{...receipt('2026-11'),financialVersionId}]}),/financial|evidence/i);
 }
 assert.throws(()=>prepareSummaryRefreshProposal({...args,verifiedMonths:[receipt('2026-11'),receipt('2026-11')]}),/Duplicate verified month/);
 assert.throws(()=>prepareSummaryRefreshProposal({...args,verifiedMonths:[receipt('2026-11'),{...receipt('2026-11'),genuineScheduledReceipt:false}]}),/Duplicate verified month/);
 for(const proof of [null,{...receipt('2026-11'),month:'2026-13'},{...receipt('2026-11'),completeCoverage:'true'},{...receipt('2026-11'),salesRevision:'bad'}])assert.throws(()=>prepareSummaryRefreshProposal({...args,verifiedMonths:[proof]}),/evidence|financial/i);
});

test('missing or unverified predecessor blocks later closed months; only a fully verified contiguous prefix is eligible', () => {
 const args={observedThroughLondon:'2027-02-02',existingRows:existingRows()};
 for(const verifiedMonths of [[receipt('2026-12'),receipt('2027-01')],[{...receipt('2026-11'),genuineScheduledReceipt:false},receipt('2026-12'),receipt('2027-01')]]){
  const p=prepareSummaryRefreshProposal({...args,verifiedMonths});assert.deepEqual(p.candidates.map(c=>c.eligible),[false,false,false]);assert.match(p.candidates[1].reason,/preceding|contiguous/i);
 }
 const gap=prepareSummaryRefreshProposal({...args,verifiedMonths:[receipt('2026-11'),receipt('2027-01')]});assert.deepEqual(gap.candidates.map(c=>c.eligible),[true,false,false]);
 const ready=prepareSummaryRefreshProposal({...args,verifiedMonths:[receipt('2026-11'),receipt('2026-12'),receipt('2027-01')]});assert.deepEqual(ready.candidates.map(c=>c.eligible),[true,true,true]);assert.equal(ready.existingRowsProtected.rows,48);assert.equal(ready.existingRowsProtected.updateAllowed,false);
});
