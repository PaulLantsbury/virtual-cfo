import { useState } from 'react';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { useReviewedHistory } from '@/lib/useReviewedHistory';
import { useReviewedHistorySeries } from '@/lib/useReviewedHistorySeries';
import { linkedMarketingMetrics } from '@/lib/marketing/linked-model';
import { linkedFinancialScenario, linkedMarketingHistory, linkedMarketingThresholds } from '@/lib/marketing/linked-connections-model';

const money = (value: number | null, precise = false) => value === null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: precise ? 2 : 0, maximumFractionDigits: precise ? 2 : 0 }).format(value / 100);
const multiple = (value: number | null) => value === null ? '—' : `${value.toFixed(2)}×`;
const signed = (value: number | null, precise = false) => value === null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value), precise)}`;
type History = ReturnType<typeof useReviewedHistory>;
type Metrics = NonNullable<ReturnType<typeof linkedMarketingMetrics>>;

/** Every plotted point retains its exact reviewed month/version; no finer buckets are fabricated. */
export function NewMarketingConnections({ history, perOrder }: { history: History; perOrder: boolean }) {
  const [count, setCount] = useState(3);
  const series = useReviewedHistorySeries(history, count);
  const model = series.status === 'supported' ? linkedMarketingHistory(series.months) : null;
  const current = linkedMarketingMetrics(history.month);
  const previous = model && model.rows.length > 1 ? model.rows[model.rows.length - 2] : null;
  const amount = (n: number | null, orders: number | null) => n === null || perOrder && (!orders || orders <= 0) ? null : perOrder ? n / orders! : n;
  const unit = perOrder ? ' / original order' : '';
  const currentEbitda = amount(current?.ebitda ?? null, current?.orders ?? null);
  const previousEbitda = amount(previous?.metrics.ebitda ?? null, previous?.metrics.orders ?? null);
  const ebitdaChange = currentEbitda === null || previousEbitda === null ? null : currentEbitda - previousEbitda;
  const chart = model?.rows.map(({ month, metrics }) => ({
    label: month.selection.period.from.slice(0, 7), from: month.selection.period.from, to: month.selection.period.to,
    poas: metrics.poas, roas: metrics.roas,
  })) ?? [];
  return <>
    <section className="mr-card" aria-label="Connected marketing monthly history">
      <div className="mr-section-head"><div><span className="mr-eyebrow">EFFICIENCY OVER TIME · CONNECTED</span><h2>Are financial returns changing?</h2><p>Complete reviewed monthly buckets ending at the selected month. Missing months or ambiguous versions withhold the trend.</p></div><label>History window<select aria-label="Marketing history window" value={count} onChange={e => setCount(Number(e.target.value))}>{[3, 6, 12].map(n => <option key={n} value={n}>Up to {n} months</option>)}</select></label></div>
      {series.loading && <p role="status">Checking every month and evidence version…</p>}
      {!model && !series.loading && <p className="mr-not-linked">{series.error ?? 'Choose a supported month and evidence version to load its history.'} No sample points are substituted. <button onClick={series.retry}>Retry history check</button></p>}
      {model && <>
        <p>{model.rows[0].month.selection.period.from}–{model.rows[model.rows.length - 1].month.selection.period.to} · {model.rows.length} reviewed months · monthly aggregation · GBP excluding VAT.</p>
        <div className="mr-chart" role="img" aria-label="Monthly connected POAS and blended ROAS, both in multiples. Exact numerator, denominator and evidence versions are in the table below."><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="label" /><YAxis tickFormatter={value => `${value}×`} /><Tooltip contentStyle={{ background: 'hsl(var(--card))' }} formatter={(value: number, name: string) => [multiple(value), name]} labelFormatter={(_label, payload) => { const row = payload?.[0]?.payload; return row ? `${row.from}–${row.to}` : ''; }} /><Line type="linear" dataKey="poas" name="POAS" stroke="#b49aff" strokeWidth={3} connectNulls={false} /><Line type="linear" dataKey="roas" name="Blended ROAS" stroke="#38bdf8" strokeWidth={3} connectNulls={false} /></ComposedChart></ResponsiveContainer></div>
        <p className="mr-note">Violet: POAS. Blue: blended ROAS. Both use the same multiple axis. Missing or zero advertising gives a gap, never an invented zero.</p>
        <details className="mr-details"><summary>Explore the monthly figures and evidence</summary><div className="mr-detail-body"><table><thead><tr><th>Month</th><th>Turnover{unit}</th><th>Contribution before ads{unit}</th><th>Advertising{unit}</th><th>EBITDA{unit}</th><th>Orders</th><th>POAS</th><th>ROAS</th><th>Evidence version</th></tr></thead><tbody>{model.rows.map(({ month, metrics }) => <tr key={month.selection.period.from}><th scope="row">{month.selection.period.from}–{month.selection.period.to}</th>{[metrics.revenue, metrics.beforeAds, metrics.advertising, metrics.ebitda].map((n, i) => <td key={i} className={amount(n, metrics.orders) === null ? 'mr-not-linked' : ''}>{money(amount(n, metrics.orders), perOrder)}</td>)}<td>{metrics.orders.toLocaleString('en-GB')}</td><td className={metrics.poas === null ? 'mr-not-linked' : ''}>{multiple(metrics.poas)}</td><td className={metrics.roas === null ? 'mr-not-linked' : ''}>{multiple(metrics.roas)}</td><td>{month.selection.versionId}</td></tr>)}</tbody><tfoot><tr><th scope="row">Selected history total</th>{[model.totals.revenue, model.totals.beforeAds, model.totals.advertising, model.totals.ebitda].map((n, i) => <td key={i} className={amount(n, model.totals.orders) === null ? 'mr-not-linked' : ''}>{money(amount(n, model.totals.orders), perOrder)}</td>)}<td>{model.totals.orders.toLocaleString('en-GB')}</td><td className={model.totals.poas === null ? 'mr-not-linked' : ''}>{multiple(model.totals.poas)}</td><td className={model.totals.roas === null ? 'mr-not-linked' : ''}>{multiple(model.totals.roas)}</td><td>Exact monthly versions above</td></tr></tfoot></table><p>Ratios divide summed matched numerators by summed advertising; per-order totals divide summed flows by summed original orders. This history window does not change the selected-month headline cards. Source identity, currency, timezone, edition, anchor and consecutive periods must match; each month passes the restricted reader and financial reconciliation.</p></div></details>
        {current && previous && <div className="mr-driver-note"><strong>Selected month versus {previous.month.selection.period.from}–{previous.month.selection.period.to}</strong><p>POAS change: <span className={current.poas === null || previous.metrics.poas === null ? 'mr-not-linked' : ''}>{current.poas === null || previous.metrics.poas === null ? '—' : `${(current.poas - previous.metrics.poas).toFixed(2)}×`}</span>. ROAS change: <span className={current.roas === null || previous.metrics.roas === null ? 'mr-not-linked' : ''}>{current.roas === null || previous.metrics.roas === null ? '—' : `${(current.roas - previous.metrics.roas).toFixed(2)}×`}</span>. EBITDA change{unit}: <span className={ebitdaChange === null ? 'mr-not-linked' : ''}>{signed(ebitdaChange, perOrder)}</span>.</p><small>Calendar months can have different day counts; this compares recorded monthly results, not like-for-like daily performance or campaign causality.</small></div>}
      </>}
    </section>
    <FinancialWhatIf key={`${history.storeId}:${history.selection.period.from}:${history.selection.versionId}`} base={current} period={history.month ? `${history.selection.period.from}–${history.selection.period.to}` : null} />
  </>;
}

function FinancialWhatIf({ base, period }: { base: Metrics | null; period: string | null }) {
  const [target, setTarget] = useState('');
  const [advertisingChangePct, setAdChange] = useState(0);
  const [contributionChangePct, setContributionChange] = useState(0);
  const [extra, setExtra] = useState('0');
  const targetPence = target === '' ? null : Math.round(Number(target) * 100);
  const validTarget = target === '' || Number.isFinite(Number(target)) && Number(target) >= 0 && Number.isSafeInteger(targetPence);
  const thresholds = linkedMarketingThresholds(base, validTarget ? targetPence : NaN);
  const scenario = linkedFinancialScenario(base, { advertisingChangePct, contributionChangePct, extraOverheads: extra.trim() === '' || !Number.isFinite(Number(extra)) || Number(extra) < 0 ? NaN : Math.round(Number(extra) * 100) });
  return <section className="mr-card" aria-label="Financial scenario using connected baseline"><div className="mr-section-head"><div><span className="mr-eyebrow">VERIFIED BASELINE + YOUR ASSUMPTIONS</span><h2>What would a financial change mean?</h2><p>{period ? `Baseline: reviewed month ${period}.` : 'Choose a reviewed month first.'} This repeats the same month as an explicit hypothetical baseline; it is not a next-month or 30-day forecast.</p></div></div>
    <details className="mr-details"><summary>Explore break-even, target and spending assumptions</summary><div className="mr-detail-body">
      <p>Financial inputs come from the selected reviewed month. Your inputs below are assumptions, not missing database links. No assumed customer count, CAC, sales-response curve, future cash or attribution is used.</p>
      <label>Optional EBITDA target for this same month (£)<input aria-label="Connected marketing EBITDA target" type="number" min="0" step="100" value={target} onChange={e => setTarget(e.target.value)} /></label>
      {!validTarget && <p role="alert">Enter a non-negative target in pounds.</p>}
      <table><thead><tr><th>Fixed-sales calculation</th><th>Value</th><th>Meaning</th></tr></thead><tbody>
        <tr><th scope="row">Advertising capacity after overheads{target !== '' ? ' and target' : ''}</th><td className={thresholds?.capacity === null || !thresholds ? 'mr-not-linked' : ''}>{money(thresholds?.capacity ?? null)}</td><td>Contribution before ads − overheads excluding D&A − optional target.</td></tr>
        <tr><th scope="row">Minimum POAS at fixed sales</th><td className={thresholds?.poas === null || !thresholds ? 'mr-not-linked' : ''}>{multiple(thresholds?.poas ?? null)}</td><td>No finite threshold when advertising capacity is non-positive.</td></tr>
        <tr><th scope="row">Minimum blended ROAS at fixed sales</th><td className={thresholds?.roas === null || !thresholds ? 'mr-not-linked' : ''}>{multiple(thresholds?.roas ?? null)}</td><td>These thresholds are not marginal CAC limits or permission to spend.</td></tr>
        <tr><th scope="row">Required contribution after ads</th><td className={thresholds?.contributionNeeded === null || !thresholds ? 'mr-not-linked' : ''}>{money(thresholds?.contributionNeeded ?? null)}</td><td>Overheads excluding D&A + optional target.</td></tr>
        <tr><th scope="row">Target minus actual EBITDA</th><td className={target !== '' && (thresholds?.targetGap === null || !thresholds) ? 'mr-not-linked' : ''}>{target === '' ? 'Target not set' : money(thresholds?.targetGap ?? null)}</td><td>Positive is short of target; negative is above target.</td></tr>
      </tbody></table>
      <div className="mr-scenario-grid"><div className="mr-slider-panel"><label>Advertising change assumption <strong>{advertisingChangePct}%</strong><input aria-label="Connected advertising change assumption" type="range" min="-100" max="100" step="5" value={advertisingChangePct} onChange={e => setAdChange(Number(e.target.value))} /></label><label>Contribution before ads change assumption <strong>{contributionChangePct}%</strong><input aria-label="Connected pre-ad contribution change assumption" type="range" min="-100" max="100" step="5" value={contributionChangePct} onChange={e => setContributionChange(Number(e.target.value))} /></label><label>Additional overheads excluding D&A (£)<input aria-label="Connected extra overhead assumption" type="number" min="0" step="100" value={extra} onChange={e => setExtra(e.target.value)} /></label><p className="mr-note">The contribution change is entered independently. Changing advertising does not automatically produce sales or customer growth. Amounts stay total pounds for the same historical-month baseline. Assumed monetary results are rounded to the nearest penny before the bridge is calculated.</p><button onClick={() => { setAdChange(0); setContributionChange(0); setExtra('0'); setTarget(''); }}>Reset assumptions</button></div><div className="mr-scenario-results" aria-live="polite">{scenario ? <><p><strong>Conditional calculation · not an observed result or forecast</strong></p><dl className="mr-scenario-facts"><div><dt>Verified baseline EBITDA</dt><dd>{money(base!.ebitda)}</dd></div><div><dt>Conditional EBITDA</dt><dd>{money(scenario.ebitda)}</dd></div><div><dt>Difference</dt><dd>{signed(scenario.difference)}</dd></div></dl><table><thead><tr><th>Change bridge</th><th>EBITDA effect</th></tr></thead><tbody><tr><th scope="row">Assumed pre-ad contribution change</th><td>{signed(scenario.contributionEffect)}</td></tr><tr><th scope="row">Assumed advertising change</th><td>{signed(scenario.advertisingEffect)}</td></tr><tr><th scope="row">Additional overheads</th><td>{signed(scenario.overheadEffect)}</td></tr></tbody></table><p>These effects reconcile to the conditional difference. They are assumption effects, not measured benefits.</p></> : <p className="mr-not-linked">Conditional result unavailable. Select complete financial evidence and enter valid non-negative additional costs.</p>}</div></div>
      <p>Cash, stock, capacity and matched acquisition economics still need checking before a spending decision. Nothing here changes advertising, saves an action or schedules a reminder. Reloading or changing company, month or evidence version clears these assumptions.</p>
    </div></details>
  </section>;
}
