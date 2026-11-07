import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowUpRight, X } from "lucide-react";
import {
  buildDashboardData,
  COMPARISON_OPTIONS,
  PERIOD_OPTIONS,
  resolveReportContext,
  SAMPLE_CONTEXT,
  type ComparisonPreset,
  type DateRange,
  type DisplayMode,
  type PeriodPreset,
  type ViewState,
} from "../../lib/v11";
import { DataTable, Notice, money } from "../../components/v11/primitives";
import {
  ScoutPage,
  ProfitPage,
  GrowthPage,
  CashPage,
} from "./historical-pages";
import { PlanPage } from "./planning-pages";
import { V11Monitoring, V11Settings } from "../../v11-service-pages";
import "./workspace.css";

export type V11Section =
  | "scout"
  | "profit"
  | "growth"
  | "cash"
  | "plan"
  | "monitoring"
  | "settings";
export interface V11WorkspaceProps {
  section: V11Section;
  initialTab?: string;
  onNavigate?: (section: V11Section, tab?: string) => void;
}
export type DashboardData = ReturnType<typeof buildDashboardData>;
export interface PageContext {
  data: DashboardData;
  totals: DashboardData;
  perOrder: DashboardData;
  comparison: boolean;
  incomplete: boolean;
  quiet: boolean;
  mode: DisplayMode;
  navigate: (section: V11Section, tab?: string) => void;
  explore: () => void;
  registerEvidence?: (evidence: ReactNode) => void;
}
const titles: Record<V11Section, [string, string]> = {
  scout: ["Scout’s View", "Your business. In focus."],
  profit: [
    "Profit Engine",
    "Understand what drives profit and where to focus next.",
  ],
  growth: [
    "Growth & Marketing",
    "Turn marketing into profitable, sustainable growth.",
  ],
  cash: [
    "Cash Control",
    "Understand where profit becomes cash — and where it gets held up.",
  ],
  plan: ["Plan", "Turn insight into action."],
  monitoring: ["Monitoring", "Your business in focus."],
  settings: [
    "Settings",
    "Connect your data, set guardrails and manage your account.",
  ],
};
const states: { id: ViewState; label: string }[] = [
  { id: "sample", label: "Complete sample" },
  { id: "verified-quiet", label: "Verified quiet example" },
  { id: "incomplete", label: "Incomplete cost evidence" },
  { id: "stale", label: "Stale snapshot" },
  { id: "failed", label: "Failed update" },
  { id: "no-connection", label: "No connection" },
  { id: "loading", label: "Loading" },
];
const rangeLabel = (r: DateRange | null) =>
  r
    ? `${new Date(r.from + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(r.to + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : "None";
export default function V11Workspace({
  section,
  initialTab,
  onNavigate,
}: V11WorkspaceProps) {
  const [period, setPeriod] = useState<PeriodPreset>("last-3-months"),
    [comparison, setComparison] = useState<ComparisonPreset>(
      "same-period-last-year",
    );
  const [custom, setCustom] = useState({
    period: { from: "2026-07-01", to: "2026-09-30" },
    comparison: { from: "2025-07-01", to: "2025-09-30" },
  });
  const [mode, setMode] = useState<DisplayMode>("total"),
    [viewState, setViewState] = useState<ViewState>("sample"),
    [evidence, setEvidence] = useState(false);
  const [tab, setTab] = useState(initialTab || "");
  const [plannerEvidence, setPlannerEvidence] = useState<ReactNode>(null);
  const [scopedEvidence, setScopedEvidence] = useState<
    Record<string, ReactNode>
  >({});
  const registerEvidence = useCallback(
    (node: ReactNode) =>
      setScopedEvidence((old) => ({ ...old, [section]: node })),
    [section],
  );
  const returnFocus = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    exploreButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setTab(initialTab || "");
  }, [section, initialTab]);
  useEffect(() => {
    if (evidence) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [evidence]);
  const openEvidence = () => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setEvidence(true);
  };
  const historical = ["scout", "profit", "growth", "cash"].includes(section);
  // The explicit sample clock preserves the approved historical snapshot. It never relabels the sample as current live data.
  const resolved = resolveReportContext(
    "2026-10-01T12:00:00Z",
    period,
    comparison,
    custom,
  );
  const periodSupported =
    resolved.period?.from === SAMPLE_CONTEXT.period.from &&
    resolved.period?.to === SAMPLE_CONTEXT.period.to;
  const comparisonSupported =
    !!resolved.comparison &&
    resolved.comparison.from === SAMPLE_CONTEXT.comparison?.from &&
    resolved.comparison.to === SAMPLE_CONTEXT.comparison.to;
  const totals = buildDashboardData(),
    perOrder = buildDashboardData("per-order"),
    data = section === "profit" && mode === "per-order" ? perOrder : totals;
  const blocked =
    ["loading", "no-connection", "failed"].includes(viewState) ||
    !periodSupported;
  const navigate = (s: V11Section, t?: string) => onNavigate?.(s, t);
  const context: PageContext = {
    data,
    totals,
    perOrder,
    mode: section === "profit" ? mode : "total",
    comparison: comparisonSupported,
    incomplete: viewState === "incomplete",
    quiet: viewState === "verified-quiet",
    navigate,
    explore: openEvidence,
    registerEvidence,
  };
  const setRange = (
    kind: "period" | "comparison",
    field: "from" | "to",
    value: string,
  ) =>
    setCustom((old) => ({ ...old, [kind]: { ...old[kind], [field]: value } }));
  return (
    <div className="v11-workspace">
      <header className="v11-page-header">
        <div>
          <h1>{titles[section][0]}</h1>
          <p>{titles[section][1]}</p>
        </div>
        <button
          ref={exploreButton}
          className="v11-explore"
          onClick={openEvidence}
        >
          Explore the Numbers <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </header>
      {historical ? (
        <div className="v11-context">
          <div className="v11-control-row">
            <label>
              Period
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodPreset)}
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compared to
              <select
                value={comparison}
                onChange={(e) =>
                  setComparison(e.target.value as ComparisonPreset)
                }
              >
                {COMPARISON_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {section === "profit" && (
              <fieldset className="v11-unit-switch">
                <legend>Display amounts</legend>
                {(["total", "per-order"] as const).map((m) => (
                  <button
                    type="button"
                    aria-pressed={mode === m}
                    className={mode === m ? "active" : ""}
                    onClick={() => setMode(m)}
                    key={m}
                  >
                    {m === "total" ? "Total" : "Per order"}
                  </button>
                ))}
              </fieldset>
            )}
          </div>
          {(period === "custom" || comparison === "custom") && (
            <div className="v11-custom-dates">
              {(["period", "comparison"] as const)
                .filter((kind) =>
                  kind === "period"
                    ? period === "custom"
                    : comparison === "custom",
                )
                .map((kind) => (
                  <fieldset key={kind}>
                    <legend>
                      {kind === "period" ? "Selected period" : "Comparison"} ·
                      inclusive
                    </legend>
                    {(["from", "to"] as const).map((field) => (
                      <label key={field}>
                        {field === "from" ? "From" : "To"}
                        <input
                          type="date"
                          value={custom[kind][field]}
                          onChange={(e) =>
                            setRange(kind, field, e.target.value)
                          }
                        />
                      </label>
                    ))}
                  </fieldset>
                ))}
            </div>
          )}
          <p className="v11-context-caption">
            {rangeLabel(resolved.period)}
            {resolved.comparison
              ? ` vs ${rangeLabel(resolved.comparison)}`
              : " · No comparison"}{" "}
            · GBP · Europe/London · Snapshot: 30 Sep 2026 · Fictional calendar
            reference: 1 Oct 2026
          </p>
          {resolved.issues.map((n) => (
            <Notice tone="danger" key={n}>
              {n}
            </Notice>
          ))}
          {resolved.notices.map((n) => (
            <Notice tone="warning" key={n}>
              {n}
            </Notice>
          ))}
          {periodSupported &&
            !comparisonSupported &&
            comparison !== "none" &&
            resolved.comparison && (
              <Notice>
                Comparison evidence is unavailable for this range. Comparative
                amounts, lines and claims are withheld.
              </Notice>
            )}
        </div>
      ) : (
        section === "plan" && (
          <p className="v11-context-caption">
            Historical reference: 1 Jul – 30 Sep 2026 · SAMPLE-Q3-26. The
            planner uses a separate illustrative one-month baseline.
          </p>
        )
      )}
      {historical && (
        <details className="v11-review-state">
          <summary>Review a data state</summary>
          <label>
            Fictional state
            <select
              value={viewState}
              onChange={(e) => setViewState(e.target.value as ViewState)}
            >
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <p>
            This selector demonstrates evidence handling. It does not change or
            inspect a live connection.
          </p>
        </details>
      )}
      {historical && viewState === "stale" && (
        <Notice tone="warning">
          Stale snapshot · retaining supported figures dated 30 September 2026.
          These are not current results; freshness has not been verified.
        </Notice>
      )}
      {historical && blocked ? (
        <section className="v11-panel v11-unavailable" aria-live="polite">
          <h2>
            {!periodSupported
              ? "Evidence unavailable for this period"
              : viewState === "loading"
                ? "Loading selected evidence"
                : viewState === "no-connection"
                  ? "Connect a source to begin"
                  : "The update could not be verified"}
          </h2>
          <p>
            {!periodSupported
              ? "The approved sample contains only July–September 2026. Select Last 3 months to return to its supported figures. No sample amounts are substituted for other dates."
              : viewState === "loading"
                ? "Results are withheld until the scoped evidence is ready."
                : "No supported current result is available in this example. Unknown values are not zero, and no all-clear is shown."}
          </p>
          <button className="v11-link" onClick={openEvidence}>
            Inspect evidence and coverage →
          </button>
        </section>
      ) : (
        <>
          {section === "scout" && <ScoutPage {...context} />}
          {section === "profit" && <ProfitPage {...context} />}
          {section === "growth" && (
            <GrowthPage {...context} tab={tab} setTab={setTab} />
          )}
          {section === "cash" && <CashPage {...context} tab={tab} />}
          {section === "plan" && (
            <PlanPage
              context={context}
              tab={tab}
              setTab={setTab}
              onEvidenceChange={setPlannerEvidence}
            />
          )}
          {section === "monitoring" && (
            <V11Monitoring
              tab={tab}
              onTab={setTab}
              onEvidence={context.explore}
              onNavigate={navigate}
            />
          )}
          {section === "settings" && (
            <V11Settings
              tab={tab}
              onTab={setTab}
              onEvidence={context.explore}
              onNavigate={navigate}
            />
          )}
        </>
      )}
      <footer className="v11-footer">
        <button className="v11-link" onClick={openEvidence}>
          Explore the Numbers
        </button>
        <span>Fictional sample · no live store data</span>
        <span>Formula {SAMPLE_CONTEXT.formulaVersion}</span>
      </footer>
      <dialog
        ref={dialog}
        className="v11-evidence-dialog"
        onCancel={() => setEvidence(false)}
        onClose={() => {
          setEvidence(false);
          (returnFocus.current?.isConnected
            ? returnFocus.current
            : exploreButton.current
          )?.focus();
        }}
        aria-labelledby="v11-evidence-title"
      >
        <div className="v11-dialog-heading">
          <div>
            <p className="v11-eyebrow">Transparency · {titles[section][0]}</p>
            <h2 id="v11-evidence-title">Explore the Numbers</h2>
          </div>
          <button
            aria-label="Close evidence"
            onClick={() => setEvidence(false)}
          >
            <X />
          </button>
        </div>
        <Notice>
          {historical
            ? "Fictional example, not a live ledger. Snapshot SAMPLE-Q3-26; business Scout & Co; GBP; Europe/London. No provider records or customer data are accessed."
            : section === "plan"
              ? "Plan uses fictional, unsaved scenarios and read-only action examples. The one-month B01 scenario baseline is separate from historical reporting. Open Review assumptions for the active method, inputs, formula and result. No action is saved."
              : section === "monitoring"
                ? "Monitoring evidence is a fictional capability demonstration. No live checks, schedule, consent, messages or delivery logs are asserted. Each conditional state carries its own example scope and time."
                : "Settings examples are not connection tests. Credentials, collection freshness and financial readiness are distinct. Draft guardrails and access policies are not saved or enforced by this preview."}
        </Notice>
        {historical ? (
          <DataTable
            caption="Selected context and evidence readiness"
            headers={["Evidence field", "Value"]}
            rows={[
              [
                "Period",
                historical
                  ? rangeLabel(resolved.period)
                  : "1 Jul – 30 Sep 2026 historical reference",
              ],
              [
                "Comparison",
                historical
                  ? rangeLabel(resolved.comparison)
                  : "1 Jul – 30 Sep 2025 historical reference",
              ],
              ["Snapshot", "SAMPLE-Q3-26 · 30 Sep 2026"],
              ["Formula version", SAMPLE_CONTEXT.formulaVersion],
              [
                "Readiness",
                historical
                  ? blocked
                    ? "Unavailable for selected context"
                    : viewState
                  : "Fictional design / capability state",
              ],
              [
                "Cost coverage",
                viewState === "incomplete"
                  ? "Incomplete: 12 products have no mapped costs"
                  : "Complete only within the fictional fixture",
              ],
              [
                "Inclusions",
                "Eligible original orders, shipping income and mapped costs; VAT excluded",
              ],
              [
                "Exclusions",
                "Test orders in real reporting, internal transfers, duplicated payouts; no cash forecast",
              ],
              [
                "Denominator",
                mode === "per-order" && section === "profit"
                  ? "9,980 current original eligible orders; 9,600 comparison orders"
                  : "Period totals; AOV has its own original-order denominator",
              ],
              [
                "Rounding",
                "Calculate at full precision, then round for display; never sum rounded per-order amounts",
              ],
            ]}
          />
        ) : (
          <DataTable
            caption="Capability and evidence boundaries"
            headers={["Scope", "Status"]}
            rows={[
              ["Page", titles[section][0]],
              ["Data", "Fictional examples only; no live source records"],
              [
                "Persistence",
                "Unavailable; no saved action, guardrail, invitation or monitoring configuration",
              ],
              [
                "Inspection",
                section === "plan"
                  ? "Review assumptions exposes active method and conditional results"
                  : "Expand the relevant state or policy to inspect its evidence and limitations",
              ],
              [
                "Financial permission",
                "No automatic provider write or spending authority",
              ],
            ]}
          />
        )}
        {section === "plan" && plannerEvidence}
        {(section === "growth" || section === "cash") &&
          scopedEvidence[section]}
        {historical && !blocked && (
          <DataTable
            caption={`Displayed historical values · ${context.mode === "per-order" ? "GBP per original eligible order" : "GBP totals"}`}
            headers={["Metric", "Current", "Comparison", "Definition"]}
            rows={[
              [
                "Net product sales",
                money(
                  data.current.netSales,
                  context.mode === "per-order" ? 2 : 0,
                ),
                comparisonSupported
                  ? money(
                      data.comparison.netSales,
                      context.mode === "per-order" ? 2 : 0,
                    )
                  : "Unavailable",
                "Product sales after discounts and returns; excludes shipping and VAT",
              ],
              [
                "Revenue including shipping",
                money(
                  data.current.revenue,
                  context.mode === "per-order" ? 2 : 0,
                ),
                comparisonSupported
                  ? money(
                      data.comparison.revenue,
                      context.mode === "per-order" ? 2 : 0,
                    )
                  : "Unavailable",
                "Net product sales + net shipping",
              ],
              [
                "Gross profit",
                viewState === "incomplete"
                  ? "Unavailable"
                  : money(
                      data.current.grossProfit,
                      context.mode === "per-order" ? 2 : 0,
                    ),
                comparisonSupported
                  ? money(
                      data.comparison.grossProfit,
                      context.mode === "per-order" ? 2 : 0,
                    )
                  : "Unavailable",
                "Net product sales − product costs; excludes shipping",
              ],
              [
                "CM3",
                viewState === "incomplete"
                  ? "Unavailable"
                  : money(
                      data.current.cm3,
                      context.mode === "per-order" ? 2 : 0,
                    ),
                comparisonSupported
                  ? money(
                      data.comparison.cm3,
                      context.mode === "per-order" ? 2 : 0,
                    )
                  : "Unavailable",
                "Revenue − product costs − variable costs − performance advertising",
              ],
              [
                "EBITDA",
                viewState === "incomplete"
                  ? "Unavailable"
                  : money(
                      data.current.ebitda,
                      context.mode === "per-order" ? 2 : 0,
                    ),
                comparisonSupported
                  ? money(
                      data.comparison.ebitda,
                      context.mode === "per-order" ? 2 : 0,
                    )
                  : "Unavailable",
                "CM3 − overheads excluding depreciation and amortisation",
              ],
            ]}
          />
        )}
        <p>
          Marketing attribution is not incrementality. Cash coverage,
          commitments and business guardrails are unconfirmed. Scenario
          calculations are conditional and do not authorise spending.
        </p>
        <button className="v11-explore" onClick={() => setEvidence(false)}>
          Close evidence
        </button>
      </dialog>
    </div>
  );
}
