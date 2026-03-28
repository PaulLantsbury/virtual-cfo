import { ArrowUpRight, ArrowDownRight, Minus, CreditCard, Download, ExternalLink } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { useDashboardKpis, useRevenueChart, useRecentTransactions } from "@/hooks/use-dashboard";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();
  const { data: chartData, isLoading: chartLoading } = useRevenueChart();
  const { data: transactionsData, isLoading: txLoading } = useRecentTransactions();

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your business today.</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
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
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                  kpi.trend === "up" ? "bg-success/10 text-success" : 
                  kpi.trend === "down" ? "bg-destructive/10 text-destructive" : 
                  "bg-secondary text-muted-foreground"
                )}>
                  {kpi.trend === "up" && <ArrowUpRight className="w-3 h-3" />}
                  {kpi.trend === "down" && <ArrowDownRight className="w-3 h-3" />}
                  {kpi.trend === "neutral" && <Minus className="w-3 h-3" />}
                  {kpi.change}%
                </span>
                <span className="text-muted-foreground text-xs">{kpi.changeLabel}</span>
              </div>
            </div>
          ))
        )}
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

      {/* RECENT TRANSACTIONS */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
        <div className="p-6 border-b border-border/50 flex justify-between items-center">
          <h3 className="font-semibold text-lg text-foreground">Recent Transactions</h3>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View All</Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/30 text-muted-foreground font-medium uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Transaction</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {txLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-secondary rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-secondary rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-secondary rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-secondary rounded-full w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-secondary rounded w-20 ml-auto"></div></td>
                  </tr>
                ))
              ) : (
                transactionsData?.transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-foreground">{tx.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{tx.category}</td>
                    <td className="px-6 py-4 text-muted-foreground">{format(new Date(tx.date), 'MMM dd, yyyy')}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center",
                        tx.status === "completed" ? "bg-success/10 text-success" :
                        tx.status === "pending" ? "bg-warning/10 text-warning" :
                        "bg-destructive/10 text-destructive"
                      )}>
                        {tx.status}
                      </span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-right font-semibold",
                      tx.type === "income" ? "text-success" : "text-foreground"
                    )}>
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                      <button className="ml-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
