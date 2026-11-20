import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSyntheticContinuationProposal } from './continuation-proposal.mjs';

test('prepares the exact 90-day UK Gifts continuation as future synthetic evidence only', () => {
  const proposal = prepareSyntheticContinuationProposal();
  assert.equal(proposal.contract, 'synthetic-continuation-proposal-v1');
  assert.equal(proposal.state, 'prepared-only');
  assert.equal(proposal.observed, false);
  assert.equal(proposal.remoteApplied, false);
  assert.equal(proposal.company, 'fictional-uk-gifts');
  assert.equal(proposal.profile, 'uk-gifts-v2');
  assert.equal(proposal.from, '2026-12-20');
  assert.equal(proposal.through, '2027-03-19');
  assert.equal(proposal.dayCount, 90);
  assert.equal(proposal.candidate.futureDated, true);
  assert.match(proposal.candidate.dailyHash, /^[a-f0-9]{64}$/);
  assert.match(proposal.candidate.eventHash, /^[a-f0-9]{64}$/);
  assert.equal(proposal.summaryRefresh.eligibleNow, false);
  assert.equal(proposal.summaryRefresh.existingSummaryMonthsProtected.rows, 48);
  assert.equal(proposal.summaryRefresh.insertionPolicy.startsWith('append-only'), true);
});

test('replays the same candidate hashes and keeps the already published prefix fixed', () => {
  const first = prepareSyntheticContinuationProposal();
  const replay = prepareSyntheticContinuationProposal();
  assert.deepEqual(replay.candidate, first.candidate);
  assert.deepEqual(replay.protectedPrefix, first.protectedPrefix);
  assert.equal(first.protectedPrefix.through, '2026-11-19');
});

test('refuses changes to the company, profile, publication anchor, finite ceiling or date window', () => {
  for (const change of [
    { company: 'fictional-other-company' },
    { profile: 'uk-gifts-v1' },
    { publishedThrough: '2026-11-20' },
    { previouslyReviewedThrough: '2026-12-20' },
    { from: '2026-12-19' },
    { through: '2027-03-20' },
  ]) assert.throws(() => prepareSyntheticContinuationProposal(change));
});
