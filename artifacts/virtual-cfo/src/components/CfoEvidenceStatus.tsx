import type { CfoEvidenceInput } from "@/lib/analytics/cfoEvidence";
import { cfoEvidenceView } from "@/lib/analytics/cfoEvidence";

/** Shared scope-safe evidence wording for the CFO briefing, profit and margin views. */
export function CfoEvidenceStatus({ evidence }: { evidence: CfoEvidenceInput }) {
  const view = cfoEvidenceView(evidence);
  const tone = view.state === "supported" ? "border-border bg-card" : view.state === "stale" ? "border-amber-500/30 bg-amber-500/5" : "border-amber-500/30 bg-amber-500/5";
  return <section aria-live="polite" aria-label="Reporting evidence status" className={`rounded-xl border p-4 ${tone}`}>
    <h2 className="font-bold">{view.title}</h2>
    <p role="status" className="mt-2 text-sm text-muted-foreground">{view.message}</p>
    {evidence.evidenceVersion && <p className="mt-2 text-xs text-muted-foreground">Reporting evidence version: {evidence.evidenceVersion}</p>}
  </section>;
}
