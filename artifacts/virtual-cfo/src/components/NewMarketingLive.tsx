import {reportingMonthLabel} from '@/lib/reportingMonth';
import { useState } from 'react';
import { DecisionSection } from './DecisionSection';
import { NewMarketingConnections } from './NewMarketingConnections';
import { useReviewedHistory } from '@/lib/useReviewedHistory';
import { linkedMarketingMetrics } from '@/lib/marketing/linked-model';
import { useReviewedSupplement } from '@/lib/useReviewedSupplement';
import { acquisitionFinancialContext, acquisitionView } from '@/lib/marketing/acquisition-evidence';
import { AcquisitionEvidence } from './AcquisitionEvidence';

const money = (pence: number | null, perOrder = false) => pence === null ? 'Unavailable' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: perOrder ? 2 : 0, maximumFractionDigits: perOrder ? 2 : 0 }).format(pence / 100);
const multiple = (value: number | null) => value === null ? 'Unavailable' : `${value.toFixed(2)}×`;
const NOT_LINKED = 'Not linked · evidence unavailable';

/** Connected financial totals never borrow acquisition/cohort facts from the design fixture. */
export function NewMarketingLive({ onShowSample }: { onShowSample: () => void }) {
  const history = useReviewedHistory();
  const [perOrder, setPerOrder] = useState(false);
  const month = history.month, m = linkedMarketingMetrics(month);
  const acquisitionSource = useReviewedSupplement(history, 'acquisition');
  const acquisition = !acquisitionSource.loading && !acquisitionSource.error ? acquisitionView(acquisitionSource.payload, acquisitionFinancialContext(month)) : null;
  const display = (pence: number | null) => money(pence === null ? null : perOrder ? m && m.orders > 0 ? pence / m.orders : null : pence, perOrder);
  const amountUnavailable = (pence: number | null) => pence === null || perOrder && (!m || m.orders <= 0);
  const unit = perOrder ? ' / original order' : '';
  const values = m ? [
    ['Contribution before ads', m.beforeAds], ['Advertising', m.advertising],
    ['Contribution after ads', m.contribution], ['Overheads excluding D&A', m.overheads], ['EBITDA', m.ebitda],
  ] as const : [];
  const max = Math.max(1, ...values.map(([, n]) => Math.abs(n ?? 0)));
  return <div className="new-profit marketing-review mr-linked-review">
    <header className="np-header"><div><span className="mr-eyebrow">GROWTH & MARKETING</span><h1>Marketing Efficiency</h1><p>Know what marketing is earning — and what still needs evidence.</p></div><a className="mr-button mr-secondary" href="#marketing-linked-numbers">Explore the Numbers</a></header>
    <div className="mr-review-label"><p><strong>{month ? 'Connected reporting · synthetic company.' : 'Database reporting · choose verified evidence.'}</strong> {month ? 'The selected monthly financial figures passed their source check through the restricted Supabase reporting service.' : 'No verified month is selected. Figures appear only after the selected company, month and evidence version pass their source check.'} These records describe synthetic company activity, not Shopify, Xero or advertising-platform results.</p><button className="mr-text-link" onClick={onShowSample}>Open sample planner · not linked</button></div>
    <p className="mr-link-key"><span className="mr-link-ready">Connected / calculated from verified evidence</span> <span className="mr-not-linked">Yellow = sample, unavailable or unsupported input</span></p>
    <div className="np-controls" aria-label="Connected marketing reporting controls">
      <label>Month<select aria-label="Marketing reviewed month" value={history.selection.period.from} onChange={e => history.selectMonth(e.target.value)}><option value="">Choose a month</option>{history.months.map(item => <option key={item.from} value={item.from}>{reportingMonthLabel(item.from)}</option>)}</select></label>

      <div className="np-control-group"><span>Amounts</span><div className="np-segment"><button aria-pressed={!perOrder} onClick={() => setPerOrder(false)}>Total</button><button aria-pressed={perOrder} onClick={() => setPerOrder(true)}>Per order</button></div></div>
    </div>
    <p className="mr-caption">Headline cards: one complete reviewed month · GBP excluding VAT · Europe/London. The separate history panel compares reviewed monthly results. Daily updates do not seal an incomplete month automatically.</p>
    {(history.loading || history.loadingMonths) && <p role="status">Checking reviewed marketing financial evidence…</p>}
    {history.error && <p role="alert">{history.error} <button onClick={history.retry}>Retry evidence check</button></p>}
    {!month && !history.loading && !history.loadingMonths && <div className="mr-not-linked mr-link-notice"><strong>{history.months.length ? 'Choose a month.' : 'No reviewed monthly evidence is available for this store.'}</strong><p>Connected figures remain unavailable until their source check succeeds. Sample figures are not substituted.</p></div>}
    <DecisionSection id="marketing-linked-position" number="01" eyebrow="YOUR FINANCIAL POSITION" title="Your marketing position">
      <section className="mr-verdict" aria-label="Connected marketing investment review"><div className="mr-verdict-copy"><span className="mr-eyebrow">YOUR MARKETING BRIEFING · {m ? 'CONNECTED MONTHLY EVIDENCE' : 'AWAITING EVIDENCE'}</span><h2>{m && m.ebitda !== null ? m.ebitda >= 0 ? 'Contribution covers overheads in this month.' : 'Contribution does not cover overheads in this month.' : 'Choose verified evidence before assessing marketing.'}</h2><p>{m ? <>Selected period: {month!.selection.period.from}–{month!.selection.period.to}. EBITDA is <span className={amountUnavailable(m.ebitda) ? 'mr-not-linked' : ''}>{display(m.ebitda)}{unit}{amountUnavailable(m.ebitda) ? ' · Not linked / denominator unavailable' : ''}</span>.</> : 'No selected-month financial conclusion is available.'} This business-level result does not establish acquisition efficiency or permission to increase advertising.</p><a className="mr-text-link" href="#marketing-linked-gaps">Review the missing acquisition evidence</a></div><span className="mr-not-linked">Scaling decision: needs evidence</span></section>
      <div className="np-stats mr-stats" aria-label="Connected marketing key metrics">
        <article className={`np-stat ${acquisition?.cac === null || !acquisition ? 'mr-not-linked' : ''}`}><span>Paid first-customer CAC</span><strong>{money(acquisition?.cac ?? null,true)}</strong><small>{acquisition ? 'Connected synthetic source · modelled acquisition allocation ÷ identified paid first customers. Organic/email first customers are excluded.' : `${NOT_LINKED}. A matched reviewed synthetic acquisition supplement is required.`}</small></article>
        <article className={`np-stat ${m?.poas === null || !m ? 'mr-not-linked' : ''}`}><span>POAS · profit return</span><strong>{multiple(m?.poas ?? null)}</strong><small>{m?.poas !== null && m ? 'Calculated from connected contribution before ads ÷ advertising.' : NOT_LINKED}. A zero or missing advertising denominator has no supported ratio.</small></article>
        <article className={`np-stat ${m?.roas === null || !m ? 'mr-not-linked' : ''}`}><span>ROAS · blended sales return</span><strong>{multiple(m?.roas ?? null)}</strong><small>{m?.roas !== null && m ? 'Calculated from connected net turnover ÷ advertising.' : NOT_LINKED}. This is not platform attribution.</small></article>
        <article className={`np-stat ${amountUnavailable(m?.contribution ?? null) ? 'mr-not-linked' : ''}`}><span>Contribution after ads{unit}</span><strong>{display(m?.contribution ?? null)}</strong><small>{!amountUnavailable(m?.contribution ?? null) ? 'Connected: product gross profit + net shipping − variable costs − advertising.' : `${NOT_LINKED}. Per-order amounts also require a positive original-order count.`}</small></article>
      </div>
    </DecisionSection>
    <DecisionSection id="marketing-linked-movement" number="02" eyebrow="EXPLAIN THE RESULT" title="Does contribution cover the costs?">
      <section className="mr-card"><div className="mr-section-head"><div><span className="mr-eyebrow">MATCHED MONTHLY AMOUNTS</span><h2>Contribution, advertising and overheads</h2><p>{month ? `${month.selection.period.from}–${month.selection.period.to}` : 'No month selected'}{unit}. This composition is not a time trend.</p></div></div>
        {m && <><div className="mr-coverage-rows">{values.map(([label, amount]) => <div className={`mr-coverage-row ${amountUnavailable(amount) ? 'mr-not-linked' : ''}`} key={label}><div><span>{label}{amountUnavailable(amount) ? ' · Not linked / denominator unavailable' : ' · Connected'}</span><strong>{display(amount)}</strong></div><div className="mr-track" role="img" aria-label={`${label}: ${display(amount)}${unit}`}><span style={{width:`${amountUnavailable(amount) ? 0 : Math.abs(amount!) / max * 100}%`,background:amount !== null && amount < 0 ? '#fb7185' : '#38bdf8'}} /></div></div>)}</div><p className="mr-note">All bars share one absolute scale; negative amounts retain their sign. Missing amounts have no bar. EBITDA = contribution after ads − overheads excluding D&A.</p><div className="mr-coverage-totals"><div className={amountUnavailable(m.advertising) ? 'mr-not-linked' : ''}><span>Advertising{unit}</span><strong>{display(m.advertising)}</strong></div><div className={amountUnavailable(m.ebitda) ? 'mr-not-linked' : ''}><span>EBITDA{unit}</span><strong>{display(m.ebitda)}</strong></div><div><span>Original eligible orders</span><strong>{m.orders.toLocaleString('en-GB')}</strong></div></div></>}
        {!m && <p className="mr-not-linked">Not linked · select validated monthly evidence to populate this composition.</p>}
      </section>
      <NewMarketingConnections history={history} perOrder={perOrder} />
    </DecisionSection>
    <DecisionSection id="marketing-linked-gaps" number="03" eyebrow="FROM INSIGHT TO ACTION" title="What still needs connecting?">
      <AcquisitionEvidence payload={acquisitionSource.payload} financial={month} loading={acquisitionSource.loading} error={acquisitionSource.error} />
      {acquisitionSource.error && month && <button className="mr-text-link" onClick={acquisitionSource.retry}>Retry acquisition evidence check</button>}
      <div className="mr-card mr-not-linked"><h2>Customer profitability and forecasts still need evidence</h2><p><strong>{acquisition?.economicsView?'Allocated first-order economics are shown in the matched source panel; measured channel response remains unavailable.':'First-order contribution, mature-cohort payback and measured channel response: Unavailable.'}</strong> {acquisition ? acquisition.economicsView?'The optional cost source provides finite first-order observation and, when available, a separate mature cohort; these are allocated synthetic economics, not merchant cash payback.':'Paid first-customer CAC and identity coverage now have a matching synthetic sidecar; this does not supply a matched cost/cohort model.' : 'CAC and identity counts also remain unavailable until a reviewed acquisition sidecar matches this month/version.'}</p><p><strong>Acquisition spend-response curves, 30-day trajectories and CAC thresholds: sample or unavailable.</strong> The connected financial what-if above uses verified monthly financial inputs plus your explicit assumptions. It does not supply measured customer response or a future forecast.</p><button className="mr-button mr-secondary" onClick={onShowSample}>Inspect the yellow-labelled sample planner</button><p>Next step: review matched first-order costs, mature cohorts and cash guardrails before choosing a bounded spending test. No advertising changes, saved actions or reminders are created here.</p></div>
    </DecisionSection>
    <DecisionSection id="marketing-linked-support" number="04" eyebrow="DETAIL WITHOUT THE CLUTTER" title="Supporting numbers and assumptions">
      <details id="marketing-linked-numbers" className="mr-details"><summary>Explore the Numbers · linked figures and remaining gaps</summary><div className="mr-detail-body">
        <p>The selected reviewed month and evidence version populate headline figures; the separately labelled history window validates every constituent month/version. Missing, failed, withdrawn or cross-store evidence is not replaced with a sample. The history panel provides an explicitly labelled prior-month comparison after validation. No finer daily/weekly allocation is inferred.</p>
        <table><thead><tr><th>Metric</th><th>Displayed amount{unit}</th><th>Basis / status</th></tr></thead><tbody>
          <tr><th scope="row">Net turnover</th><td className={amountUnavailable(m?.revenue ?? null) ? 'mr-not-linked' : ''}>{display(m?.revenue ?? null)}</td><td>Net product sales + net shipping, excluding VAT.{amountUnavailable(m?.revenue ?? null) ? ` ${NOT_LINKED}; per-order display additionally requires positive orders.` : ''}</td></tr>
          {values.map(([label, amount]) => <tr key={label}><th scope="row">{label}</th><td className={amountUnavailable(amount) ? 'mr-not-linked' : ''}>{display(amount)}</td><td>{amountUnavailable(amount) ? `${NOT_LINKED}; per-order display additionally requires positive orders.` : 'Validated same-month financial evidence.'}</td></tr>)}
          <tr><th scope="row">POAS</th><td className={m?.poas === null || !m ? 'mr-not-linked' : ''}>{multiple(m?.poas ?? null)}</td><td>Contribution before advertising / total advertising.{m?.poas === null || !m ? ` ${NOT_LINKED}.` : ''}</td></tr>
          <tr><th scope="row">Blended ROAS</th><td className={m?.roas === null || !m ? 'mr-not-linked' : ''}>{multiple(m?.roas ?? null)}</td><td>Net turnover / total advertising.{m?.roas === null || !m ? ` ${NOT_LINKED}.` : ''}</td></tr>
          <tr className={acquisition?.cac === null || !acquisition ? 'mr-not-linked' : ''}><th scope="row">Paid first-customer CAC</th><td>{money(acquisition?.cac ?? null,true)}</td><td>{acquisition ? 'Exact synthetic sidecar matched to financial version/revisions; modelled spend allocation, paid first customers only.' : NOT_LINKED}</td></tr>
          <tr className="mr-not-linked"><th scope="row">Measured campaign response</th><td>Unavailable</td><td>{NOT_LINKED}; allocated first-order/cohort economics, when present, are separately scoped in the source panel and do not establish campaign response.</td></tr>
        </tbody></table>
        <p>Amounts are calculated in integer pence and rounded only for display. Per order divides flows by this month’s {m?.orders.toLocaleString('en-GB') ?? 'unavailable'} original eligible orders; zero orders makes per-order amounts unavailable. Ratios retain their original matched numerators and denominators.</p>
        {month && <><p>Business: {month.context.businessId} · {month.context.currency} · {month.context.timezone} · version/snapshot: {month.context.snapshotId} · formula: {month.context.formulaVersion}.</p><p>Source as of: {month.context.snapshotAsOf} · observed: {month.evidence.observedAt} · edition: {month.evidence.edition} · source coverage: {month.evidence.coverage} · cost coverage: {month.evidence.costCoverage}.</p><p>Sales revision: {month.evidence.salesRevision} · cost revision: {month.evidence.costRevision}. Canonical synthetic source checks do not certify provider freshness or advertising attribution.</p></>}
      </div></details>
    </DecisionSection>
  </div>;
}
