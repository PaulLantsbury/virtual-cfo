/**
 * Synthetic coherent month implementing the approach approved 12 September 2026.
 * Exact amounts are chosen test fixtures, not separately approved business facts.
 * Not store data or a forecast.
 * Monetary inputs/calculations use integer pence; public output amounts use GBP.
 * Changes in order count/AOV are independent user assumptions, not estimated
 * responses to prices, advertising, discounts or customer behaviour.
 */
export interface ScenarioState {
  orderVolumeChange: number;
  aovChange: number;
  shippingChange: number;
  paymentFeeChange: number;
  marketingSpendChange: number;
  staffCostChange: number;
  softwareChange: number;
  fulfilmentChange: number;
  fixedCostChange: number;
}

export const ZERO_SCENARIO_STATE: Readonly<ScenarioState> = Object.freeze({
  orderVolumeChange: 0, aovChange: 0, shippingChange: 0, paymentFeeChange: 0,
  marketingSpendChange: 0, staffCostChange: 0, softwareChange: 0,
  fulfilmentChange: 0, fixedCostChange: 0,
});

export const SCENARIO_CONTROL_RANGES: Record<keyof ScenarioState, readonly [number, number]> = {
  orderVolumeChange: [-20, 30], aovChange: [-10, 15], shippingChange: [-3, 3],
  paymentFeeChange: [-2, 2], marketingSpendChange: [-30, 30],
  staffCostChange: [-15, 20], softwareChange: [-20, 20],
  fulfilmentChange: [-20, 20], fixedCostChange: [-20, 20],
};

export const SCENARIO_BASELINE_INPUTS = Object.freeze({
  orders: 1_000,
  preDiscountPricePence: 12_500,
  aovPence: 10_000,
  productRefundsPence: 500_000,
  shippingChargedPence: 300_000,
  shippingRefundsPence: 10_000,
  cogsPerOrderPence: 4_000,
  saleableReturnsCostReversalPence: 200_000,
  outboundShippingPerOrderPence: 400,
  fulfilmentPerOrderPence: 300,
  processingPerOrderPence: 200,
  marketingPence: 1_000_000,
  staffPence: 1_200_000,
  softwarePence: 200_000,
  otherOverheadsPence: 400_000,
  depreciationAmortisationPence: 100_000,
});

export const SCENARIO_ASSUMPTIONS = Object.freeze([
  "One synthetic month in GBP; product and shipping sales exclude VAT. VAT is separate and is not deducted again.",
  "1,000 eligible paid/completed original orders; original AOV £100 after discounts and before later refunds. No unpaid, test or pre-sale-cancelled orders.",
  "AOV changes scale the sample £125 pre-discount price and retain a 20% discount rate. No demand response is inferred; order count is a separate assumption, rounded to the nearest whole order.",
  "£5,000 product refunds and £100 shipping refunds are fixed events in this month. They do not remove original orders or alter their AOV. Shipping charges are held at £3,000.",
  "Historical goods cost is £40 per original order. £2,000 of costs reverse for goods explicitly returned to saleable inventory this month, held fixed in every scenario.",
  "Outbound shipping £4, fulfilment £3 and payment processing £2 per original order are explicit sample cost estimates. Processing change is pounds per order, not a percentage fee rate.",
  "Marketing is a £10,000 period expense deducted once in contribution. Changing it does not predict a sales response.",
  "Staff £12,000, software £2,000 and other overheads £4,000 are separate categories. Depreciation/amortisation £1,000 is included in operating profit and added back for EBITDA.",
  "Interest and corporation tax are excluded. No cash, runway, CAC payback, channel growth response or discount/refund-rate forecast is calculated.",
]);

export interface ScenarioMetrics {
  orders: number;
  aov: number;
  grossProductSales: number;
  discounts: number;
  productSalesBeforeRefunds: number;
  productRefunds: number;
  sales: number;
  shippingRevenue: number;
  cogs: number;
  grossProfit: number;
  outboundShipping: number;
  fulfilment: number;
  processing: number;
  variableCosts: number;
  contributionBeforeMarketing: number;
  marketing: number;
  contribution: number;
  staff: number;
  software: number;
  otherOverheads: number;
  depreciationAmortisation: number;
  overheads: number;
  operatingProfit: number;
  ebitda: number;
  cpo: number;
}

function validate(state: ScenarioState) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("Scenario inputs must be an object.");
  }
  const allowed = Object.keys(ZERO_SCENARIO_STATE);
  for (const key of Object.keys(state)) {
    if (!allowed.includes(key)) throw new Error(`Unsupported scenario input: ${key}`);
  }
  for (const key of allowed as (keyof ScenarioState)[]) {
    const value = state[key];
    const [min, max] = SCENARIO_CONTROL_RANGES[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`Invalid scenario input: ${key}`);
    }
  }
}

function calculate(state: ScenarioState): ScenarioMetrics {
  const b = SCENARIO_BASELINE_INPUTS;
  const scaled = (pence: number, percent: number) => Math.round(pence * (1 + percent / 100));
  const orders = Math.round(b.orders * (1 + state.orderVolumeChange / 100));
  const aov = scaled(b.aovPence, state.aovChange);
  const productSalesBeforeRefunds = orders * aov;
  // Keep the synthetic 20% discount assumption, with line total rounded to pence.
  const grossProductSales = Math.round(productSalesBeforeRefunds / 0.8);
  const discounts = grossProductSales - productSalesBeforeRefunds;
  const sales = productSalesBeforeRefunds - b.productRefundsPence;
  const shippingRevenue = b.shippingChargedPence - b.shippingRefundsPence;
  const cogs = orders * b.cogsPerOrderPence - b.saleableReturnsCostReversalPence;
  const grossProfit = sales - cogs;
  const outboundShipping = orders * Math.round(b.outboundShippingPerOrderPence + state.shippingChange * 100);
  const fulfilment = orders * scaled(b.fulfilmentPerOrderPence, state.fulfilmentChange);
  const processing = orders * Math.round(b.processingPerOrderPence + state.paymentFeeChange * 100);
  const variableCosts = outboundShipping + fulfilment + processing;
  const contributionBeforeMarketing = grossProfit + shippingRevenue - variableCosts;
  const marketing = scaled(b.marketingPence, state.marketingSpendChange);
  const contribution = contributionBeforeMarketing - marketing;
  const staff = scaled(b.staffPence, state.staffCostChange);
  const software = scaled(b.softwarePence, state.softwareChange);
  const otherOverheads = scaled(b.otherOverheadsPence, state.fixedCostChange);
  const depreciationAmortisation = b.depreciationAmortisationPence;
  const overheads = staff + software + otherOverheads + depreciationAmortisation;
  const operatingProfit = contribution - overheads;
  const ebitda = operatingProfit + depreciationAmortisation;
  const amounts = {
    aov, grossProductSales, discounts, productSalesBeforeRefunds,
    productRefunds: b.productRefundsPence, sales, shippingRevenue, cogs,
    grossProfit, outboundShipping, fulfilment, processing, variableCosts,
    contributionBeforeMarketing, marketing, contribution, staff, software,
    otherOverheads, depreciationAmortisation, overheads, operatingProfit, ebitda,
    cpo: Math.round(contribution / orders),
  };
  return Object.fromEntries([
    ["orders", orders],
    ...Object.entries(amounts).map(([key, pence]) => [key, pence / 100]),
  ]) as unknown as ScenarioMetrics;
}

export function computeScenario(state: ScenarioState) {
  validate(state);
  const baseline = calculate(ZERO_SCENARIO_STATE);
  const result = calculate(state);
  const deltas = Object.fromEntries(Object.keys(baseline).map((key) => {
    const metric = key as keyof ScenarioMetrics;
    return [key, Math.round((result[metric] - baseline[metric]) * 100) / 100];
  })) as unknown as ScenarioMetrics;
  return { baseline, result, deltas, assumptions: SCENARIO_ASSUMPTIONS };
}
