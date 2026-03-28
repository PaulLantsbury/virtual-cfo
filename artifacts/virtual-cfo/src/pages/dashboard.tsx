import { ArrowUpRight, ArrowDownRight, Minus, Download, Sparkles, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { useDashboardKpis, useRevenueChart } from "@/hooks/use-dashboard";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TopDrivers, type Driver } from "@/components/TopDrivers";
import { ActionRecommendations, type Recommendation } from "@/components/ActionRecommendations";

/**
 * @ai-commentary Replace with dynamically generated insight when ready.
 * upside/downside cashLow/cashHigh:
 *   @dynamic cashLow  = Math.round(orderVolume * (ppLow  / 100) * revenuePerOrder)
 *   @dynamic cashHigh = Math.round(orderVolume * (ppHigh / 100) * revenuePerOrder)
 */
const CFO_INSIGHT = {
  body: "Contribution margin is declining despite revenue growth, driven primarily by higher shipping costs, rising Meta CAC, and increased discount usage.",
  upside: {
    ppLow: 2,
    ppHigh: 4,
    cashLow: 18_000,
    cashHigh: 42_000,
  },
  /** @ai-commentary Recommended actions — replace with AI-ranked suggestions when ready */
  recommendations: [
    "Reduce discount depth on returning customers",
    "Review shipping and fulfilment pricing",
    "Reallocate spend toward higher-margin channels",
  ],
} as const;

const TOP_DRIVERS: Driver[] = [
  { id: "1", text: "Margin down due to increased shipping and fulfilment costs", trend: "worsening" },
  { id: "2", text: "Repeat purchase rate improving month-on-month", trend: "improving" },
  { id: "3", text: "Ad spend efficiency declining — higher CAC with lower ROAS", trend: "worsening" },
  { id: "4", text: "Discount usage rising faster than revenue growth", trend: "worsening" },
  { id: "5", text: "Average order value holding steady", trend: "neutral" },
];

const RECOMMENDATIONS: Recommendation[] = [
  { id: "1", text: "Review fulfilment partner pricing to improve contribution margin", impact: "high" },
  { id: "2", text: "Reduce discount usage on returning customers", impact: "high" },
  { id: "3", text: "Reallocate ad spend from Meta to Google Shopping", impact: "medium" },
  { id: "4", text: "Investigate rising customer acquisition costs", impact: "medium" },
  { id: "5", text: "Set up a post-purchase email sequence to lift repeat purchase rate", impact: "quick-win" },
];

export default function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();
  const { data: chartData, isLoading: chartLoading } = useRevenueChart();

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Financial Health Overview</h1>
          <p className="text-muted-foreground mt-1">Here's what's driving your financial performance right now.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button>Create Report</Button>
        </div>
      </div>

      {/* ── CFO Insight ── */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 shadow-sm mb-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/10 border-b border-primary/20">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            CFO Insight
          </span>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Body */}
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {CFO_INSIGHT.body}
          </p>

          {/* Upside callout */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/25 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 shrink-0 mt-0.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">
                If these issues are addressed next month, contribution margin could improve by{" "}
                <span className="font-semibold">
                  +{CFO_INSIGHT.upside.ppLow}–{CFO_INSIGHT.upside.ppHigh}pp
                </span>
                , equivalent to approximately{" "}
                <span className="font-bold text-emerald-700 dark:text-emerald-300 text-base">
                  £{CFO_INSIGHT.upside.cashLow.toLocaleString()}–£{CFO_INSIGHT.upside.cashHigh.toLocaleString()}
                </span>{" "}
                additional contribution profit at current sales volume.
              </p>
            </div>
          </div>

          {/* Recommended focus */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Recommended focus:
            </p>
            <ul className="space-y-1.5">
              {CFO_INSIGHT.recommendations.map((rec) => (
                <li key={rec} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-[5px]" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* Summary tags */}
          <div className="flex flex-wrap gap-3 pt-1 border-t border-primary/15">
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-800 dark:text-emerald-300">
                Potential upside next month:{" "}
                <span className="font-bold">
                  £{(CFO_INSIGHT.upside.cashLow / 1000).toFixed(0)}k–£{(CFO_INSIGHT.upside.cashHigh / 1000).toFixed(0)}k
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        {kpisLoading ? (
          Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-secondary rounded-2xl animate-pulse"></div>)
        ) : (
          kpis?.cards.map((kpi) => (
            <div 
              key={kpi.id} 
              className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">{kpi.title}</h3>
              <p className="text-3xl font-display font-bold text-foreground mb-4">{kpi.value}</p>
              
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shrink-0",
                  kpi.trend === "up" ? "bg-success/10 text-success" : 
                  kpi.trend === "down" ? "bg-destructive/10 text-destructive" : 
                  "bg-secondary text-muted-foreground"
                )}>
                  {kpi.trend === "up" && <ArrowUpRight className="w-3 h-3" />}
                  {kpi.trend === "down" && <ArrowDownRight className="w-3 h-3" />}
                  {kpi.trend === "neutral" && <Minus className="w-3 h-3" />}
                  {!kpi.changeText && `${kpi.change}%`}
                </span>
                <span className="text-muted-foreground text-xs leading-snug">
                  {kpi.changeText ?? kpi.changeLabel}
                </span>
              </div>
              {kpi.explanation && (
                <p className="mt-3 text-xs text-muted-foreground/80 leading-snug border-t border-border/50 pt-3">
                  {kpi.explanation}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* TOP DRIVERS */}
      <TopDrivers drivers={TOP_DRIVERS} />

      {/* WHAT TO DO NEXT */}
      <ActionRecommendations recommendations={RECOMMENDATIONS} />

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-lg text-foreground">Cash Flow</h3>
            <select className="bg-secondary/50 border-none text-sm font-medium rounded-lg px-3 py-1.5 outline-none cursor-pointer">
              <option>Last 6 Months</option>
              <option>This Year</option>
              <option>All Time</option>
            </select>
          </div>
          
          <div className="h-[300px] w-full">
            {chartLoading ? (
              <div className="w-full h-full bg-secondary/50 rounded-xl animate-pulse"></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData?.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `$${value / 1000}k`}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50">
          <h3 className="font-semibold text-lg text-foreground mb-6">Net Profit Margin</h3>
          <div className="h-[300px] w-full">
            {chartLoading ? (
              <div className="w-full h-full bg-secondary/50 rounded-xl animate-pulse"></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData?.data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(value) => `$${value / 1000}k`} />
                  <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="profit" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

    </AppLayout>
  );
}
