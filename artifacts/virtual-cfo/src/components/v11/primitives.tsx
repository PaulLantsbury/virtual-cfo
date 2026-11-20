import { useId, type ReactNode } from "react";
import { ArrowRight, ChevronDown, Info } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export const money = (value: number | null | undefined, decimals = 0) =>
  value == null || !Number.isFinite(value)
    ? "Unavailable"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
export const count = (value: number | null | undefined) =>
  value == null
    ? "Unavailable"
    : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(
        value,
      );
export const percent = (value: number | null | undefined, digits = 1) =>
  value == null ? "Unavailable" : `${(value * 100).toFixed(digits)}%`;
export function Action({
  children,
  onClick,
  secondary = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      className={`v11-action ${secondary ? "secondary" : ""}`}
      onClick={onClick}
    >
      {children}
      <ArrowRight size={18} aria-hidden="true" />
    </button>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "danger" | "success";
}) {
  return (
    <div className={`v11-notice ${tone}`}>
      <Info size={20} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function Verdict({
  eyebrow,
  title,
  description,
  action,
  tone = "",
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: string;
}) {
  return (
    <section className={`v11-verdict ${tone}`} aria-label={eyebrow}>
      <div>
        <p className="v11-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && (
          <div className="v11-verdict-description">{description}</div>
        )}
      </div>
      {action && <div className="v11-verdict-action">{action}</div>}
    </section>
  );
}
export function MetricCard({
  title,
  value,
  detail,
  comparison,
  tone,
}: {
  title: string;
  value: ReactNode;
  detail?: ReactNode;
  comparison?: ReactNode;
  tone?: string;
}) {
  return (
    <article className="v11-metric">
      <h3>{title}</h3>
      <strong>{value}</strong>
      {detail && <p>{detail}</p>}
      {comparison && <p className={`v11-delta ${tone || ""}`}>{comparison}</p>}
    </article>
  );
}
export function Disclosure({
  title,
  summary,
  children,
  defaultOpen = false,
  id,
}: {
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  return (
    <details className="v11-disclosure" open={defaultOpen || undefined} id={id}>
      <summary>
        <span className="v11-disclosure-heading">{title}</span>
        {summary && <span className="v11-disclosure-summary">{summary}</span>}
        <ChevronDown size={20} aria-hidden="true" />
      </summary>
      <div className="v11-disclosure-content">{children}</div>
    </details>
  );
}
export function DataTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="v11-table-scroll">
      <table className="v11-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {v}
                  </th>
                ) : (
                  <td key={j}>{v}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Tabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <nav className="v11-tabs" aria-label={label}>
      {tabs.map((t) => (
        <button
          type="button"
          key={t.id}
          aria-current={t.id === active ? "page" : undefined}
          className={t.id === active ? "active" : ""}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
export function Panel({
  title,
  children,
  subtitle,
}: {
  title: string;
  children: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <section className="v11-panel">
      <h3>{title}</h3>
      {subtitle && <p className="v11-muted">{subtitle}</p>}
      {children}
    </section>
  );
}

export function RevenueSankey({
  revenue,
  flows,
  mode,
}: {
  revenue: number | null;
  flows: { label: string; value: number | null }[];
  mode: "total" | "per-order";
}) {
  const id = useId().replace(/:/g, "");
  if (
    revenue == null ||
    !Number.isFinite(revenue) ||
    revenue <= 0 ||
    flows.some(
      (f) => f.value == null || !Number.isFinite(f.value) || f.value < 0,
    )
  )
    return (
      <>
        <Notice>
          Revenue flow geometry is unavailable for missing, signed or
          non-positive amounts. Supported values remain in the table; unknown
          values are not treated as zero.
        </Notice>
        <DataTable
          caption={`Revenue flow evidence · ${mode === "per-order" ? "GBP per original eligible order" : "GBP totals"}`}
          headers={["Flow", "Amount"]}
          rows={[
            [
              "Revenue including shipping",
              money(revenue, mode === "per-order" ? 2 : 0),
            ],
            ...flows.map((f) => [
              f.label,
              money(f.value, mode === "per-order" ? 2 : 0),
            ]),
          ]}
        />
      </>
    );
  const scale = 220 / revenue;
  let cursor = 48;
  let outputCursor = 20;
  return (
    <div className="v11-sankey">
      <svg
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
        viewBox="0 0 1000 340"
      >
        <title id={`${id}-title`}>
          Revenue including shipping into costs and EBITDA
        </title>
        <desc id={`${id}-desc`}>
          Ribbon widths represent amounts. The values table below provides all
          figures in{" "}
          {mode === "total"
            ? "total pounds"
            : "pounds per original eligible order"}
          .
        </desc>
        <defs>
          <linearGradient id={`${id}-blue`}>
            <stop stopColor="#004cff" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <rect x="10" y="48" width="175" height="220" rx="9" fill="#163de5" />
        <text
          x="97"
          y="140"
          textAnchor="middle"
          fill="white"
          fontSize="26"
          fontWeight="700"
        >
          {money(revenue, mode === "per-order" ? 2 : 0)}
        </text>
        <text x="97" y="170" textAnchor="middle" fill="white" fontSize="13">
          REVENUE INCLUDING
        </text>
        <text x="97" y="190" textAnchor="middle" fill="white" fontSize="13">
          SHIPPING
        </text>
        {flows.map((f, i) => {
          const height = (f.value || 0) * scale;
          const start = cursor;
          cursor += height;
          const end = outputCursor;
          outputCursor += height + 17;
          return (
            <g key={f.label}>
              <path
                d={`M185 ${start} C390 ${start}, 475 ${end}, 650 ${end} L650 ${end + height} C475 ${end + height},390 ${start + height},185 ${start + height} Z`}
                fill={i === flows.length - 1 ? "#00cfa1" : `url(#${id}-blue)`}
                opacity=".95"
              />
              <rect
                x="650"
                y={end}
                width="18"
                height={height}
                rx="3"
                fill={i === flows.length - 1 ? "#5affce" : "#e7b8ff"}
              />
              <text
                x="690"
                y={end + 17}
                fill="white"
                fontSize="17"
                fontWeight="700"
              >
                {money(f.value, mode === "per-order" ? 2 : 0)}
              </text>
              <text x="690" y={end + 37} fill="#b9cee8" fontSize="14">
                {f.label}
              </text>
            </g>
          );
        })}
      </svg>
      <Disclosure title="View revenue flow values">
        <DataTable
          caption={`Revenue reconciliation · ${mode === "per-order" ? "per original eligible order" : "total GBP"}`}
          headers={["Flow", "Amount"]}
          rows={[
            [
              "Revenue including shipping",
              money(revenue, mode === "per-order" ? 2 : 0),
            ],
            ...flows.map((f) => [
              f.label,
              money(f.value, mode === "per-order" ? 2 : 0),
            ]),
          ]}
        />
      </Disclosure>
    </div>
  );
}
export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  kind?: "bar" | "line";
  comparison?: boolean;
  axis?: "left" | "right";
  format?: (n: number) => string;
};
export function ValueChart({
  title,
  data,
  series,
  subtitle,
}: {
  title: string;
  data: Record<string, string | number | null>[];
  series: ChartSeries[];
  subtitle?: string;
}) {
  return (
    <div className="v11-chart" role="group" aria-label={title}>
      <h4>{title}</h4>
      {subtitle && <p className="v11-muted">{subtitle}</p>}
      <div className="v11-chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 18, left: 8, right: 15, bottom: 8 }}
          >
            <CartesianGrid stroke="#163c5a" vertical={false} />
            <XAxis dataKey="label" stroke="#a9c5e7" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="left"
              stroke="#a9c5e7"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => count(v)}
            />
            {series.some((s) => s.axis === "right") && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#a9c5e7"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const formatter = series.find(
                    (item) => item.axis === "right",
                  )?.format;
                  return formatter
                    ? formatter(Number(value))
                    : count(Number(value));
                }}
              />
            )}
            <Tooltip
              contentStyle={{
                background: "#06233c",
                border: "1px solid #17669d",
                color: "#fff",
              }}
              formatter={(value, name) => {
                const s = series.find((s) => s.label === name);
                return [
                  s?.format ? s.format(Number(value)) : money(Number(value)),
                  name,
                ];
              }}
            />
            <Legend />
            {series.map((s) =>
              s.kind === "bar" ? (
                <Bar
                  key={s.key}
                  name={s.label}
                  dataKey={s.key}
                  yAxisId={s.axis || "left"}
                  fill={s.color}
                  maxBarSize={64}
                />
              ) : (
                <Line
                  key={s.key}
                  name={s.label}
                  dataKey={s.key}
                  yAxisId={s.axis || "left"}
                  stroke={s.color}
                  strokeWidth={3}
                  strokeDasharray={s.comparison ? "6 5" : undefined}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Disclosure title={`View ${title.toLowerCase()} values`}>
        <DataTable
          caption={title}
          headers={["Date / bucket", ...series.map((s) => s.label)]}
          rows={data.map((d) => [
            String(d.label),
            ...series.map((s) =>
              d[s.key] == null
                ? "Unavailable"
                : s.format
                  ? s.format(Number(d[s.key]))
                  : money(Number(d[s.key])),
            ),
          ])}
        />
      </Disclosure>
    </div>
  );
}

/** Layout only: the signed reconciliation terms are supplied by the shared calculation contract. */
export function WaterfallChart({
  title,
  baseline,
  result,
  rows,
  decimals = 0,
  baselineLabel = "Comparison EBITDA",
  resultLabel = "Current EBITDA",
}: {
  title: string;
  baselineLabel?: string;
  resultLabel?: string;
  baseline: number;
  result: number;
  rows: { label: string; value: number }[];
  decimals?: number;
}) {
  let running = baseline;
  const bars = [
    {
      label: baselineLabel,
      start: 0,
      end: baseline,
      amount: baseline,
      total: true,
    },
    ...rows.map((row) => {
      const start = running;
      running += row.value;
      return { ...row, start, end: running, amount: row.value, total: false };
    }),
    {
      label: resultLabel,
      start: 0,
      end: result,
      amount: result,
      total: true,
    },
  ];
  const low = Math.min(0, ...bars.flatMap((b) => [b.start, b.end])),
    high = Math.max(0, ...bars.flatMap((b) => [b.start, b.end]));
  const span = high - low || 1;
  const y = (n: number) => 210 - ((n - low) / span) * 175;
  const width = 760 / bars.length;
  return (
    <div className="v11-waterfall">
      <h4>{title}</h4>
      <svg
        viewBox="0 0 800 295"
        role="img"
        aria-label={`${title}. Signed adjustments reconcile the baseline to the result. Exact values follow.`}
      >
        <line x1="15" x2="790" y1={y(0)} y2={y(0)} stroke="#4c7096" />
        {bars.map((b, i) => {
          const x = 20 + i * width,
            top = Math.min(y(b.start), y(b.end)),
            height = Math.max(Math.abs(y(b.start) - y(b.end)), 2);
          return (
            <g key={i}>
              <rect
                x={x}
                width={width - 18}
                y={top}
                height={height}
                rx="3"
                fill={
                  b.total ? "#1759ff" : b.amount >= 0 ? "#04d9ac" : "#f07883"
                }
              />
              <text
                x={x + (width - 18) / 2}
                y={Math.max(top - 8, 15)}
                fill="#e8f5ff"
                fontSize="11"
                textAnchor="middle"
              >
                {money(b.amount, decimals)}
              </text>
              <text
                x={x + (width - 18) / 2}
                y="238"
                textAnchor="middle"
                fill="#b9cfe9"
                fontSize="10"
              >
                {b.label.length > 18 ? b.label.slice(0, 17) + "…" : b.label}
              </text>
              {!b.total && (
                <line
                  x1={x + width - 18}
                  x2={x + width}
                  y1={y(b.end)}
                  y2={y(b.end)}
                  stroke="#5a89a8"
                  strokeDasharray="3 3"
                />
              )}
            </g>
          );
        })}
      </svg>
      <DataTable
        caption={`${title} · exact GBP values`}
        headers={["Step", "Amount"]}
        rows={[
          [baselineLabel, money(baseline, decimals)],
          ...rows.map((r) => [r.label, money(r.value, decimals)]),
          [resultLabel, money(result, decimals)],
        ]}
      />
    </div>
  );
}

export function HorizontalBars({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number | null; color: string }[];
}) {
  if (
    items.some(
      (item) =>
        item.value == null || !Number.isFinite(item.value) || item.value < 0,
    )
  )
    return (
      <Notice>
        Complete non-negative comparison values are required for this chart.
      </Notice>
    );
  const max = Math.max(...items.map((item) => item.value!), 1);
  return (
    <div className="v11-horizontal-bars">
      <h4>{title}</h4>
      <svg
        viewBox={`0 0 560 ${items.length * 62 + 20}`}
        role="img"
        aria-label={`${title}. Exact values follow.`}
      >
        {items.map((item, index) => (
          <g key={item.label}>
            <text x="5" y={index * 62 + 33} fill="#c9dcf5" fontSize="12">
              {item.label}
            </text>
            <rect
              x="210"
              y={index * 62 + 12}
              width={(item.value! / max) * 240}
              height="30"
              rx="3"
              fill={item.color}
            />
            <text
              x={220 + (item.value! / max) * 240}
              y={index * 62 + 32}
              fill="white"
              fontSize="13"
              fontWeight="700"
            >
              {money(item.value, 2)}
            </text>
          </g>
        ))}
      </svg>
      <DataTable
        caption={`${title} · GBP per original eligible order`}
        headers={["Measure", "Amount"]}
        rows={items.map((item) => [item.label, money(item.value, 2)])}
      />
    </div>
  );
}
export function RevenueComposition({
  currentNew,
  currentReturning,
}: {
  currentNew: number;
  currentReturning: number;
}) {
  if (
    !Number.isFinite(currentNew) ||
    !Number.isFinite(currentReturning) ||
    currentNew < 0 ||
    currentReturning < 0 ||
    Math.abs(currentNew + currentReturning - 1) > 0.0000001
  )
    return <Notice>Matched composition shares are unavailable.</Notice>;
  return (
    <div className="v11-composition">
      <h4>New and returning customer revenue</h4>
      <p className="v11-muted">
        Selected quarter · net product revenue after discounts and returns · no
        monthly allocation is inferred
      </p>
      <svg
        viewBox="0 0 650 175"
        role="img"
        aria-label={`July–September net product revenue composition: ${percent(currentNew, 0)} new customers and ${percent(currentReturning, 0)} returning customers.`}
      >
        <rect
          x="30"
          y="45"
          width={580 * currentNew}
          height="60"
          rx="3"
          fill="#0752ff"
        />
        <rect
          x={30 + 580 * currentNew}
          y="45"
          width={580 * currentReturning}
          height="60"
          rx="3"
          fill="#10dce7"
        />
        <text
          x={30 + (580 * currentNew) / 2}
          y="82"
          fill="white"
          textAnchor="middle"
          fontSize="23"
          fontWeight="700"
        >
          {percent(currentNew, 0)}
        </text>
        <text
          x={30 + 580 * currentNew + (580 * currentReturning) / 2}
          y="82"
          fill="#00273d"
          textAnchor="middle"
          fontSize="23"
          fontWeight="700"
        >
          {percent(currentReturning, 0)}
        </text>
        <text x="30" y="135" fill="#abc7e9" fontSize="13">
          New customers
        </text>
        <text x="400" y="135" fill="#abc7e9" fontSize="13">
          Returning customers
        </text>
      </svg>
    </div>
  );
}
