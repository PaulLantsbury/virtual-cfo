import { useGetDashboardKpis, useGetRevenueChart, useGetRecentTransactions } from "@workspace/api-client-react";
import type { DashboardKpis, RevenueChartData, TransactionList, KpiCardTrend, TransactionType, TransactionStatus } from "@workspace/api-client-react/src/generated/api.schemas";

// --- MOCK DATA FALLBACKS ---

const mockKpis: DashboardKpis = {
  cards: [
    { id: "rev", title: "Monthly Revenue", value: "$124,500", change: 12.5, changeLabel: "vs last month", trend: "up" },
    { id: "exp", title: "Monthly Expenses", value: "$84,200", change: 2.4, changeLabel: "vs last month", trend: "down" },
    { id: "prof", title: "Net Profit", value: "$40,300", change: 8.2, changeLabel: "vs last month", trend: "up" },
    { id: "run", title: "Cash Runway", value: "14.2 mos", change: 0, changeLabel: "stable", trend: "neutral" },
  ]
};

const mockChartData: RevenueChartData = {
  data: [
    { month: "Jan", revenue: 85000, expenses: 65000, profit: 20000 },
    { month: "Feb", revenue: 92000, expenses: 68000, profit: 24000 },
    { month: "Mar", revenue: 98000, expenses: 72000, profit: 26000 },
    { month: "Apr", revenue: 105000, expenses: 75000, profit: 30000 },
    { month: "May", revenue: 110000, expenses: 78000, profit: 32000 },
    { month: "Jun", revenue: 115000, expenses: 80000, profit: 35000 },
    { month: "Jul", revenue: 124500, expenses: 84200, profit: 40300 },
  ]
};

const mockTransactions: TransactionList = {
  total: 5,
  transactions: [
    { id: "tx1", date: "2023-10-24T10:00:00Z", description: "Stripe Payout", category: "Revenue", amount: 12450.00, type: "income", status: "completed" },
    { id: "tx2", date: "2023-10-23T14:30:00Z", description: "AWS Cloud Services", category: "Infrastructure", amount: 2340.50, type: "expense", status: "completed" },
    { id: "tx3", date: "2023-10-22T09:15:00Z", description: "Gusto Payout", category: "Revenue", amount: 8900.25, type: "income", status: "pending" },
    { id: "tx4", date: "2023-10-21T11:45:00Z", description: "WeWork Payroll", category: "Payroll", amount: 45200.00, type: "expense", status: "completed" },
    { id: "tx5", date: "2023-10-20T16:20:00Z", description: "Google Workspace", category: "Software", amount: 450.00, type: "expense", status: "failed" },
  ]
};

// --- WRAPPER HOOKS ---
// These wrap the generated API hooks to provide seamless mock fallbacks 
// if the actual endpoints aren't returning data yet.

export function useDashboardKpis() {
  const query = useGetDashboardKpis({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  return {
    ...query,
    data: (query.isError || !query.data) ? mockKpis : query.data,
    isLoading: query.isLoading && !query.isError
  };
}

export function useRevenueChart() {
  const query = useGetRevenueChart({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  return {
    ...query,
    data: (query.isError || !query.data) ? mockChartData : query.data,
    isLoading: query.isLoading && !query.isError
  };
}

export function useRecentTransactions() {
  const query = useGetRecentTransactions({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  return {
    ...query,
    data: (query.isError || !query.data) ? mockTransactions : query.data,
    isLoading: query.isLoading && !query.isError
  };
}
