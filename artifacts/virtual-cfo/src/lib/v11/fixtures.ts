import type { HistoricalInput, ReportContext, ScenarioInput } from "./types.ts";
const p = (pounds: number) => pounds * 100;
export const FORMULA_VERSION = "night-scout-v11-2026-10-30";
export const SAMPLE_CONTEXT: ReportContext = {
  businessId: "fictional-v11-business",
  currency: "GBP",
  timezone: "Europe/London",
  period: { from: "2026-07-01", to: "2026-09-30" },
  comparison: { from: "2025-07-01", to: "2025-09-30" },
  snapshotId: "SAMPLE-Q3-26",
  snapshotAsOf: "2026-09-30",
  formulaVersion: FORMULA_VERSION,
  readiness: "sample",
  isSample: true,
};
export const HISTORICAL_CURRENT: HistoricalInput = {
  netProductSales: p(680001),
  netShipping: p(18005),
  productCosts: p(260413),
  variableCosts: p(106080),
  advertising: p(174300),
  overheads: p(121680),
  originalOrders: 9980,
  originalOrderProductSales: p(698600),
};
export const HISTORICAL_COMPARISON: HistoricalInput = {
  netProductSales: p(668000),
  netShipping: p(17664),
  productCosts: p(250000),
  variableCosts: p(100000),
  advertising: p(138104),
  overheads: p(121472),
  originalOrders: 9600,
  originalOrderProductSales: p(681600),
};
export const MONTHLY_TRENDS = [
  {
    label: "Jul",
    date: "2026-07-31",
    revenue: p(220000),
    ebitda: p(12000),
    comparisonEbitda: p(26000),
    overheads: p(40000),
    comparisonRevenue: p(220000),
    operatingCash: p(6000),
    comparisonOperatingCash: p(16000),
    bankCash: p(198000),
  },
  {
    label: "Aug",
    date: "2026-08-31",
    revenue: p(230000),
    ebitda: p(11000),
    comparisonEbitda: p(25000),
    overheads: p(40000),
    comparisonRevenue: p(225000),
    operatingCash: p(3000),
    comparisonOperatingCash: p(17000),
    bankCash: p(194000),
  },
  {
    label: "Sep",
    date: "2026-09-30",
    revenue: p(248006),
    ebitda: p(12533),
    comparisonEbitda: p(25088),
    overheads: p(41680),
    comparisonRevenue: p(240664),
    operatingCash: p(5000),
    comparisonOperatingCash: p(17000),
    bankCash: p(186000),
  },
];
export const CASH_FIXTURE = {
  asOf: "2026-09-30",
  openingBank: p(200000),
  closingBank: p(186000),
  ebitda: p(35533),
  operatingAdjustments: [
    { id: "inventory", label: "Inventory increase", value: -p(24000) },
    { id: "debtors", label: "Debtor increase", value: -p(5000) },
    { id: "provider", label: "Provider balance increase", value: -p(3000) },
    { id: "suppliers", label: "Supplier credit increase", value: p(12000) },
    { id: "other", label: "Other operating adjustments", value: -p(1533) },
  ],
  bankAdjustments: [
    { id: "tax", label: "Tax", value: -p(8000) },
    { id: "equipment", label: "Equipment", value: -p(4000) },
    { id: "principal", label: "Loan principal", value: -p(6000) },
    { id: "dividends", label: "Dividends", value: -p(10000) },
  ],
  openingStock: p(120000),
  purchases: p(284413),
  cogs: p(260413),
  closingStock: p(144000),
  supplierPayments: p(272413),
  providerBalances: { pending: p(8000), reserves: p(3000), failed: p(1000) },
  debtors: { current: p(12000), overdue1to30: p(4000), overdue31plus: p(2000) },
};
export const MARKETING_FIXTURE = {
  acquisitionSpend: p(90000),
  newCustomers: 2700,
  firstOrderContributionPerCustomer: p(26),
  ledgerAdvertising: p(174300),
  unallocatedAdvertising: p(84300),
  newRevenueShare: 0.4,
  returningRevenueShare: 0.6,
  monthly: [
    {
      label: "Jul",
      newCustomers: 800,
      spend: p(24000),
      comparisonCac: p(28),
      metaSpend: p(18000),
      metaRevenue: p(61200),
    },
    {
      label: "Aug",
      newCustomers: 900,
      spend: p(30000),
      comparisonCac: p(30),
      metaSpend: p(20000),
      metaRevenue: p(60000),
    },
    {
      label: "Sep",
      newCustomers: 1000,
      spend: p(36000),
      comparisonCac: p(32),
      metaSpend: p(22000),
      metaRevenue: p(58800),
    },
  ],
  channels: [
    {
      id: "meta",
      name: "Meta",
      spend: p(60000),
      attributedRevenue: p(180000),
      newCustomers: 1500,
      comparisonSpend: p(52000),
      comparisonRevenue: p(176800),
    },
    {
      id: "google",
      name: "Google",
      spend: p(30000),
      attributedRevenue: p(120000),
      newCustomers: 1200,
      comparisonSpend: null,
      comparisonRevenue: null,
    },
  ],
  cohort: {
    period: { from: "2026-04-01", to: "2026-06-30" },
    observedThrough: "2026-09-30",
    customers: 2700,
    acquisitionSpend: p(90000),
    grossProfitPerCustomer: p(75),
    contributionPerCustomer: p(55),
    repeatMarketingDeducted: false,
    cumulativeContribution: [
      { day: 0, value: p(26) },
      { day: 30, value: p(30) },
      { day: 55, value: p(90000) / 2700 },
      { day: 60, value: p(38) },
      { day: 90, value: p(55) },
    ],
  },
};
export const SCENARIO_BASELINE: ScenarioInput = {
  method: "orders",
  common: {
    aov: p(100),
    marketing: p(10000),
    refunds: p(5000),
    netShipping: p(2900),
    productCostPerOrder: p(40),
    returnedStockRecovery: p(2000),
    shippingPerOrder: p(4),
    fulfilmentPerOrder: p(3),
    paymentPerOrder: p(2),
    staff: p(10000),
    otherOverheads: p(8000),
  },
  methods: {
    orders: { orders: 1000 },
    "spend-cpa": { cpa: p(20), otherOrders: 500 },
    "traffic-conversion": { sessions: 50000, conversion: 0.02 },
  },
};
export const DEFAULT_SCENARIO: ScenarioInput = {
  method: "orders",
  common: { ...SCENARIO_BASELINE.common, aov: p(105), marketing: p(12000) },
  methods: {
    orders: { orders: 1100 },
    "spend-cpa": { cpa: p(20), otherOrders: 500 },
    "traffic-conversion": { sessions: 50000, conversion: 0.022 },
  },
};
export const STAFF_FIXTURE = {
  cost: p(60000),
  includedInOverheads: true as const,
};
export const V11_SAMPLE = {
  context: SAMPLE_CONTEXT,
  staff: STAFF_FIXTURE,
  current: HISTORICAL_CURRENT,
  comparison: HISTORICAL_COMPARISON,
  trends: MONTHLY_TRENDS,
  cash: CASH_FIXTURE,
  marketing: MARKETING_FIXTURE,
  baseline: SCENARIO_BASELINE,
  scenario: DEFAULT_SCENARIO,
};

/** A sample snapshot is immutable; scenario editors must clone the input before changing assumptions. */
function freezeFixture<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeFixture);
    Object.freeze(value);
  }
  return value;
}
freezeFixture(V11_SAMPLE);
