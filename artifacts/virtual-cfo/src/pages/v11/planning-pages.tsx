import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  calculateScenarioView,
  difference,
  parsePoundsInput,
  DEFAULT_SCENARIO,
  SCENARIO_BASELINE,
  type GrowthMethod,
  type ScenarioCommon,
  type ScenarioInput,
} from "../../lib/v11";
import {
  Action,
  DataTable,
  Disclosure,
  MetricCard,
  Notice,
  Panel,
  Tabs,
  ValueChart,
  Verdict,
  WaterfallChart,
  count,
  money,
} from "../../components/v11/primitives";
import type { PageContext } from "./workspace";

const methods: { id: GrowthMethod; label: string }[] = [
  { id: "orders", label: "Order assumptions" },
  { id: "spend-cpa", label: "Spend & CPA" },
  { id: "traffic-conversion", label: "Traffic & conversion" },
];
const clone = (input: ScenarioInput): ScenarioInput => structuredClone(input);
interface InputRowProps {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  min: number;
  max: number;
  step?: number;
  baseline: string;
  moneyValue?: boolean;
  hint?: string;
  id: string;
  percentValue?: boolean;
}
function InputRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  baseline,
  moneyValue = false,
  hint,
  id,
  percentValue = false,
}: InputRowProps) {
  const display =
    value == null
      ? ""
      : percentValue
        ? Number((value * 100).toPrecision(12))
        : moneyValue
          ? value / 100
          : value;
  const update = (raw: string) => {
    if (raw === "") {
      onChange(null);
      return;
    }
    if (moneyValue) {
      onChange(parsePoundsInput(raw));
      return;
    }
    const n = Number(raw);
    onChange(Number.isFinite(n) ? (percentValue ? n / 100 : n) : null);
  };
  const invalid =
    value === null ||
    !Number.isFinite(value) ||
    Number(display) < 0 ||
    (id === "v11-cpa" && Number(display) <= 0) ||
    (percentValue && Number(display) > 100);
  return (
    <div className="v11-input-row">
      <label htmlFor={id}>{label}</label>
      <div className="v11-input-controls">
        <input
          aria-label={`${label} slider`}
          type="range"
          min={min}
          max={
            Number.isFinite(Number(display))
              ? Math.max(max, Number(display))
              : max
          }
          step={step}
          value={display === "" ? min : display}
          onChange={(e) => update(e.target.value)}
        />
        <input
          id={id}
          type="number"
          min={id === "v11-cpa" ? 0.01 : 0}
          max={percentValue ? 100 : undefined}
          step={step}
          value={display}
          onChange={(e) => update(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={`${id}-help`}
        />
      </div>
      <small id={`${id}-help`}>
        Read-only baseline {baseline}
        {hint ? ` · ${hint}` : ""}
      </small>
      {invalid && (
        <p className="v11-field-error">
          Enter a finite non-negative value
          {percentValue
            ? " no greater than 100%"
            : id === "v11-cpa"
              ? "; CPA must be greater than zero"
              : ""}{" "}
          to calculate this assumption.
        </p>
      )}
    </div>
  );
}
export function PlanPage({
  context: ctx,
  tab,
  setTab,
  onEvidenceChange,
}: {
  context: PageContext;
  tab: string;
  setTab: (t: string) => void;
  onEvidenceChange?: (evidence: ReactNode) => void;
}) {
  const selected = ["planner", "accepted"].includes(tab)
    ? tab
    : tab === "discount-review" || tab === "acquisition-review"
      ? "planner"
      : "opportunities";
  const [scenario, setScenario] = useState<ScenarioInput>(() =>
      clone(DEFAULT_SCENARIO),
    ),
    [review, setReview] = useState(false),
    [acceptedState, setAcceptedState] = useState("unavailable");
  const dialog = useRef<HTMLDialogElement>(null),
    reviewButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (tab === "discount-review") {
      setScenario((old) => ({ ...old, method: "orders" }));
      setReview(true);
    } else if (tab === "acquisition-review") {
      setScenario((old) => ({ ...old, method: "spend-cpa" }));
      setReview(true);
    }
  }, [tab]);
  useEffect(() => {
    if (review) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [review]);
  const result = calculateScenarioView(scenario),
    baseline = calculateScenarioView(SCENARIO_BASELINE);
  useEffect(() => {
    if (selected !== "planner") {
      onEvidenceChange?.(
        <DataTable
          caption={
            selected === "opportunities"
              ? "Opportunity evidence and ranking"
              : "Accepted action capability / example evidence"
          }
          headers={["Field", "Evidence"]}
          rows={
            selected === "opportunities"
              ? [
                  ["Baseline", "SAMPLE-Q3-26 · 1 Jul–30 Sep 2026 · GBP"],
                  [
                    "Priority",
                    "Stock review: £24,000 inventory growth is the largest evidenced working-capital movement",
                  ],
                  [
                    "Effort and dependency",
                    "Low-effort investigation; product ageing, demand and lead-time evidence needed",
                  ],
                  [
                    "Financial benefit",
                    "No recoverable saving or causal benefit established",
                  ],
                  [
                    "Other investigations",
                    "Discount response and acquisition economics; impacts overlap and must not be summed",
                  ],
                  [
                    "Acceptance",
                    "Unavailable until versioned persistence, owner, review date and server permissions exist",
                  ],
                ]
              : [
                  ["State", acceptedState],
                  [
                    "Capability",
                    "Unavailable; examples are read-only and are not saved records",
                  ],
                  [
                    "Action reference",
                    acceptedState === "active" || acceptedState === "overdue"
                      ? "Fictional A01 · stock-ageing review"
                      : "No accepted action asserted",
                  ],
                  [
                    "Example date",
                    acceptedState === "active"
                      ? "2 October 2026"
                      : acceptedState === "overdue"
                        ? "8 October 2026"
                        : "Not applicable",
                  ],
                  [
                    "Original review date",
                    "7 October 2026 in the A01 example; never silently rewritten",
                  ],
                  [
                    "Baseline",
                    "SAMPLE-Q3-26; no scenario applies to this cash investigation",
                  ],
                  [
                    "Financial outcome",
                    "No benefit or causal saving established",
                  ],
                ]
          }
        />,
      );
      return;
    }
    onEvidenceChange?.(
      <>
        <DataTable
          caption="Active scenario evidence · full precision before display rounding"
          headers={["Field", "Value"]}
          rows={[
            [
              "Baseline",
              "ILLUSTRATIVE-MONTH-B01 · immutable; not the quarterly report",
            ],
            ["Horizon", "One month · GBP"],
            [
              "Active method",
              methods.find((m) => m.id === scenario.method)?.label,
            ],
            ["Formula", result.formula],
            ["Readiness", result.state],
            ["Formula version", result.formulaVersion],
            ["Resolved orders", count(result.orders)],
            ["Net product sales", money(result.netProductSales, 2)],
            ["CM3", money(result.cm3, 2)],
            ["EBITDA", money(result.ebitda, 2)],
            [
              "Cash modelling",
              "Not modelled: stock funding, payout timing and VAT",
            ],
            [
              "Persistence",
              "Unsaved local draft; no action or scenario record created",
            ],
          ]}
        />
        <DataTable
          caption="Shared assumptions · all methods use these values"
          headers={["Input", "GBP"]}
          rows={Object.entries(scenario.common).map(([name, value]) => [
            name,
            money(value == null ? null : value / 100, 2),
          ])}
        />
        <DataTable
          caption="Active method inputs · inactive methods excluded from results"
          headers={["Input", "Value"]}
          rows={Object.entries(scenario.methods[scenario.method]).map(
            ([name, value]) => [
              name,
              name === "cpa"
                ? money(value == null ? null : value / 100, 2)
                : name === "conversion"
                  ? value == null
                    ? "Unavailable"
                    : `${value * 100}%`
                  : count(value),
            ],
          )}
        />
        <Notice>
          Only the active growth method resolves orders. Costs, marketing and
          staff are deducted once. Inputs and results remain conditional; this
          is not spending authority.
        </Notice>
      </>,
    );
  }, [scenario, onEvidenceChange, selected, acceptedState]);
  const common = (key: keyof ScenarioCommon, value: number | null) =>
    setScenario((old) => ({ ...old, common: { ...old.common, [key]: value } }));
  const changeMethod = (method: GrowthMethod) =>
    setScenario((old) => ({ ...old, method }));
  const methodField = (
    method: GrowthMethod,
    key: string,
    value: number | null,
  ) =>
    setScenario((old) => ({
      ...old,
      methods: {
        ...old.methods,
        [method]: { ...old.methods[method], [key]: value },
      },
    }));
  const resetMethod = () =>
    setScenario((old) => ({
      ...old,
      methods: {
        ...old.methods,
        [old.method]: clone(SCENARIO_BASELINE).methods[old.method],
      },
    }));
  const rows = [
    ["Net product sales", baseline.netProductSales, result.netProductSales],
    ["CM3", baseline.cm3, result.cm3],
    ["EBITDA", baseline.ebitda, result.ebitda],
  ] as const;
  const bridge = result.bridge;
  const sensitivity =
    scenario.method === "spend-cpa"
      ? calculateScenarioView({
          ...scenario,
          methods: {
            ...scenario.methods,
            "spend-cpa": { ...scenario.methods["spend-cpa"], cpa: 2400 },
          },
        })
      : null;
  return (
    <>
      <Tabs
        label="Plan views"
        tabs={[
          { id: "opportunities", label: "Opportunities" },
          { id: "planner", label: "Scenario planner" },
          { id: "accepted", label: "Accepted actions" },
        ]}
        active={selected}
        onChange={setTab}
      />
      {selected === "opportunities" && (
        <>
          <Verdict
            eyebrow="The plan"
            title="Start with a stock review."
            description="Inventory absorbed £24,000 this period. Investigate the movement; no recoverable saving is established."
            action={
              <Action onClick={() => ctx.navigate("cash", "stock")}>
                Review stock movements
              </Action>
            }
          />
          <p className="v11-eyebrow">
            Recommended investigations · no action accepted
          </p>
          <Disclosure
            title="1 · Review product ageing and replenishment"
            defaultOpen
            summary="Largest evidenced working-capital movement; low-effort investigation."
          >
            <p>
              Inspect affected products, purchase timing, age, sell-through and
              lead times before recommending a reorder change.
            </p>
            <div className="v11-two-columns">
              <DataTable
                caption="Scope and decision boundaries"
                headers={["Field", "Requirement"]}
                rows={[
                  [
                    "Baseline",
                    "SAMPLE-Q3-26 · inventory £144,000; increase £24,000; operating cash £14,000",
                  ],
                  [
                    "Success",
                    "Explain stock movements using product and replenishment evidence",
                  ],
                  [
                    "Stop rule",
                    "No stock change without ageing, demand and lead-time evidence",
                  ],
                  ["Owner", "Not assigned"],
                  ["Review date", "To be agreed"],
                ]}
              />
              <div>
                <Notice>
                  Saving and accepting actions are unavailable until versioned
                  persistence and server-side permissions exist.
                </Notice>
                <Action onClick={() => ctx.navigate("cash", "stock")}>
                  Open Cash Control
                </Action>
              </div>
            </div>
          </Disclosure>
          <Disclosure
            title="2 · Review discount test"
            summary="Set explicit demand and AOV assumptions, not a neutral preset."
          >
            <p>
              Discount deductions increased in the fictional example. A price or
              discount change cannot assume unchanged demand.
            </p>
            <ul className="v11-review-checklist">
              <li>Define expected order volume and AOV, then test both.</li>
              <li>
                Agree adequate observation, contribution and conversion
                guardrails.
              </li>
              <li>
                Confirm an owner, review date and stop criteria before
                acceptance.
              </li>
            </ul>
            <Action secondary onClick={() => setTab("discount-review")}>
              Define test assumptions
            </Action>
          </Disclosure>
          <Disclosure
            title="3 · Review acquisition economics"
            summary="Validate first-order contribution and matched payback before spend changes."
          >
            <p>
              Current acquisition gap is £19,800 in the complete fictional
              fixture; mature payback is a separate cohort observation.
            </p>
            <Action
              secondary
              onClick={() => ctx.navigate("growth", "investment")}
            >
              Open investment scorecard
            </Action>
          </Disclosure>
          <Disclosure
            title="Ranking evidence and dependencies"
            summary="Why investigate stock first?"
          >
            <DataTable
              caption="Inspectable example ranking · do not sum overlapping opportunities"
              headers={["Investigation", "Evidence", "Effort / dependency"]}
              rows={[
                [
                  "Stock movement",
                  "£24,000 inventory growth is the largest evidenced working-capital movement",
                  "Low-effort evidence review; ageing and lead times needed",
                ],
                [
                  "Discount assumptions",
                  "Profit pressure and discount deductions",
                  "Demand response and adequate observation needed",
                ],
                [
                  "Acquisition economics",
                  "First-order contribution below current CAC",
                  "Matched costs, cash commitments and guardrails needed",
                ],
              ]}
            />
          </Disclosure>
        </>
      )}
      {selected === "planner" && (
        <>
          <div className="v11-baseline">
            <strong>Baseline: Illustrative month B01 (read-only)</strong> ·
            One-month scenario horizon · GBP · separate from historical report
            dates
          </div>
          <Verdict
            eyebrow="Conditional scenario"
            title={
              result.state === "ready"
                ? `These assumptions ${bridge?.change != null && bridge.change < 0 ? "reduce" : "add"} ${money(Math.abs(bridge?.change || 0))} ${bridge?.change != null && bridge.change < 0 ? "from" : "to"} monthly EBITDA.`
                : "Needs assumptions before a result can be calculated."
            }
            description="A scenario is a conditional calculation, not a recommendation or a forecast."
            action={
              <button
                ref={reviewButton}
                className="v11-action"
                onClick={() => setReview(true)}
              >
                Review assumptions →
              </button>
            }
          />
          <div className="v11-card-grid">
            {rows.map(([title, base, value]) => (
              <MetricCard
                key={title}
                title={title}
                value={money(value)}
                detail={`Baseline ${money(base)}`}
                comparison={
                  value != null && base != null
                    ? `Change ${money(difference(value, base))}`
                    : "Needs assumptions"
                }
              />
            ))}
          </div>
          <div className="v11-planner-grid">
            <Panel title="Adjust your assumptions">
              <div className="v11-planner-controls">
                <Notice>
                  <strong>Choose one growth method.</strong>
                  <br />
                  Only the selected method drives results. Switching replaces
                  the growth calculation; methods are not added together. AOV,
                  marketing spend, costs and overheads stay shared.
                </Notice>
                <Tabs
                  label="Growth method"
                  tabs={methods}
                  active={scenario.method}
                  onChange={(m) => changeMethod(m as GrowthMethod)}
                />
                <div className="v11-scenario-inputs">
                  {scenario.method === "orders" && (
                    <InputRow
                      id="v11-orders"
                      label="Total orders"
                      value={scenario.methods.orders.orders}
                      baseline="1,000 orders"
                      min={0}
                      max={5000}
                      onChange={(v) => methodField("orders", "orders", v)}
                      hint="Marketing spend changes cost, not order volume"
                    />
                  )}
                  {scenario.method === "spend-cpa" && (
                    <>
                      <InputRow
                        id="v11-cpa"
                        label="New-customer CPA (GBP)"
                        value={scenario.methods["spend-cpa"].cpa}
                        baseline="£20"
                        moneyValue
                        min={0.01}
                        max={200}
                        step={0.01}
                        onChange={(v) => methodField("spend-cpa", "cpa", v)}
                        hint="Assumed at proposed spend; must be positive"
                      />
                      <InputRow
                        id="v11-other-orders"
                        label="Other orders"
                        value={scenario.methods["spend-cpa"].otherOrders}
                        baseline="500 orders"
                        min={0}
                        max={5000}
                        onChange={(v) =>
                          methodField("spend-cpa", "otherOrders", v)
                        }
                        hint="Returning and non-paid first orders; excludes paid first orders already counted"
                      />
                    </>
                  )}
                  {scenario.method === "traffic-conversion" && (
                    <>
                      <InputRow
                        id="v11-sessions"
                        label="Whole-site sessions"
                        value={scenario.methods["traffic-conversion"].sessions}
                        baseline="50,000 sessions"
                        min={0}
                        max={200000}
                        step={100}
                        onChange={(v) =>
                          methodField("traffic-conversion", "sessions", v)
                        }
                        hint="Sessions, eligible orders, store and dates must match"
                      />
                      <InputRow
                        id="v11-conversion"
                        label="Orders per session (%)"
                        value={
                          scenario.methods["traffic-conversion"].conversion
                        }
                        baseline="2.0%"
                        min={0}
                        max={20}
                        step={0.1}
                        percentValue
                        onChange={(v) =>
                          methodField("traffic-conversion", "conversion", v)
                        }
                        hint="Whole-site orders; no additional Other orders"
                      />
                    </>
                  )}
                  <InputRow
                    id="v11-aov"
                    label="Average order value (GBP)"
                    value={scenario.common.aov}
                    baseline="£100"
                    min={0}
                    max={300}
                    step={1}
                    moneyValue
                    onChange={(v) => common("aov", v)}
                    hint="Excludes shipping, VAT and later refunds"
                  />
                  <InputRow
                    id="v11-marketing"
                    label="Performance marketing spend (GBP)"
                    value={scenario.common.marketing}
                    baseline="£10,000"
                    min={0}
                    max={50000}
                    step={100}
                    moneyValue
                    onChange={(v) => common("marketing", v)}
                  />
                </div>
                <div className="v11-reset-row">
                  <button className="v11-link" onClick={resetMethod}>
                    Reset this method
                  </button>
                  <button
                    className="v11-link"
                    onClick={() => setScenario(clone(SCENARIO_BASELINE))}
                  >
                    Reset all to baseline
                  </button>
                </div>
                <Notice>
                  {result.formula}{" "}
                  {result.orders != null
                    ? `→ ${count(result.orders)} eligible orders.`
                    : ""}
                </Notice>
                <Disclosure
                  title="Costs"
                  summary="Per-order costs and evidenced recovery."
                >
                  <div className="v11-scenario-inputs">
                    {(
                      [
                        {
                          key: "productCostPerOrder",
                          label: "Product cost per order",
                          base: "£40",
                          max: 200,
                        },
                        {
                          key: "shippingPerOrder",
                          label: "Shipping cost per order",
                          base: "£4",
                          max: 50,
                        },
                        {
                          key: "fulfilmentPerOrder",
                          label: "Fulfilment cost per order",
                          base: "£3",
                          max: 50,
                        },
                        {
                          key: "paymentPerOrder",
                          label: "Payment cost per order",
                          base: "£2",
                          max: 50,
                        },
                        {
                          key: "refunds",
                          label: "Product refunds",
                          base: "£5,000",
                          max: 30000,
                        },
                        {
                          key: "returnedStockRecovery",
                          label: "Evidenced returned-stock recovery",
                          base: "£2,000",
                          max: 20000,
                        },
                        {
                          key: "netShipping",
                          label: "Net shipping income",
                          base: "£2,900",
                          max: 20000,
                        },
                      ] as const
                    ).map((f) => (
                      <InputRow
                        key={f.key}
                        id={`v11-${f.key}`}
                        label={`${f.label} (GBP)`}
                        value={scenario.common[f.key]}
                        baseline={f.base}
                        min={0}
                        max={f.max}
                        step={1}
                        moneyValue
                        onChange={(v) => common(f.key, v)}
                      />
                    ))}
                  </div>
                </Disclosure>
                <Disclosure
                  title="Overheads"
                  summary="Staff costs and other overheads, deducted once."
                >
                  <InputRow
                    id="v11-staff"
                    label="Staff costs (GBP)"
                    value={scenario.common.staff}
                    baseline="£10,000"
                    min={0}
                    max={50000}
                    step={100}
                    moneyValue
                    onChange={(v) => common("staff", v)}
                  />
                  <InputRow
                    id="v11-overheads"
                    label="Other overheads (GBP)"
                    value={scenario.common.otherOverheads}
                    baseline="£8,000"
                    min={0}
                    max={50000}
                    step={100}
                    moneyValue
                    onChange={(v) => common("otherOverheads", v)}
                  />
                  <p className="v11-muted">
                    Software is included in Other overheads. The fixture has no
                    separate fixed non-performance advertising; real businesses
                    require an explicit mapping.
                  </p>
                </Disclosure>
              </div>
            </Panel>
            <div className="v11-planner-result">
              <Panel title="Why EBITDA changes">
                {bridge ? (
                  <>
                    <WaterfallChart
                      title="Baseline to scenario EBITDA"
                      baselineLabel="Baseline EBITDA"
                      resultLabel="Scenario EBITDA"
                      baseline={bridge.baseline!}
                      result={bridge.result!}
                      rows={[
                        { label: "Volume", value: bridge.volume! },
                        { label: "AOV", value: bridge.aov! },
                        { label: "Marketing", value: bridge.marketing! },
                        { label: "Other", value: bridge.other! },
                      ]}
                    />
                  </>
                ) : (
                  <Notice tone="warning">
                    {result.issues.join(" ") ||
                      "Complete the active method and shared assumptions."}
                  </Notice>
                )}
              </Panel>
              <Panel title="What needs to be true?">
                <ul className="v11-review-checklist">
                  <li>
                    {scenario.method === "orders"
                      ? "What evidence supports the proposed order volume?"
                      : scenario.method === "spend-cpa"
                        ? "Is the assumed CPA achievable at the proposed spend?"
                        : "Are sessions and orders-per-session matched to the same whole-site scope?"}
                  </li>
                  <li>
                    What supports the proposed AOV and refund assumptions?
                  </li>
                  <li>
                    Can fulfilment and staff capacity support the proposed
                    orders?
                  </li>
                </ul>
              </Panel>
              {sensitivity && (
                <Disclosure
                  title="Alternative CPA sensitivity: £24"
                  summary="Separate conditional case; the active scenario is unchanged."
                >
                  <Notice>
                    Uses the current shared assumptions and Other orders, with
                    CPA set explicitly to £24. This is not a forecast and is not
                    necessarily adverse relative to every draft CPA.
                  </Notice>
                  <DataTable
                    caption="Spend & CPA sensitivity · one-month horizon"
                    headers={["Measure", "Alternative case"]}
                    rows={[
                      ["CPA", "£24.00"],
                      ["Resolved orders", count(sensitivity.orders)],
                      ["Net product sales", money(sensitivity.netProductSales)],
                      ["CM3", money(sensitivity.cm3)],
                      ["EBITDA", money(sensitivity.ebitda)],
                      [
                        "Change from active draft",
                        money(difference(sensitivity.ebitda, result.ebitda)),
                      ],
                    ]}
                  />
                  {sensitivity.state !== "ready" && (
                    <Notice tone="warning">
                      Needs assumptions: {sensitivity.issues.join(" ")}
                    </Notice>
                  )}
                </Disclosure>
              )}
              <Notice tone="warning">
                <strong>Profit is not cash.</strong>
                <br />
                Stock funding, payout timing and VAT are not modelled.
              </Notice>
            </div>
          </div>
          <p className="v11-muted" aria-live="polite" aria-atomic="true">
            {methods.find((m) => m.id === scenario.method)?.label} active.{" "}
            {result.state === "ready"
              ? `Scenario EBITDA ${money(result.ebitda)}.`
              : "Needs assumptions."}
          </p>
        </>
      )}
      {selected === "accepted" && (
        <>
          <label className="v11-state-selector">
            Fictional workflow example
            <select
              value={acceptedState}
              onChange={(e) => setAcceptedState(e.target.value)}
            >
              <option value="unavailable">Capability unavailable</option>
              <option value="empty">Empty example</option>
              <option value="active">Active example · 2 Oct</option>
              <option value="overdue">Overdue example · 8 Oct</option>
            </select>
          </label>
          {acceptedState === "unavailable" ? (
            <>
              <Verdict
                eyebrow="Accepted actions"
                title="Action saving is not available in this build."
                description="Keep investigating the evidence. No accepted action, review reminder or history has been saved."
                action={
                  <Action onClick={() => setTab("opportunities")}>
                    Review opportunities
                  </Action>
                }
              />
              <Notice>
                Versioned persistence and server-side permissions are required
                before accepting, adapting, dismissing, snoozing or rescheduling
                an action.
              </Notice>
            </>
          ) : acceptedState === "empty" ? (
            <Panel title="No accepted actions yet">
              <div className="v11-empty">
                <p>
                  Choose a supported investigation and agree an owner, review
                  date and stop rule.
                </p>
                <Action onClick={() => setTab("opportunities")}>
                  Review opportunities
                </Action>
              </div>
            </Panel>
          ) : (
            <>
              <Verdict
                eyebrow="Fictional action A01"
                title={
                  acceptedState === "overdue"
                    ? "The original review date has passed."
                    : "Stock-ageing review is in progress."
                }
                description={
                  acceptedState === "overdue"
                    ? "Example dated 8 October. Original review due 7 October; history and original date are preserved."
                    : "Example dated 2 October. Eight of the twenty highest-stock-value SKUs have been reviewed."
                }
                action={
                  <Action onClick={() => ctx.navigate("cash", "stock")}>
                    Review stock evidence
                  </Action>
                }
              />
              <DataTable
                caption="Read-only workflow reference · not a saved action"
                headers={["Field", "Example"]}
                rows={[
                  ["Action", "A01 · Stock-ageing review"],
                  ["Owner", "Store owner"],
                  ["Accepted", "1 October 2026"],
                  [
                    "Baseline",
                    "SAMPLE-Q3-26 · inventory £144,000; increase £24,000; operating cash £14,000",
                  ],
                  ["Progress", "8 / 20 highest-stock-value SKUs reviewed"],
                  ["Original review date", "7 October 2026"],
                  [
                    "Stop rule",
                    "No reorder change without ageing and lead-time evidence",
                  ],
                  ["Scenario", "Not applicable: historical cash investigation"],
                  [
                    "Financial outcome",
                    "No cash benefit or causal saving established",
                  ],
                ]}
              />
              <Notice>
                Rescheduling requires an explicit reason and persistent history.
                Those services are unavailable here.
              </Notice>
            </>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        className="v11-evidence-dialog"
        onCancel={() => setReview(false)}
        onClose={() => {
          setReview(false);
          reviewButton.current?.focus();
        }}
        aria-labelledby="v11-review-title"
      >
        <div className="v11-dialog-heading">
          <div>
            <p className="v11-eyebrow">Assumption review · unsaved draft</p>
            <h2 id="v11-review-title">Review the active assumptions</h2>
          </div>
          <button
            onClick={() => setReview(false)}
            aria-label="Close assumption review"
          >
            <X />
          </button>
        </div>
        {tab === "discount-review" && (
          <Notice tone="warning">
            Discount review: no demand response is established. The illustrative
            order and AOV values are assumptions to validate, not an approved
            discount recommendation.
          </Notice>
        )}
        <DataTable
          caption="Conditional one-month scenario · baseline B01"
          headers={["Field", "Current draft"]}
          rows={[
            [
              "Active growth method",
              methods.find((m) => m.id === scenario.method)?.label,
            ],
            ["Active calculation", result.formula],
            ["Orders", count(result.orders)],
            [
              "AOV",
              money(
                scenario.common.aov == null ? null : scenario.common.aov / 100,
                2,
              ),
            ],
            [
              "Marketing spend",
              money(
                scenario.common.marketing == null
                  ? null
                  : scenario.common.marketing / 100,
              ),
            ],
            ["Scenario EBITDA", money(result.ebitda)],
            ["Formula version", result.formulaVersion],
            [
              "Persistence",
              "Unavailable · no scenario or action has been saved",
            ],
          ]}
        />
        <ul className="v11-review-checklist">
          <li>
            Validate CPA at the proposed spend or the chosen demand assumptions.
          </li>
          <li>Confirm AOV, conversion, refunds and operational capacity.</li>
          <li>
            Agree owner, review date, adequate observation and stop rules before
            action.
          </li>
          <li>Review cash commitments separately; profit is not cash.</li>
        </ul>
        <button className="v11-explore" onClick={() => setReview(false)}>
          Return to assumptions
        </button>
      </dialog>
    </>
  );
}
