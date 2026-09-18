/**
 * A small presentation contract shared by CFO pages.
 *
 * This intentionally describes evidence availability, rather than deriving a
 * financial result. Connectors can later supply a retained snapshot or a
 * source-invalidation signal without allowing an older scope to appear fresh.
 */
export type CfoEvidenceState = "supported" | "stale" | "invalidated" | "unavailable" | "denied";

export type CfoEvidenceScope = {
  storeId: string;
  currency: string;
  from: string;
  to: string;
};

export type CfoEvidenceInput = {
  state: CfoEvidenceState;
  scope: CfoEvidenceScope;
  /** A retained result is safe only when it has exactly the visible scope. */
  retainedScope?: CfoEvidenceScope | null;
  dataThrough?: string | null;
  evidenceVersion?: string | null;
  detail?: string | null;
};

export type CfoEvidenceView = {
  state: CfoEvidenceState;
  title: string;
  message: string;
  isRetained: boolean;
  showFigures: boolean;
};

export function sameCfoEvidenceScope(a: CfoEvidenceScope, b: CfoEvidenceScope) {
  return a.storeId === b.storeId && a.currency === b.currency && a.from === b.from && a.to === b.to;
}

/** Prevent a stale snapshot from crossing a store, currency, or period boundary. */
export function cfoEvidenceView(input: CfoEvidenceInput): CfoEvidenceView {
  const retainedMatches = !!input.retainedScope && sameCfoEvidenceScope(input.scope, input.retainedScope);
  const period = input.scope.from && input.scope.to ? `${input.scope.from} to ${input.scope.to}` : "the selected period";
  const detail = input.detail ? ` ${input.detail}` : "";
  switch (input.state) {
    case "supported":
      return { state: input.state, title: "Evidence available", message: `Supported figures are available for ${period}.${detail}`, isRetained: false, showFigures: true };
    case "stale":
      return retainedMatches
        ? { state: input.state, title: "Last available figures may be out of date", message: `The latest refresh did not complete. Showing the last supported figures for ${period}${input.dataThrough ? `, data through ${input.dataThrough}` : ""}.${detail}`, isRetained: true, showFigures: true }
        : { state: "unavailable", title: "Figures unavailable", message: `No same-scope retained figures are available for ${period}. Older figures have not been substituted.${detail}`, isRetained: false, showFigures: false };
    case "invalidated":
      return { state: input.state, title: "Evidence needs review", message: `A source change means the previous figures for ${period} need review. They are not presented as current supported figures.${detail}`, isRetained: false, showFigures: false };
    case "denied":
      return { state: input.state, title: "Evidence is not accessible", message: `You do not have access to evidence for ${period}. Figures from another store or period are not shown.${detail}`, isRetained: false, showFigures: false };
    case "unavailable":
      return { state: input.state, title: "Figures unavailable", message: `Evidence for ${period} is missing, incomplete or unavailable. Missing amounts are not treated as zero.${detail}`, isRetained: false, showFigures: false };
  }
}

/**
 * Transport-agnostic freshness signals that a connector may provide later.
 * This deliberately contains no snapshot values: the caller must explicitly
 * supply same-scope retention before a stale result can remain visible.
 */
export type CfoEvidenceFreshnessSignal =
  | { state: "stale"; detail?: string | null; dataThrough?: string | null; evidenceVersion?: string | null; retainedScope?: CfoEvidenceScope | null }
  | { state: "invalidated"; detail?: string | null; evidenceVersion?: string | null }
  | { state: "denied"; detail?: string | null }
  | { state: "unavailable"; detail?: string | null };

export type CfoEvidenceAdapterInput = {
  scope: CfoEvidenceScope;
  /** The active source request is in flight; it is never evidence. */
  loading: boolean;
  /** True only for a result already validated for the visible scope. */
  hasSupportedEvidence: boolean;
  /** Optional future connector signal. It cannot introduce retained figures. */
  freshness?: CfoEvidenceFreshnessSignal | null;
  detail?: string | null;
};

/**
 * Converts reporting/query state into the presentation contract shared by CFO
 * pages. Freshness controls win over a successful request so a source change
 * or access loss cannot be presented as current evidence.
 */
export function cfoEvidenceFromReporting(input: CfoEvidenceAdapterInput): CfoEvidenceInput {
  const freshness = input.freshness;
  if (freshness) {
    return {
      state: freshness.state,
      scope: input.scope,
      retainedScope: freshness.state === "stale" ? freshness.retainedScope ?? null : null,
      dataThrough: freshness.state === "stale" ? freshness.dataThrough ?? null : null,
      evidenceVersion: "evidenceVersion" in freshness ? freshness.evidenceVersion ?? null : null,
      detail: freshness.detail ?? input.detail ?? null,
    };
  }
  if (input.loading) return { state: "unavailable", scope: input.scope, detail: input.detail ?? "Evidence for the selected scope is still being checked." };
  return {
    state: input.hasSupportedEvidence ? "supported" : "unavailable",
    scope: input.scope,
    detail: input.detail ?? null,
  };
}
