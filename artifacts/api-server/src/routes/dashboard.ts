import { Router, type IRouter } from "express";
import {
  GetDashboardKpisResponse,
  GetRevenueChartResponse,
  GetRecentTransactionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/kpis", (_req, res) => {
  const data = GetDashboardKpisResponse.parse({
    cards: [
      {
        id: "monthly-revenue",
        title: "Monthly Revenue",
        value: "$124,500",
        change: 12.4,
        changeLabel: "vs last month",
        trend: "up",
      },
      {
        id: "monthly-expenses",
        title: "Monthly Expenses",
        value: "$68,200",
        change: -3.1,
        changeLabel: "vs last month",
        trend: "down",
      },
      {
        id: "net-profit",
        title: "Net Profit",
        value: "$56,300",
        change: 18.7,
        changeLabel: "vs last month",
        trend: "up",
      },
      {
        id: "cash-runway",
        title: "Cash Runway",
        value: "14 months",
        change: 0,
        changeLabel: "stable",
        trend: "neutral",
      },
    ],
  });
  res.json(data);
});

router.get("/revenue-chart", (_req, res) => {
  const data = GetRevenueChartResponse.parse({
    data: [
      { month: "Jan", revenue: 92000, expenses: 61000, profit: 31000 },
      { month: "Feb", revenue: 98500, expenses: 63200, profit: 35300 },
      { month: "Mar", revenue: 105000, expenses: 65800, profit: 39200 },
      { month: "Apr", revenue: 110200, expenses: 67100, profit: 43100 },
      { month: "May", revenue: 118400, expenses: 66500, profit: 51900 },
      { month: "Jun", revenue: 115000, expenses: 70200, profit: 44800 },
      { month: "Jul", revenue: 121000, expenses: 69800, profit: 51200 },
      { month: "Aug", revenue: 119500, expenses: 68400, profit: 51100 },
      { month: "Sep", revenue: 124500, expenses: 68200, profit: 56300 },
    ],
  });
  res.json(data);
});

router.get("/transactions", (_req, res) => {
  const data = GetRecentTransactionsResponse.parse({
    transactions: [
      {
        id: "txn-001",
        date: "2026-03-28",
        description: "AWS Infrastructure",
        category: "Infrastructure",
        amount: 4200,
        type: "expense",
        status: "completed",
      },
      {
        id: "txn-002",
        date: "2026-03-27",
        description: "Acme Corp - SaaS License",
        category: "Revenue",
        amount: 12500,
        type: "income",
        status: "completed",
      },
      {
        id: "txn-003",
        date: "2026-03-26",
        description: "Stripe Processing Fees",
        category: "Fees",
        amount: 380,
        type: "expense",
        status: "completed",
      },
      {
        id: "txn-004",
        date: "2026-03-25",
        description: "TechStart Inc - Enterprise",
        category: "Revenue",
        amount: 28000,
        type: "income",
        status: "completed",
      },
      {
        id: "txn-005",
        date: "2026-03-24",
        description: "Office Rent - Q2",
        category: "Operations",
        amount: 8500,
        type: "expense",
        status: "pending",
      },
      {
        id: "txn-006",
        date: "2026-03-23",
        description: "Salesforce CRM",
        category: "Software",
        amount: 1200,
        type: "expense",
        status: "completed",
      },
      {
        id: "txn-007",
        date: "2026-03-22",
        description: "GlobalVentures - SaaS",
        category: "Revenue",
        amount: 9800,
        type: "income",
        status: "completed",
      },
    ],
    total: 7,
  });
  res.json(data);
});

export default router;
