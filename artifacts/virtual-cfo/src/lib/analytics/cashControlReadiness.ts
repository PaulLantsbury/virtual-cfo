/**
 * Cash Control is deliberately stricter than a generic reporting view. It
 * cannot infer a usable cash total from a P&L, an unmapped account, or an
 * undated balance. This is a value-free contract for the future read-only
 * accounting reader; it contains no credentials or financial amounts.
 */
export type CashControlReadinessState =
  | "not_connected"
  | "mapping_incomplete"
  | "evidence_incomplete"
  | "review_required"
  | "stale"
  | "ready"
  | "denied";

export type CashControlReadinessInput = {
  state: CashControlReadinessState;
  /** A retained snapshot is displayable only when it is for this exact store. */
  storeId: string;
  retainedStoreId?: string | null;
  asOf?: string | null;
  detail?: string | null;
};

export type CashControlReadinessView = {
  title: string;
  message: string;
  tone: "neutral" | "warning" | "ready";
  canShowActualCash: boolean;
  isRetained: boolean;
};

const methodology = " Available cash requires dated, unrestricted balances from owner-confirmed included bank or payment accounts. Unsettled processor funds stay separate and transfers between included accounts are excluded from cash movement.";
const timestamp = (value: string | null | undefined) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));

export function cashControlReadinessView(input: CashControlReadinessInput): CashControlReadinessView {
  const detail = input.detail ? ` ${input.detail}` : "";
  switch (input.state) {
    case "ready":
      return timestamp(input.asOf)
        ? { title: "Cash evidence available", message: `Supported cash evidence is available as of ${input.asOf}.${detail}${methodology}`, tone: "ready", canShowActualCash: true, isRetained: false }
        : { title: "Cash evidence is incomplete", message: `A dated balance is required before actual cash can be shown.${detail}${methodology}`, tone: "warning", canShowActualCash: false, isRetained: false };
    case "stale": {
      const sameStore = !!input.retainedStoreId && input.retainedStoreId === input.storeId && timestamp(input.asOf);
      return sameStore
        ? { title: "Last available cash evidence may be out of date", message: `The latest cash refresh did not complete. A retained same-store snapshot is available${input.asOf ? ` as of ${input.asOf}` : ""}; it must not be presented as current.${detail}${methodology}`, tone: "warning", canShowActualCash: true, isRetained: true }
        : { title: "Cash evidence unavailable", message: `No retained snapshot for this store is available. A snapshot from another store is never substituted.${detail}${methodology}`, tone: "warning", canShowActualCash: false, isRetained: false };
    }
    case "review_required":
      return { title: "Cash evidence needs review", message: `A later posting, mapping change, or source change requires review before cash figures can be presented as current.${detail}${methodology}`, tone: "warning", canShowActualCash: false, isRetained: false };
    case "mapping_incomplete":
      return { title: "Cash account mapping is incomplete", message: `An owner must confirm which accounts are included, restricted, or unsettled before actual cash can be shown.${detail}${methodology}`, tone: "warning", canShowActualCash: false, isRetained: false };
    case "evidence_incomplete":
      return { title: "Cash evidence is incomplete", message: `A balance date, account eligibility, or settlement classification is missing. Missing amounts are not treated as zero.${detail}${methodology}`, tone: "warning", canShowActualCash: false, isRetained: false };
    case "denied":
      return { title: "Cash evidence is not accessible", message: `You do not have access to cash evidence for this store. Evidence from another store is not shown.${detail}${methodology}`, tone: "warning", canShowActualCash: false, isRetained: false };
    case "not_connected":
      return { title: "Actual cash reporting is not connected", message: `Connect a read-only accounting source and complete owner-confirmed account mapping before actual cash can be shown.${methodology}`, tone: "neutral", canShowActualCash: false, isRetained: false };
    default:
      return { title: "Cash evidence unavailable", message: `Cash reporting status could not be verified.${methodology}`, tone: "warning", canShowActualCash: false, isRetained: false };
  }
}
