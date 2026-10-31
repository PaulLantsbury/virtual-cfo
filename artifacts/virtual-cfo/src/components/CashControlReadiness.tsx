import { cashControlReadinessView, type CashControlReadinessInput } from "@/lib/analytics/cashControlReadiness";

/** Value-free account-eligibility and freshness status for the future cash reader. */
export function CashControlReadiness({ readiness }: { readiness: CashControlReadinessInput }) {
  const view = cashControlReadinessView(readiness);
  const tone = view.tone === "ready" ? "border-emerald-500/30 bg-emerald-500/5" : view.tone === "warning" ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card";
  return <section aria-live="polite" aria-label="Actual cash reporting status" className={`mb-6 rounded-xl border p-5 ${tone}`}>
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="font-semibold text-foreground">{view.title}</h2>
      {view.isRetained && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">Retained snapshot</span>}
    </div>
    <p role="status" className="mt-2 text-sm leading-relaxed text-muted-foreground">{view.message}</p>
  </section>;
}
