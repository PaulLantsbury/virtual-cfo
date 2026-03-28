import { ArrowUpRight, ArrowDownRight, Minus, Download, Sparkles } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { useDashboardKpis, useRevenueChart } from "@/hooks/use-dashboard";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TopDrivers, type Driver } from "@/components/TopDrivers";

const TOP_DRIVERS: Driver[] = [
  { id: "1", text: "Margin down due to increased shipping and fulfilment costs", trend: "worsening" },
  { id: "2", text: "Repeat purchase rate improving month-on-month", trend: "improving" },
  { id: "3", text: "Ad spend efficiency declining — higher CAC with lower ROAS", trend: "worsening" },
  { id: "4", text: "Discount usage rising faster than revenue growth", trend: "worsening" },
  { id: "5", text: "Average order value holding steady", trend: "neutral" },
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

      {/* AI CFO INSIGHT */}
      <div className="relative mb-8 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-purple-500/10 rounded-2xl" />
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-indigo-500/20" />
        <div className="relative flex items-start gap-4 p-5 sm:p-6">
          <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/30 mt-0.5">
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500">AI CFO Insight</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 text-[10px] font-bold tracking-wide">LIVE</span>
            </div>
            <p className="text-sm sm:text-base text-foreground leading-relaxed font-medium">
              "Profitability declining despite revenue growth. Discount usage increased 11% month-on-month."
            </p>
          </div>
        </div>
      </div>

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
