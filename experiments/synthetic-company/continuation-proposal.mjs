/**
 * Offline-only proposal for extending the isolated synthetic UK Gifts fixture.
 * This materialises deterministic candidate evidence in memory; it does not
 * write files, publish summaries, connect to a service, or assert observations.
 */
import { createHash } from 'node:crypto';
import { generate } from './generator.mjs';

const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const EXPECTED = Object.freeze({
  company: 'fictional-uk-gifts',
  profile: 'uk-gifts-v2',
  publishedThrough: '2026-11-19',
  previouslyReviewedThrough: '2026-12-19',
  from: '2026-12-20',
  through: '2027-03-19',
});

function inRange(value, from, through) { return value >= from && value <= through; }

export function prepareSyntheticContinuationProposal({
  company = EXPECTED.company,
  profile = EXPECTED.profile,
  publishedThrough = EXPECTED.publishedThrough,
  previouslyReviewedThrough = EXPECTED.previouslyReviewedThrough,
  from = EXPECTED.from,
  through = EXPECTED.through,
} = {}) {
  assert(company === EXPECTED.company && profile === EXPECTED.profile, 'Only the existing isolated UK Gifts v2 company is in scope');
  assert(publishedThrough === EXPECTED.publishedThrough, 'Published history anchor differs; stop for a new review');
  assert(previouslyReviewedThrough === EXPECTED.previouslyReviewedThrough, 'Existing finite programme ceiling differs; stop for a new review');
  assert(from === EXPECTED.from && through === EXPECTED.through, 'Only the reviewed 20 Dec 2026–19 Mar 2027 continuation is in scope');

  // asOf is the next London business date, so no generated date exceeds through.
  const candidate = generate({ company, profile, from: '2024-11-01', asOf: '2027-03-20' });
  const daily = candidate.daily.filter(row => inRange(row.date, from, through));
  const events = candidate.events.filter(row => inRange(row.date, from, through));
  const prefixDaily = candidate.daily.filter(row => row.date <= publishedThrough);
  const prefixEvents = candidate.events.filter(row => row.date <= publishedThrough);
  const extensionDaily = daily.map(row => row.date);
  const days = [];
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${through}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  assert(extensionDaily.length === 90, 'The continuation must contain exactly 90 daily source dates');
  assert(JSON.stringify(extensionDaily) === JSON.stringify(days), 'The continuation must cover each requested date exactly once');
  assert(candidate.scope?.company === company && candidate.scope?.profile === profile && candidate.scope?.provenance === 'synthetic-local' && candidate.scope?.provider === null, 'Continuation scope/provider boundary differs');
  assert(events.every(row => row.company === company && row.profile === profile && row.provider === null), 'Continuation event scope/provider boundary differs');

  return Object.freeze({
    contract: 'synthetic-continuation-proposal-v1',
    state: 'prepared-only',
    observed: false,
    remoteApplied: false,
    company,
    profile,
    currency: 'GBP',
    timezone: 'Europe/London',
    publishedThrough,
    previouslyReviewedThrough,
    from,
    through,
    asOf: '2027-03-20',
    dayCount: daily.length,
    eventCount: events.length,
    protectedPrefix: {
      through: publishedThrough,
      dailyRows: prefixDaily.length,
      events: prefixEvents.length,
      dailyHash: sha256(prefixDaily),
      eventHash: sha256(prefixEvents),
    },
    candidate: {
      dailyHash: sha256(daily),
      eventHash: sha256(events),
      futureDated: true,
      sourceMode: 'offline-synthetic-fixture',
    },
    summaryRefresh: {
      state: 'proposal-only',
      nextUnpublishedMonth: '2026-11',
      eligibleNow: false,
      reason: 'Only a closed month with a genuinely verified scheduled financial receipt and exact supported monthly version can enter the Cash/Acquisition summary compiler.',
      existingSummaryMonthsProtected: { from: '2024-11', through: '2026-10', rows: 48 },
      insertionPolicy: 'append-only exact insert or byte-equivalent replay; never update, invalidate, or recreate existing summary rows',
    },
    requiredFutureGates: [
      'Verify genuine scheduled financial-feed receipt evidence; do not manufacture it with a manual append or retry.',
      'For each completed London month, verify the exact synthetic financial version, sales/cost revisions, and complete source coverage.',
      'Compile Cash and Acquisition summaries from that month only; preserve the original 48 published rows and all prior financial seals.',
      'Review correction/replacement, cohort observation windows, restricted-access expiry, and scheduler extension as separate proposals.',
      'Do not apply database, access, data, credential, feed, or scheduler changes from this candidate.',
    ],
  });
}
