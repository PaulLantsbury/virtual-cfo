import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  buildProfitBridge,
  difference,
  percentageChange,
  safeRatio,
} from "../../lib/v11";
import {
  Action,
  DataTable,
  HorizontalBars,
  RevenueComposition,
  Disclosure,
  MetricCard,
  Notice,
  Panel,
  RevenueSankey,
  Tabs,
  ValueChart,
  Verdict,
  WaterfallChart,
  count,
  money,
  percent,
} from "../../components/v11/primitives";
import type { PageContext } from "./workspace";

function ProfitCards({
  data,
  perOrder,
  mode,
  incomplete,
  comparison,
}: PageContext) {
  const c = data.current,
    p = data.comparison;
  const decimals = mode === "per-order" ? 2 : 0;
  return (
    <div className="v11-card-grid">
      <MetricCard
        title="Net product sales"
        value={money(c.netSales, decimals)}
        detail={
          mode === "total"
            ? `${money(perOrder.current.netSales, 2)} per order`
            : "Per original eligible order"
        }
        comparison={
          comparison
            ? `${percent(percentageChange(c.netSales, p.netSales))} vs comparison`
            : undefined
        }
      />
      <MetricCard
        title="Contribution after advertising (CM3)"
        value={incomplete ? "Unavailable" : money(c.cm3, decimals)}
        detail={
          incomplete
            ? "12 products lack mapped costs"
            : mode === "total"
              ? `${money(perOrder.current.cm3, 2)} per order`
              : "Per original eligible order"
        }
        comparison={
          !incomplete && comparison
            ? `${percent(percentageChange(c.cm3, p.cm3))} vs comparison`
            : undefined
        }
      />
      <MetricCard
        title="Profit (EBITDA)"
        value={incomplete ? "Unavailable" : money(c.ebitda, decimals)}
        detail={
          incomplete
            ? "Complete costs required"
            : mode === "total"
              ? `${money(perOrder.current.ebitda, 2)} per order`
              : "Per original eligible order"
        }
        comparison={
          !incomplete && comparison
            ? `${percent(percentageChange(c.ebitda, p.ebitda))} vs comparison`
            : undefined
        }
      />
    </div>
  );
}
function ProfitFlow(ctx: PageContext) {
  const c = ctx.data.current;
  return (
    <Panel
      title="Where your revenue goes"
      subtitle={`From revenue including shipping to EBITDA · ${ctx.mode === "per-order" ? "per original eligible order" : "selected period totals"}. This is not a cash-flow statement.`}
    >
      <RevenueSankey
        revenue={c.revenue}
        mode={ctx.mode}
        flows={[
          {
            label: "Product costs",
            value: ctx.incomplete ? null : c.productCosts,
          },
          { label: "Variable costs", value: c.variableCosts },
          { label: "Advertising", value: c.advertising },
          { label: "Overheads excluding D&A", value: c.overheads },
          { label: "Profit (EBITDA)", value: ctx.incomplete ? null : c.ebitda },
        ]}
      />
      {ctx.incomplete ? (
        <Notice tone="warning">
          Cost coverage is incomplete. CM3, EBITDA and the revenue
          reconciliation are withheld.
        </Notice>
      ) : (
        <Notice>
          <strong>Profitability comparison</strong>
          <br />
          EBITDA margin {percent(c.ebitdaMargin)}
          {ctx.comparison
            ? ` vs ${percent(ctx.data.comparison.ebitdaMargin)} in the comparison period`
            : ". No supported comparison selected."}{" "}
          A materiality tolerance has not been configured, so the interpretation
          remains neutral.
        </Notice>
      )}
    </Panel>
  );
}
function CashBridge({ data, incomplete }: PageContext) {
  const c = data.cash;
  return (
    <>
      <div className="v11-bridge">
        <div className="v11-bridge-block">
          <span>EBITDA</span>
          <strong>{money(incomplete ? null : c.ebitda)}</strong>
        </div>
        <span className="v11-bridge-arrow" aria-hidden="true">
          →
        </span>
        <div className="v11-bridge-block teal">
          <span>Operating cash</span>
          <strong>{money(c.operatingCash)}</strong>
        </div>
        <span className="v11-bridge-arrow" aria-hidden="true">
          →
        </span>
        <div className="v11-bridge-block red">
          <span>Bank movement</span>
          <strong>{money(c.bankMovement)}</strong>
        </div>
      </div>
      <div className="v11-bank-roll">
        <div>
          Opening bank<strong>{money(c.openingBank)}</strong>
        </div>
        <ArrowRight aria-hidden="true" />
        <div>
          Closing bank<strong>{money(c.closingBank)}</strong>
          <span>as at 30 Sep 2026</span>
        </div>
      </div>
      {incomplete && (
        <Notice tone="warning">
          EBITDA and the profit-to-cash reconciliation are unavailable while
          cost coverage is incomplete. Independently supported cash flows and
          dated bank balances remain visible.
        </Notice>
      )}
      <Notice tone="warning">
        Historical cash is not spending capacity. Commitments and business
        guardrails are unconfirmed.
      </Notice>
    </>
  );
}
export function ScoutPage(ctx: PageContext) {
  const c = ctx.data.current,
    cash = ctx.data.cash;
  return (
    <>
      <Verdict
        eyebrow="The CFO view"
        title={
          ctx.incomplete
            ? "Sales are available. Complete profit evidence is not."
            : ctx.quiet
              ? "No new material changes in the checked data."
              : ctx.comparison
                ? "Sales are growing. Profit is under pressure."
                : "Review the supported profit and cash position."
        }
        description={
          ctx.incomplete
            ? "12 products lack mapped costs. CM3 and EBITDA are withheld; dated cash remains visible."
            : ctx.quiet
              ? "Quiet relative to the last completed review. Historical declines remain in the cards below."
              : `Stock increased ${money(cash.inventoryIncrease)} while operating cash was ${money(cash.operatingCash)}.`
        }
        action={
          <Action
            onClick={() =>
              ctx.incomplete
                ? ctx.navigate("settings", "connections")
                : ctx.quiet
                  ? ctx.explore()
                  : ctx.navigate("cash", "stock")
            }
          >
            {ctx.incomplete
              ? "Review missing product costs"
              : ctx.quiet
                ? "View checked evidence"
                : "Review stock movements"}
          </Action>
        }
      />
      {ctx.quiet && (
        <Notice>
          Fictional completed review · SAMPLE-Q3-26 · 2 Oct 2026, 08:00 London ·
          profit, contribution and historical cash coverage checked. This does
          not establish live monitoring.
        </Notice>
      )}
      <div className="v11-card-grid four">
        <MetricCard
          title="Net product sales"
          value={money(c.netSales)}
          detail={`${money(ctx.perOrder.current.netSales, 2)} per order`}
          comparison={
            ctx.comparison
              ? `${percent(percentageChange(c.netSales, ctx.data.comparison.netSales))} vs comparison`
              : undefined
          }
        />
        <MetricCard
          title="CM3 contribution after advertising"
          value={ctx.incomplete ? "Unavailable" : money(c.cm3)}
          detail={
            ctx.incomplete
              ? "Incomplete product costs"
              : `${money(ctx.perOrder.current.cm3, 2)} per order`
          }
          comparison={
            !ctx.incomplete && ctx.comparison
              ? `${percent(percentageChange(c.cm3, ctx.data.comparison.cm3))} vs comparison`
              : undefined
          }
        />
        <MetricCard
          title="Profit (EBITDA)"
          value={ctx.incomplete ? "Unavailable" : money(c.ebitda)}
          detail={
            ctx.incomplete
              ? "Complete evidence required"
              : `${money(ctx.perOrder.current.ebitda, 2)} per order`
          }
          comparison={
            !ctx.incomplete && ctx.comparison
              ? `${percent(percentageChange(c.ebitda, ctx.data.comparison.ebitda))} vs comparison`
              : undefined
          }
        />
        <MetricCard
          title="Bank cash"
          value={money(cash.closingBank)}
          detail="As at 30 Sep 2026"
          comparison={`${money(cash.bankMovement)} since 1 Jul`}
        />
      </div>
      <p className="v11-order-note">
        {count(c.orders)} original eligible orders · selected period
      </p>
      <Disclosure
        title="01 · Where your money goes"
        summary="Product, advertising and operating costs explain the result."
      >
        <ProfitFlow {...ctx} />
      </Disclosure>
      <Disclosure
        title="02 · Cash and marketing"
        summary="Cash movement and acquisition economics are separate questions."
      >
        <div className="v11-two-columns">
          <Panel title="Cash bridge">
            <CashBridge {...ctx} />
          </Panel>
          <Panel title="Marketing and investment scorecard">
            <DataTable
              caption="Selected quarter · no scaling recommendation"
              headers={["Measure", "Value"]}
              rows={[
                [
                  "CM3 per order",
                  ctx.incomplete
                    ? "Unavailable"
                    : money(ctx.perOrder.current.cm3, 2),
                ],
                ["Overhead coverage per order", money(c.overheadPerOrder, 2)],
                [
                  "First-order contribution gap",
                  ctx.incomplete
                    ? "Unavailable"
                    : money(ctx.data.marketing.acquisitionGap),
                ],
                [
                  "Mature observed payback",
                  `${ctx.data.marketing.paybackDays} days · Apr–Jun cohort`,
                ],
              ]}
            />
            <Notice tone="warning">
              Needs evidence · cash commitments and business guardrails are
              unconfirmed.
            </Notice>
          </Panel>
        </div>
      </Disclosure>
      <Disclosure
        title="03 · Your next moves"
        summary={
          ctx.incomplete
            ? "Complete product costs before profit diagnostics."
            : ctx.quiet
              ? "No additional action recommended; inspect the existing review."
              : "Investigate stock, review discount assumptions and acquisition economics."
        }
      >
        {ctx.incomplete ? (
          <>
            <Notice tone="warning">
              Complete product-cost mappings before profit diagnostics or
              scaling advice. Independently supported cash evidence remains
              available.
            </Notice>
            <Action
              secondary
              onClick={() => ctx.navigate("settings", "connections")}
            >
              Review missing product costs
            </Action>
          </>
        ) : ctx.quiet ? (
          <>
            <Notice>
              No new action is recommended relative to the last completed
              fictional review. Historical profit pressure is already
              acknowledged.
            </Notice>
            <Action secondary onClick={() => ctx.navigate("plan", "accepted")}>
              View existing review example
            </Action>
          </>
        ) : (
          <NextMoves ctx={ctx} />
        )}
      </Disclosure>
      <div className="v11-two-columns">
        <Panel title="Your plan and next review">
          <p>
            Choose a supported investigation, then agree an owner and review
            criteria.
          </p>
          <Action secondary onClick={() => ctx.navigate("plan", "accepted")}>
            Review your actions
          </Action>
        </Panel>
        <Panel title="Monitoring is unavailable">
          <p>No checks or messages are running in this build.</p>
          <button
            className="v11-link"
            onClick={() => ctx.navigate("monitoring")}
          >
            Learn how monitoring will work →
          </button>
        </Panel>
      </div>
    </>
  );
}
function NextMoves({ ctx }: { ctx: PageContext }) {
  return (
    <div>
      {[
        {
          title: "Investigate the stock increase",
          body: "Inspect product mix, purchase timing, ageing and replenishment. No recoverable saving is established.",
          label: "Open Cash Control",
          click: () => ctx.navigate("cash", "stock"),
        },
        {
          title: "Review the discount test",
          body: "Define order and AOV assumptions with contribution and conversion guardrails.",
          label: "Define test assumptions",
          click: () => ctx.navigate("plan", "discount-review"),
        },
        {
          title: "Review acquisition economics",
          body: "Validate contribution, payback and the first-order contribution gap before changing spend.",
          label: "Open investment scorecard",
          click: () => ctx.navigate("growth", "investment"),
        },
      ].map((item) => (
        <div className="v11-action-row" key={item.title}>
          <div>
            <h4>{item.title}</h4>
            <p>{item.body}</p>
          </div>
          <Action secondary onClick={item.click}>
            {item.label}
          </Action>
        </div>
      ))}
    </div>
  );
}
export function ProfitPage(ctx: PageContext) {
  const c = ctx.data.current,
    p = ctx.data.comparison,
    po = ctx.perOrder;
  const decimals = ctx.mode === "per-order" ? 2 : 0;
  const economicRows: [string, number | null, number | null, number | null][] =
    [
      [
        "Net product sales",
        ctx.totals.current.netSales,
        po.current.netSales,
        po.comparison.netSales,
      ],
      [
        "Revenue including shipping",
        ctx.totals.current.revenue,
        po.current.revenue,
        po.comparison.revenue,
      ],
      [
        "Average order value (AOV)",
        ctx.totals.current.aov,
        po.current.aov,
        po.comparison.aov,
      ],
      [
        "Gross profit (excludes shipping)",
        ctx.totals.current.grossProfit,
        po.current.grossProfit,
        po.comparison.grossProfit,
      ],
      [
        "Contribution before marketing",
        ctx.totals.current.cm2,
        po.current.cm2,
        po.comparison.cm2,
      ],
      [
        "Advertising",
        ctx.totals.current.advertising,
        po.current.advertising,
        po.comparison.advertising,
      ],
      ["CM3", ctx.totals.current.cm3, po.current.cm3, po.comparison.cm3],
      [
        "Overheads excluding D&A",
        ctx.totals.current.overheads,
        po.current.overheads,
        po.comparison.overheads,
      ],
      [
        "EBITDA",
        ctx.totals.current.ebitda,
        po.current.ebitda,
        po.comparison.ebitda,
      ],
    ];
  return (
    <>
      <Verdict
        eyebrow="The Profit Engine view"
        title={
          ctx.incomplete
            ? "Profit evidence needs complete product costs."
            : ctx.comparison
              ? `Sales ${percentageChange(c.netSales, p.netSales)! >= 0 ? "up" : "down"} ${percent(Math.abs(percentageChange(c.netSales, p.netSales)!))}. EBITDA ${percentageChange(c.ebitda, p.ebitda)! >= 0 ? "up" : "down"} ${percent(Math.abs(percentageChange(c.ebitda, p.ebitda)!))}.`
              : "Understand the supported profit position."
        }
        description={
          ctx.comparison && !ctx.incomplete
            ? "Profitability has weakened versus the comparison period."
            : "Comparative claims require matched, complete evidence."
        }
        action={
          <Action onClick={() => ctx.navigate("plan", "discount-review")}>
            Review discount test
          </Action>
        }
      />
      <ProfitCards {...ctx} />
      <ProfitFlow {...ctx} />
      <Disclosure
        title="Sales and profit trend"
        summary="Monthly revenue bars and EBITDA lines."
      >
        {ctx.mode === "per-order" ? (
          <Notice>
            Per-order trend unavailable: monthly original-order denominators are
            not provided in this fixture. Quarter totals and per-order tables
            remain supported.
          </Notice>
        ) : ctx.incomplete ? (
          <Notice>
            Profit trends are withheld until cost mappings are complete.
          </Notice>
        ) : (
          <ValueChart
            title="Sales and profit trend"
            subtitle="Monthly buckets · July–September 2026 · revenue including shipping and EBITDA, GBP"
            data={ctx.data.trends}
            series={[
              {
                key: "revenue",
                label: "Revenue including shipping",
                color: "#184efb",
                kind: "bar",
              },
              { key: "ebitda", label: "EBITDA", color: "#06e6d1" },
              ...(ctx.comparison
                ? [
                    {
                      key: "comparisonEbitda",
                      label: "Comparison EBITDA",
                      color: "#ba8dff",
                      comparison: true,
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Disclosure>
      <Disclosure
        title="Why profit changed"
        summary="Matched-period changes, without double counting."
      >
        {ctx.incomplete ? (
          <Notice>
            Profit change is unavailable while product costs are incomplete.
          </Notice>
        ) : !ctx.comparison ? (
          <Notice>
            Select a supported comparison to explain profit changes.
          </Notice>
        ) : (
          <WaterfallChart
            title="Why EBITDA changed"
            baseline={buildProfitBridge(ctx.mode)!.baseline}
            result={buildProfitBridge(ctx.mode)!.result}
            rows={buildProfitBridge(ctx.mode)!.rows}
            decimals={decimals}
          />
        )}
      </Disclosure>
      <Disclosure
        title="Economics per order"
        summary="Full-precision ratios, each period’s own denominator."
      >
        {ctx.incomplete ? (
          <Notice>
            Sales and AOV are supported; cost-dependent economics are withheld.
          </Notice>
        ) : null}
        <DataTable
          caption="Per original eligible order · current 9,980 orders; comparison 9,600"
          headers={[
            "Metric",
            "Current period",
            "Current / order",
            "Comparison / order",
            "Change / order",
          ]}
          rows={economicRows.map(([label, total, current, previous], i) => [
            label,
            ctx.incomplete && i > 2
              ? "Unavailable"
              : money(total, label.startsWith("Average") ? 2 : 0),
            ctx.incomplete && i > 2 ? "Unavailable" : money(current, 2),
            ctx.comparison ? money(previous, 2) : "Unavailable",
            ctx.comparison && !(ctx.incomplete && i > 2)
              ? money(difference(current, previous), 2)
              : "Unavailable",
          ])}
        />
        <DataTable
          caption="Margin definitions"
          headers={["Measure", "Current", "Comparison", "Denominator"]}
          rows={[
            [
              "Gross margin",
              ctx.incomplete ? "Unavailable" : percent(c.grossMargin),
              ctx.comparison ? percent(p.grossMargin) : "Unavailable",
              "Net product sales (shipping excluded)",
            ],
            [
              "EBITDA margin",
              ctx.incomplete ? "Unavailable" : percent(c.ebitdaMargin),
              ctx.comparison ? percent(p.ebitdaMargin) : "Unavailable",
              "Revenue including net shipping",
            ],
          ]}
        />
      </Disclosure>
      <Disclosure
        title="Overheads and break-even"
        summary="Fixed-cost coverage is separate from cash affordability."
      >
        <ValueChart
          title={
            ctx.mode === "per-order"
              ? "Monthly overhead ratio"
              : "Monthly overheads and revenue coverage"
          }
          subtitle={
            ctx.mode === "per-order"
              ? "Ratios remain supported; monthly overheads per order are unavailable without monthly original-order counts."
              : "Monthly GBP overhead totals (left axis) and overhead / revenue ratio (right axis)."
          }
          data={ctx.totals.trends}
          series={[
            ...(ctx.mode === "total"
              ? [
                  {
                    key: "overheads",
                    label: "Overheads excluding D&A",
                    color: "#7b60ff",
                    kind: "bar" as const,
                  },
                ]
              : []),
            {
              key: "overheadRatio",
              label: "Overheads / revenue",
              color: "#19dfce",
              axis: "right",
              format: (n) => percent(n, 2),
            },
            ...(ctx.comparison
              ? [
                  {
                    key: "comparisonOverheadRatio",
                    label: "Comparison overhead ratio",
                    color: "#c7b3ff",
                    comparison: true,
                    axis: "right" as const,
                    format: (n: number) => percent(n, 2),
                  },
                ]
              : []),
          ]}
        />
        <DataTable
          caption="Overheads excluding depreciation and amortisation"
          headers={["Measure", "Value"]}
          rows={[
            ["Overheads", money(c.overheads, decimals)],
            [
              "Overhead coverage / original order",
              money(c.overheadPerOrder, 2),
            ],
            [
              "Break-even orders",
              ctx.incomplete ? "Unavailable" : count(c.breakEvenOrders),
            ],
            [
              "Break-even revenue including shipping",
              ctx.incomplete ? "Unavailable" : money(c.breakEvenRevenue),
            ],
          ]}
        />
        <Notice>
          Indicative fixed-cost coverage uses the approved contribution basis.
          It does not establish cash available to spend.
        </Notice>
      </Disclosure>
      <Disclosure
        title="Staff costs"
        summary="Staff detail requires mapped evidence."
      >
        <DataTable
          caption="Staff costs · included once in overheads"
          headers={["Measure", "Value"]}
          rows={[
            [
              "Staff costs",
              money(ctx.data.staffDiagnostics.staffCosts, decimals),
            ],
            [
              "Staff costs / revenue including shipping",
              percent(ctx.data.staffDiagnostics.revenueRatio),
            ],
            [
              "CM3 per £1 staff cost",
              ctx.incomplete
                ? "Unavailable"
                : money(ctx.data.staffDiagnostics.contributionPerPoundStaff, 2),
            ],
            ["Comparison staff breakdown", "Unavailable"],
          ]}
        />
        <Notice>
          Staff is deducted once within overheads; this is fixed-cost coverage,
          not a cash affordability test.
        </Notice>
      </Disclosure>
    </>
  );
}
export function CashPage(ctx: PageContext & { tab?: string }) {
  const c = ctx.data.cash;
  useEffect(() => {
    ctx.registerEvidence?.(
      <DataTable
        caption="Historical cash evidence · not a forecast"
        headers={["Evidence field", "Value"]}
        rows={[
          ["Snapshot", "SAMPLE-Q3-26 · GBP · 1 Jul–30 Sep 2026"],
          ["Opening bank", money(c.openingBank)],
          ["Closing bank", `${money(c.closingBank)} as at 30 Sep 2026`],
          [
            "EBITDA",
            ctx.incomplete
              ? "Unavailable: incomplete product costs"
              : money(c.ebitda),
          ],
          [
            "Operating cash",
            `${money(c.operatingCash)} before tax and interest`,
          ],
          ["Bank movement", money(c.bankMovement)],
          [
            "Operating adjustments",
            c.operatingAdjustments
              .map((a) => `${a.label}: ${money(a.value)}`)
              .join("; "),
          ],
          [
            "Other bank movements",
            c.bankAdjustments
              .map((a) => `${a.label}: ${money(a.value)}`)
              .join("; "),
          ],
          [
            "Bank coverage",
            "Simplified fictional bank coverage; no live bank-feed timestamp or account verification",
          ],
          [
            "Exclusions",
            "Internal transfers and duplicate payouts; no unrestricted-cash assumption for receivables or reserves",
          ],
          [
            "Stock records",
            "Product ageing, sell-through and lead-time records unavailable in the fixture",
          ],
          [
            "Spending capacity",
            "Unavailable: dated commitments and business guardrails are unconfirmed",
          ],
        ]}
      />,
    );
  }, [ctx.incomplete, ctx.registerEvidence]);
  return (
    <>
      <Verdict
        eyebrow="The Cash Control view"
        title={`Stock absorbed ${money(c.inventoryIncrease)} of operating cash. Other outflows reduced bank cash.`}
        description="Investigate the movement before changing purchases. Stock growth is not an instantly recoverable saving."
        action={
          <Action
            onClick={() => {
              const target = document.getElementById("v11-stock");
              if (target instanceof HTMLDetailsElement) target.open = true;
              target?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Review stock movements
          </Action>
        }
      />
      <div className="v11-card-grid">
        <MetricCard
          title="Bank cash"
          value={money(c.closingBank)}
          detail="As at 30 Sep 2026"
          comparison={`${money(c.bankMovement)} since 1 Jul`}
        />
        <MetricCard
          title="Operating cash before tax and interest"
          value={money(c.operatingCash)}
          detail="July–September 2026"
          comparison={
            ctx.comparison ? "vs £50,000 comparison period" : undefined
          }
        />
        <MetricCard
          title="Inventory increase"
          value={money(c.inventoryIncrease)}
          detail={`Since 1 Jul · closing inventory ${money(c.closingStock)}`}
        />
      </div>
      <Panel title="From profit to bank cash">
        <CashBridge {...ctx} />
      </Panel>
      <Disclosure
        id="v11-stock"
        defaultOpen={ctx.tab === "stock"}
        title="Stock and supplier payments"
        summary="Inspect purchases, book stock and supplier credit separately."
      >
        <div className="v11-two-columns">
          <Panel title="Stock activity in the selected quarter">
            <ValueChart
              title="Stock purchased, recognised and paid"
              subtitle="Different measures: purchases, COGS and supplier cash payments are not interchangeable."
              data={[
                { label: "Purchases", value: c.purchases },
                { label: "COGS", value: ctx.incomplete ? null : c.cogs },
                { label: "Supplier cash paid", value: c.supplierPayments },
              ]}
              series={[
                { key: "value", label: "GBP", color: "#146cff", kind: "bar" },
              ]}
            />
          </Panel>
          <Panel title="Inventory roll-forward">
            {ctx.incomplete ? (
              <Notice tone="warning">
                The inventory roll-forward cannot be reconciled while product
                costs are incomplete. Dated book balances and separately
                supported purchases/payments are retained; missing COGS is not
                zero.
              </Notice>
            ) : (
              <WaterfallChart
                title="Opening to closing inventory"
                baselineLabel="Opening inventory"
                resultLabel="Closing inventory"
                baseline={c.openingStock}
                result={c.closingStock}
                rows={[
                  { label: "Purchases", value: c.purchases },
                  { label: "Cost of goods sold", value: -c.cogs },
                ]}
              />
            )}
          </Panel>
        </div>
        <DataTable
          caption="Inventory and supplier reconciliation · selected quarter"
          headers={["Measure", "GBP"]}
          rows={[
            ["Opening stock", money(c.openingStock)],
            ["Stock purchases", money(c.purchases)],
            [
              "Cost of goods sold",
              ctx.incomplete ? "Unavailable" : money(c.cogs),
            ],
            ["Closing stock", money(c.closingStock)],
            ["Supplier cash paid", money(c.supplierPayments)],
            ["Increase in supplier credit", "£12,000"],
          ]}
        />
        <Notice tone="warning">
          Ageing, sell-through, lead times and affected product records are not
          supplied by this fixture. A stock increase alone does not show
          excessive stock or a safe reorder change.
        </Notice>
        <button className="v11-link" onClick={ctx.explore}>
          Inspect stock evidence and limitations →
        </button>
      </Disclosure>
      <Disclosure
        id="v11-settlements"
        defaultOpen={ctx.tab === "settlements"}
        title="Collections and settlements"
        summary="Pending money, reserves, failed payouts and debtors are distinct."
      >
        <div className="v11-two-columns">
          <DataTable
            caption="Provider balances · not unrestricted bank cash"
            headers={["Category", "GBP"]}
            rows={Object.entries(c.providerBalances).map(([key, value]) => [
              key,
              money(value),
            ])}
          />
          <DataTable
            caption="Debtors · non-overlapping age buckets"
            headers={["Category", "GBP"]}
            rows={Object.entries(c.debtors).map(([key, value]) => [
              key === "overdue1to30"
                ? "Overdue 1–30 days"
                : key === "overdue31plus"
                  ? "Overdue 31+ days"
                  : "Current",
              money(value),
            ])}
          />
        </div>
        <Notice>
          Source payout and invoice drilldowns are unavailable in this fictional
          fixture. No payment, retry or collection action is executed.
        </Notice>
      </Disclosure>
      <Disclosure
        title="Cash conversion over time"
        summary="Period flows and dated bank balances remain separate."
      >
        <ValueChart
          title="Monthly profit and operating cash"
          subtitle="GBP flows · monthly buckets · no future extrapolation"
          data={ctx.totals.trends}
          series={[
            ...(!ctx.incomplete
              ? [
                  {
                    key: "ebitda",
                    label: "EBITDA",
                    color: "#5c7aff",
                    kind: "bar" as const,
                  },
                ]
              : []),
            { key: "operatingCash", label: "Operating cash", color: "#1adfc7" },
            ...(ctx.comparison
              ? [
                  {
                    key: "comparisonOperatingCash",
                    label: "Comparison operating cash",
                    color: "#d7a4ff",
                    comparison: true,
                  },
                ]
              : []),
          ]}
        />
        <ValueChart
          title="Closing bank balances"
          subtitle="GBP balances at month end; these are not period flows"
          data={ctx.totals.trends}
          series={[
            { key: "bankCash", label: "Bank balance", color: "#30cbff" },
          ]}
        />
      </Disclosure>
      <Disclosure
        title="Operating cash reconciliation"
        summary="EBITDA to operating cash before tax and interest."
      >
        <>
          {ctx.incomplete ? (
            <Notice tone="warning">
              The profit-to-operating-cash reconciliation is unavailable while
              cost coverage is incomplete. Supported operating cash remains
              separately dated.
            </Notice>
          ) : (
            <WaterfallChart
              title="EBITDA to operating cash"
              baselineLabel="EBITDA"
              resultLabel="Operating cash"
              baseline={c.ebitda}
              result={c.operatingCash}
              rows={c.operatingAdjustments}
            />
          )}
        </>
      </Disclosure>
      <Disclosure
        title="Other movements in bank cash"
        summary="Tax, investing and financing flows."
      >
        <WaterfallChart
          title="Operating cash to bank movement"
          baselineLabel="Operating cash"
          resultLabel="Bank movement"
          baseline={c.operatingCash}
          result={c.bankMovement}
          rows={c.bankAdjustments}
        />
        <DataTable
          caption="Bank balance roll-forward"
          headers={["Balance", "GBP"]}
          rows={[
            ["Opening bank", money(c.openingBank)],
            ["Bank movement", money(c.bankMovement)],
            ["Closing bank", money(c.closingBank)],
          ]}
        />
        <Notice>
          No forecast is implied. A 13-week cash forecast requires dated
          commitments, settlement schedules, tax and debt due dates, and
          verified bank coverage.
        </Notice>
      </Disclosure>
    </>
  );
}
export function GrowthPage(
  ctx: PageContext & { tab: string; setTab: (tab: string) => void },
) {
  const active = ["investment", "customers", "channels"].includes(ctx.tab)
    ? ctx.tab
    : "investment";
  const m = ctx.data.marketing;
  const [review, setReview] = useState(false),
    [channel, setChannel] = useState("meta"),
    [measure, setMeasure] = useState("roas");
  const selected = m.channels.find((c) => c.id === channel);
  const formatRatio = (n: number) => `${n.toFixed(2)}x`;
  const ratioText = (n: number | null) =>
    n == null ? "Unavailable" : formatRatio(n);
  useEffect(() => {
    ctx.registerEvidence?.(
      <DataTable
        caption={`Growth evidence · ${active === "channels" ? "selected channel and metric" : active === "customers" ? "current acquisition and separate mature cohort" : "investment readiness"}`}
        headers={["Evidence field", "Value"]}
        rows={[
          [
            "Scope",
            "Jul–Sep 2026 current acquisition; Apr–Jun 2026 mature cohort separately observed through 30 Sep",
          ],
          [
            "Readiness",
            "Fictional fixture only; cash commitments and guardrails unconfirmed",
          ],
          [
            "Selected channel",
            channel === "all"
              ? "All paid channels"
              : selected?.name || "Unavailable",
          ],
          [
            "Selected metric",
            measure === "roas" ? "Platform-reported ROAS" : "New-customer CAC",
          ],
          [
            "Spend numerator / denominator",
            measure === "roas"
              ? `Attributed revenue / eligible spend; ${channel === "all" ? "combined attributed revenue unavailable due to overlap" : `${money(selected?.attributedRevenue)} / ${money(selected?.spend)}`}`
              : `Eligible spend / hypothetical mutually exclusive new customers; ${money(channel === "all" ? m.acquisitionSpend : selected?.spend)} / ${count(channel === "all" ? m.newCustomers : selected?.newCustomers)}`,
          ],
          [
            "Selected result",
            measure === "roas"
              ? channel === "all"
                ? "Unavailable"
                : selected?.roas == null
                  ? "Unavailable"
                  : formatRatio(selected.roas)
              : money(channel === "all" ? m.cac : selected?.cac, 2),
          ],
          [
            "Comparison",
            ctx.comparison
              ? channel === "meta" && measure === "roas"
                ? ratioText(
                    safeRatio(
                      selected?.comparisonRevenue ?? null,
                      selected?.comparisonSpend ?? null,
                    ),
                  )
                : "Matched comparison unavailable for this selected channel / metric"
              : "None / unavailable; comparative lines and claims withheld",
          ],
          [
            "Channel contribution",
            "Unavailable: store-wide contribution is not a channel benchmark",
          ],
          [
            "Cost coverage",
            ctx.incomplete
              ? "Current contribution incomplete; cost-dependent advice withheld"
              : "Complete only within the fictional fixture",
          ],
          [
            "Mature payback",
            `${m.paybackDays} days; not a forecast for current-quarter customers`,
          ],
          [
            "Attribution",
            "Platform attribution is not incrementality; do not add overlapping platform revenue",
          ],
          [
            "Rounding",
            "Sum matched numerators and denominators before ratios; round only for display",
          ],
        ]}
      />,
    );
  }, [
    channel,
    measure,
    active,
    ctx.comparison,
    ctx.incomplete,
    ctx.registerEvidence,
  ]);
  const channelTrend =
    channel === "meta" && measure === "roas"
      ? m.monthly.map((row) => ({
          label: row.label,
          spend: row.metaSpend,
          metric: row.metaRoas,
          comparison: row.comparisonMetaRoas,
        }))
      : channel === "all" && measure === "cac"
        ? m.monthly.map((row) => ({
            label: row.label,
            spend: row.spend,
            metric: row.cac,
            comparison: row.comparisonCac,
          }))
        : [];
  return (
    <>
      <Tabs
        label="Growth & Marketing views"
        tabs={[
          { id: "investment", label: "Investment Scorecard" },
          { id: "customers", label: "Customer Economics" },
          { id: "channels", label: "Channels" },
        ]}
        active={active}
        onChange={ctx.setTab}
      />
      {active === "investment" && (
        <>
          <Verdict
            eyebrow="The investment question"
            title="Can we afford to increase marketing investment?"
            description="Needs evidence · cash commitments and business guardrails are unconfirmed."
            action={
              <Action onClick={() => setReview(true)}>
                Review cash and guardrails
              </Action>
            }
          />
          <div className="v11-card-grid">
            <MetricCard
              title="CM3 per original order"
              value={
                ctx.incomplete
                  ? "Unavailable"
                  : money(ctx.perOrder.current.cm3, 2)
              }
              detail="Contribution after advertising · selected quarter"
            />
            <MetricCard
              title="New customer CAC"
              value={money(m.cac, 2)}
              detail="£90,000 eligible spend / 2,700 first-time customers · Jul–Sep"
            />
            <MetricCard
              title="90-day GP:CAC"
              value={`${m.cohort.gpToCac.toFixed(2)}x`}
              detail="Mature Apr–Jun cohort · observed through 30 Sep 2026"
            />
          </div>
          <Notice tone="warning">
            <strong>
              {ctx.incomplete ? "Unavailable:" : money(m.acquisitionGap)}{" "}
              first-order contribution gap for {count(m.newCustomers)} new
              customers.
            </strong>
            <br />
            Observed mature-cohort payback is {m.paybackDays} days. This is not
            the current-quarter funding duration.
          </Notice>
          {review && (
            <Panel title="Review cash and guardrails">
              <p>
                This is a read-only investigation checklist, not a saved action.
              </p>
              <ul className="v11-review-checklist">
                <li>
                  Confirm dated supplier, tax, payroll and debt commitments.
                </li>
                <li>
                  Agree reserve preference and acceptable payback with the owner
                  or adviser.
                </li>
                <li>
                  Assign a responsible reviewer and record the outcome in your
                  existing process.
                </li>
                <li>
                  Confirm channel-matched contribution and cash capacity before
                  proposing a bounded test.
                </li>
              </ul>
              <Action
                secondary
                onClick={() => ctx.navigate("settings", "guardrails")}
              >
                Review business guardrails
              </Action>
            </Panel>
          )}
          <Disclosure
            title="Investment scorecard"
            summary="Five distinct measures with their own scope."
          >
            <DataTable
              caption="Quarterly acquisition and separate mature cohort"
              headers={["Measure", "Value", "Scope"]}
              rows={[
                [
                  "CM3 / order",
                  ctx.incomplete
                    ? "Unavailable"
                    : money(ctx.perOrder.current.cm3, 2),
                  "Jul–Sep original eligible orders",
                ],
                [
                  "New customer CAC",
                  money(m.cac, 2),
                  "Jul–Sep matched eligible acquisition",
                ],
                [
                  "GP:CAC",
                  `${m.cohort.gpToCac.toFixed(2)}x`,
                  "Apr–Jun mature cohort, 90-day gross profit",
                ],
                [
                  "Observed payback",
                  `${m.paybackDays} days`,
                  "Apr–Jun cohort observed through 30 Sep",
                ],
                [
                  "New / returning product revenue",
                  `${percent(m.newRevenueShare, 0)} / ${percent(m.returningRevenueShare, 0)}`,
                  "Jul–Sep net product revenue",
                ],
              ]}
            />
          </Disclosure>
          <Disclosure
            title="Contribution and acquisition funding"
            summary="Overhead coverage and the first-order gap."
          >
            {ctx.incomplete ? (
              <Notice tone="warning">
                Contribution and acquisition bridges are unavailable until
                product costs are complete.
              </Notice>
            ) : (
              <div className="v11-two-columns">
                <Panel title="Contribution coverage above fixed costs">
                  <HorizontalBars
                    title="CM3 and overhead coverage per order"
                    items={[
                      {
                        label: "CM3 per order",
                        value: ctx.perOrder.current.cm3,
                        color: "#15d9ed",
                      },
                      {
                        label: "Overheads per order",
                        value: ctx.totals.current.overheadPerOrder,
                        color: "#9f8cff",
                      },
                    ]}
                  />
                  <p className="v11-muted">
                    The remaining EBITDA per order is{" "}
                    {money(ctx.perOrder.current.ebitda, 2)}. Fixed-cost coverage
                    is not cash break-even.
                  </p>
                </Panel>
                <Panel title="First-order acquisition economics">
                  <WaterfallChart
                    title="First-order contribution after acquisition"
                    baselineLabel="First-order contribution"
                    resultLabel="After acquisition"
                    baseline={m.firstOrderContribution}
                    result={m.firstOrderAfterCac}
                    rows={[
                      { label: "Matched new-customer CAC", value: -m.cac },
                    ]}
                    decimals={2}
                  />
                  <Notice>
                    Quarterly initial contribution gap {money(m.acquisitionGap)}{" "}
                    across {count(m.newCustomers)} acquired customers. No
                    cash-funding duration is inferred.
                  </Notice>
                </Panel>
              </div>
            )}
            <DataTable
              caption="Selected quarter · GBP"
              headers={["Measure", "Value"]}
              rows={[
                [
                  "EBITDA",
                  ctx.incomplete
                    ? "Unavailable"
                    : money(ctx.totals.current.ebitda),
                ],
                [
                  "Comparison EBITDA",
                  ctx.comparison
                    ? money(ctx.totals.comparison.ebitda)
                    : "Unavailable",
                ],
                [
                  "CM3 / original order",
                  ctx.incomplete
                    ? "Unavailable"
                    : money(ctx.perOrder.current.cm3, 2),
                ],
                [
                  "Overhead coverage / original order",
                  money(ctx.totals.current.overheadPerOrder, 2),
                ],
                [
                  "First-order contribution / acquired customer",
                  ctx.incomplete
                    ? "Unavailable"
                    : money(m.firstOrderContribution, 2),
                ],
                [
                  "Initial contribution gap",
                  ctx.incomplete ? "Unavailable" : money(m.acquisitionGap),
                ],
              ]}
            />
            <Notice>
              The initial contribution gap is not maximum cash funding and is
              not assumed to remain outstanding for 55 days.
            </Notice>
          </Disclosure>
          <Disclosure
            title="Acquisition trend and break-even CAC"
            summary="Indicative first-order CAC including allocated overheads."
          >
            <ValueChart
              title="New customer acquisition cost"
              subtitle="Monthly eligible spend / matched first-time customers · GBP per customer"
              data={m.monthly}
              series={[
                { key: "cac", label: "Current CAC", color: "#1ce5e2" },
                ...(ctx.comparison
                  ? [
                      {
                        key: "comparisonCac",
                        label: "Comparison CAC",
                        color: "#c19aff",
                        comparison: true,
                      },
                    ]
                  : []),
              ]}
            />
            <Notice>
              First-order break-even CAC including allocated overheads:{" "}
              <strong>
                {ctx.incomplete
                  ? "Unavailable"
                  : money(m.breakEvenFirstOrderCac, 2)}
              </strong>
              . This is indicative, assumes one first order per acquired
              customer, and is not a universal maximum or cash break-even.
            </Notice>
          </Disclosure>
          <Disclosure
            title="Mature cohorts and evidence"
            summary="Apr–Jun 2026 is separate from the current quarter."
          >
            <CohortEvidence ctx={ctx} />
          </Disclosure>
        </>
      )}
      {active === "customers" && (
        <>
          <Verdict
            eyebrow="The Customer Economics view"
            title="First orders leave a gap. Mature cohorts recover acquisition cost."
            description="Current-quarter acquisition and observed mature-cohort payback have different scopes."
            action={
              <Action onClick={() => ctx.setTab("investment")}>
                Review first-order acquisition
              </Action>
            }
          />
          <div className="v11-card-grid">
            <MetricCard
              title="First-order contribution · current quarter"
              value={
                ctx.incomplete
                  ? "Unavailable"
                  : money(m.firstOrderContribution, 2)
              }
              detail="Before acquisition cost · Jul–Sep new customers"
            />
            <MetricCard
              title="Customer acquisition cost · current quarter"
              value={money(m.cac, 2)}
              detail="Eligible spend / first-time customers · Jul–Sep"
            />
            <MetricCard
              title="Observed mature-cohort payback"
              value={`${m.paybackDays} days`}
              detail="Apr–Jun cohort · observed through 30 Sep 2026"
            />
          </div>
          <Panel
            title="Cumulative contribution before acquisition per customer"
            subtitle="Apr–Jun mature cohort · actual fictional observations through 30 Sep; not a forecast"
          >
            <ValueChart
              title="Mature cohort payback curve"
              data={m.cohort.curve.map((row) => ({
                label: `Day ${row.day}`,
                contribution: row.value,
                cac: m.cohort.cac,
              }))}
              series={[
                {
                  key: "contribution",
                  label: "Cumulative contribution",
                  color: "#14e0ed",
                  format: (n) => money(n, 2),
                },
                {
                  key: "cac",
                  label: "Matched cohort CAC",
                  color: "#cfdaef",
                  comparison: true,
                  format: (n) => money(n, 2),
                },
              ]}
            />
          </Panel>
          <Disclosure
            title="Revenue composition"
            summary="Current-quarter net product revenue from new and returning customers."
          >
            <RevenueComposition
              currentNew={m.newRevenueShare}
              currentReturning={m.returningRevenueShare}
            />
            <DataTable
              caption="July–September 2026 · no invented monthly allocation"
              headers={["Customer group", "Share"]}
              rows={[
                ["New customers", percent(m.newRevenueShare, 0)],
                ["Returning customers", percent(m.returningRevenueShare, 0)],
              ]}
            />
            <Notice>
              Refunds and unknown identity require explicit allocation in real
              reporting.
            </Notice>
          </Disclosure>
          <Disclosure
            title="Mature cohorts"
            summary="Matched cohort contribution and gross profit remain distinct."
          >
            <CohortEvidence ctx={ctx} />
          </Disclosure>
          <Disclosure
            title="Retention detail"
            summary="Unavailable without matched customer records."
          >
            <Notice>
              Repeat-purchase and retention intervention evidence is
              unavailable. No retention recommendation follows from this
              example.
            </Notice>
          </Disclosure>
        </>
      )}
      {active === "channels" && (
        <>
          <Verdict
            eyebrow="The Channels view"
            title={`Review ${channel === "all" ? "paid-channel" : selected?.name} acquisition economics before changing spend.`}
            description="Platform attribution is not incrementality. Channel-matched contribution is unavailable."
            action={
              <Action onClick={ctx.explore}>
                Review {channel === "all" ? "channel" : selected?.name} evidence
              </Action>
            }
          />
          <div className="v11-card-grid">
            <MetricCard
              title={
                channel === "all"
                  ? "Eligible acquisition spend"
                  : `${selected?.name} spend`
              }
              value={money(
                channel === "all" ? m.acquisitionSpend : selected?.spend,
              )}
              detail="Selected quarter · GBP"
            />
            <MetricCard
              title={
                measure === "cac"
                  ? "New customer CAC"
                  : "Platform-reported ROAS"
              }
              value={
                measure === "cac"
                  ? money(channel === "all" ? m.cac : selected?.cac, 2)
                  : channel === "all"
                    ? "Unavailable"
                    : selected?.roas == null
                      ? "Unavailable"
                      : formatRatio(selected.roas)
              }
              detail={
                measure === "cac"
                  ? "Hypothetical mutually exclusive customer allocation"
                  : "Combined ROAS is unavailable until overlap is resolved"
              }
            />
            <MetricCard
              title="First-time customers"
              value={count(
                channel === "all" ? m.newCustomers : selected?.newCustomers,
              )}
              detail="Illustrative allocation · not causal evidence"
            />
          </div>
          <Notice>
            Channel evidence is illustrative; causal incrementality is unproven.
            Platform revenue can overlap and is not added to business revenue.
            Store-wide contribution is not a channel benchmark.
          </Notice>
          <Panel title="Channel performance over time">
            <div className="v11-control-row">
              <label>
                Channel
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value="all">All paid channels</option>
                  <option value="meta">Meta</option>
                  <option value="google">Google</option>
                </select>
              </label>
              <label>
                Measure
                <select
                  value={measure}
                  onChange={(e) => setMeasure(e.target.value)}
                >
                  <option value="roas">ROAS</option>
                  <option value="cac">New-customer CAC</option>
                </select>
              </label>
            </div>
            {channelTrend.length ? (
              <ValueChart
                title={`${channel === "meta" ? "Meta" : "All paid channels"} spend and ${measure === "roas" ? "ROAS" : "new-customer CAC"}`}
                subtitle="July–September 2026 · monthly buckets; spend left axis GBP, selected metric right axis"
                data={channelTrend}
                series={[
                  {
                    key: "spend",
                    label: "Spend (GBP)",
                    color: "#12d8e6",
                    kind: "bar",
                  },
                  {
                    key: "metric",
                    label: measure === "roas" ? "ROAS" : "CAC",
                    color: "#50f5ff",
                    axis: "right",
                    format:
                      measure === "roas" ? formatRatio : (n) => money(n, 2),
                  },
                  ...(ctx.comparison
                    ? [
                        {
                          key: "comparison",
                          label:
                            measure === "roas"
                              ? "Comparison ROAS"
                              : "Comparison CAC",
                          color: "#d098ff",
                          comparison: true,
                          axis: "right" as const,
                          format:
                            measure === "roas"
                              ? formatRatio
                              : (n: number) => money(n, 2),
                        },
                      ]
                    : []),
                ]}
              />
            ) : (
              <Notice>
                {channel === "all" && measure === "roas"
                  ? "Combined ROAS is unavailable because attribution overlap is unresolved."
                  : "A matched monthly series is unavailable for this channel and measure. Supported quarterly values remain above; no monthly values are fabricated."}
              </Notice>
            )}
          </Panel>
          <Disclosure
            title="Channel comparison"
            summary="Compare attributed ratios without inferring causal contribution."
          >
            <DataTable
              caption="Quarterly channel evidence · hypothetical customer allocation"
              headers={[
                "Channel",
                "Spend",
                "Attributed revenue",
                "ROAS",
                "New customers",
                "CAC",
              ]}
              rows={m.channels.map((c) => [
                c.name,
                money(c.spend),
                money(c.attributedRevenue),
                c.roas == null ? "Unavailable" : formatRatio(c.roas),
                count(c.newCustomers),
                money(c.cac, 2),
              ])}
            />
          </Disclosure>
          <Disclosure
            title="Spend reconciliation"
            summary="Selected acquisition spend and unresolved ledger scope."
          >
            <DataTable
              caption="July–September 2026 advertising reconciliation"
              headers={["Scope", "GBP"]}
              rows={[
                ["Selected eligible platform spend", money(m.acquisitionSpend)],
                [
                  "Unallocated / outside selected scope",
                  money(m.unallocatedAdvertising),
                ],
                ["Ledger advertising", money(m.ledgerAdvertising)],
              ]}
            />
            <Notice>
              The unresolved amount needs mapping, not an invented explanation.
              Agency fees and tools are overheads under the agreed definition.
            </Notice>
          </Disclosure>
          <Disclosure
            title="Bounded test setup"
            summary="Review assumptions before any budget change."
          >
            <ul className="v11-review-checklist">
              <li>
                Establish channel-matched contribution and attribution coverage.
              </li>
              <li>
                Confirm a budget, horizon, owner, review date and stop rules.
              </li>
              <li>Validate cash commitments and business guardrails.</li>
            </ul>
            <Action
              secondary
              onClick={() => ctx.navigate("plan", "acquisition-review")}
            >
              Review acquisition assumptions
            </Action>
            <p className="v11-muted">
              No automatic ad reallocation, saved test or provider write is
              available.
            </p>
          </Disclosure>
        </>
      )}
    </>
  );
}
function CohortEvidence({ ctx }: { ctx: PageContext }) {
  const c = ctx.data.marketing.cohort;
  return (
    <>
      {c.curve[0] && (
        <WaterfallChart
          title="First order to mature contribution after acquisition"
          baselineLabel="First-order contribution"
          resultLabel="After acquisition"
          baseline={c.curve[0].value}
          result={c.contributionAfterCac}
          rows={[
            {
              label: "Additional observed contribution",
              value: c.additionalContributionAfterFirstOrder,
            },
            { label: "Matched cohort CAC", value: -c.cac },
          ]}
          decimals={2}
        />
      )}
      <DataTable
        caption="Separate mature Apr–Jun cohort · observed through 30 Sep 2026"
        headers={["Measure", "Value"]}
        rows={[
          ["Matched customers", count(c.customers)],
          ["Matched acquisition CAC", money(c.cac, 2)],
          [
            "90-day gross profit / customer",
            money(c.grossProfitPerCustomer, 2),
          ],
          [
            "90-day contribution before acquisition / customer",
            money(c.contributionPerCustomer, 2),
          ],
          [
            "Contribution after CAC, before overheads",
            money(c.contributionAfterCac, 2),
          ],
          ["90-day GP:CAC", `${c.gpToCac.toFixed(2)}x`],
          ["Jul–Sep 90-day outcome", "Immature / unavailable"],
        ]}
      />
      <p className="v11-muted">
        {c.repeatMarketingTreatment} Gross profit is not contribution. Observed
        payback is not a forecast for current customers.
      </p>
    </>
  );
}
