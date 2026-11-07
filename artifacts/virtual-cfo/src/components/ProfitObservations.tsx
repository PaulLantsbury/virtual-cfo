import { Link } from 'wouter';
import type { useProfitReporting, ProfitReport } from '@/lib/analytics/useProfitReporting';
import { buildProfitObservations } from '@/lib/analytics/profitObservations';

export function ProfitObservations({ profit, scope }: {
  profit: ReturnType<typeof useProfitReporting>;
  scope: ProfitReport['scope'];
}) {
  const observations = buildProfitObservations({ ...profit, scope });
  return <section aria-label="CFO profit observations" className="mb-7 rounded-2xl border border-border bg-card p-5 sm:p-6">
    <h2 className="text-xl font-bold">What the profit evidence shows</h2>
    <p role="status" className="text-sm text-muted-foreground mt-2">{observations.status}</p>
    <div className="grid lg:grid-cols-3 gap-5 mt-5">
      {observations.cards.map(card => <article key={card.id} aria-label={card.title} className="min-w-0 rounded-xl border border-border p-4">
        <h3 className="font-semibold">{card.title}</h3>
        <dl className="text-sm space-y-3 mt-3">
          {([
            ['Observation', card.observation], ['Reported components', card.driver],
            ['Financial impact', card.impact], ['Evidence coverage', card.evidence],
          ] as const).map(([label, value]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="text-muted-foreground mt-1">{value}</dd></div>)}
        </dl>
        <Link href="/profit-engine" className="inline-block text-sm text-primary underline mt-4">{card.action}</Link>
      </article>)}
    </div>
    {observations.cards.length > 0 && <p className="text-xs text-muted-foreground mt-4">Outlook and guardrails: no forecast, causal explanation, confidence score or business threshold is inferred from these amounts. The links support investigation; no commercial action has been recommended or carried out.</p>}
  </section>;
}
