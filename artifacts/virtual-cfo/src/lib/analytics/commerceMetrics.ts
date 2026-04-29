import { supabase } from "../supabase";
import { COST_ASSUMPTIONS } from "./costAssumptions";

/**
 * CommerceMetrics
 *
 * Values computed at runtime from the Supabase `orders` table.
 *
 * IMPORTANT — two distinct "recoverable" concepts exist in this codebase:
 *
 * 1. liveOrderLeakageEstimate  (this file)
 *    A diagnostic signal computed order-by-order from actual Supabase data.
 *    Formula: excessDiscountLoss + excessRefundLoss + excessPaymentFees
 *    Use: internal diagnostic tooling, future Profit Opportunities deep-dive.
 *    NOT used as the headline dashboard KPI.
 *
 * 2. Headline Recoverable Contribution  (business-snapshot.ts)
 *    The strategic opportunity range shown in the KPI tile and opportunity panel.
 *    Source: RECOVERABLE_LOW / RECOVERABLE_HIGH (static) →
 *            future: sum of active rows in the `opportunities` table.
 *    NOT computed here.
 *
 * Do not conflate these. The KPI tile reads from business-snapshot.ts.
 * The live order leakage estimate is available for future diagnostic pages.
 */
export type CommerceMetrics = {
  totalRevenue: number;
  netSales: number;
  grossSales: number;
  orderCount: number;
  customerCount: number;
  repeatCustomerCount: number;
  averageOrderValue: number;
  totalDiscounts: number;
  discountRate: number;
  repeatPurchaseRate: number;
  refundRate: number;
  contributionMargin: number;
  contributionMarginPercent: number;
  /**
   * Live diagnostic leakage estimate.
   * Sum of contribution lost to above-benchmark discount rates, refund rates,
   * and payment fees — computed from actual order data in the `orders` table.
   *
   * This is NOT the headline Recoverable Contribution shown on the dashboard KPI tile.
   * The headline figure comes from RECOVERABLE_LOW / RECOVERABLE_HIGH in business-snapshot.ts.
   */
  liveOrderLeakageEstimate: number;
  /**
   * liveOrderLeakageEstimate expressed as a percentage of net sales.
   * Same caveat as liveOrderLeakageEstimate — diagnostic only, not the KPI headline.
   */
  liveOrderLeakageEstimatePct: number;
};

export async function getCommerceMetrics(): Promise<CommerceMetrics> {
  const { data, error } = await supabase
    .from("orders")
    .select("gross_sales, discounts, refunds, tax, total_sales, customer_id");
  if (error) {
    console.error("Commerce metrics query failed:", error.message);

    return {
      totalRevenue: 0,
      netSales: 0,
      grossSales: 0,
      orderCount: 0,
      customerCount: 0,
      repeatCustomerCount: 0,
      averageOrderValue: 0,
      totalDiscounts: 0,
      discountRate: 0,
      repeatPurchaseRate: 0,
      refundRate: 0,
      contributionMargin: 0,
      contributionMarginPercent: 0,
      liveOrderLeakageEstimate: 0,
      liveOrderLeakageEstimatePct: 0,
    };
  }

  const rows = data ?? [];

  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.total_sales || 0), 0);
  const netSales = rows.reduce(
      (sum, row) =>
        sum +
        (
          Number(row.gross_sales || 0)
          - Number(row.discounts || 0)
          - Number(row.refunds || 0)
          - Number(row.tax || 0)
        ),
      0
    );
  const grossSales = rows.reduce((sum, row) => sum + Number(row.gross_sales || 0), 0);
  const totalDiscounts = rows.reduce((sum, row) => sum + Number(row.discounts || 0), 0);
  const totalRefunds = rows.reduce(
    (sum, row) => sum + Number(row.refunds || 0),
    0
  );
  const refundRate =
    grossSales > 0 ? totalRefunds / grossSales : 0;
  const orderCount = rows.length;
  const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
  const discountRate = grossSales > 0 ? totalDiscounts / grossSales : 0;
  const paymentFees = netSales * COST_ASSUMPTIONS.paymentFeeRate;

  const fulfilmentCosts =
    orderCount * COST_ASSUMPTIONS.fulfilmentCostPerOrder;

  const packagingCosts =
    orderCount * COST_ASSUMPTIONS.packagingCostPerOrder;

  const returnHandlingCosts =
    totalRefunds > 0
      ? totalRefunds * COST_ASSUMPTIONS.returnHandlingCostPerRefund
      : 0;

  const contributionMargin =
    netSales -
    paymentFees -
    fulfilmentCosts -
    packagingCosts -
    returnHandlingCosts;

  const contributionMarginPercent =
    netSales > 0 ? contributionMargin / netSales : 0;

  // ── Live diagnostic leakage estimate ─────────────────────────────────────────
  // Measures contribution currently being lost to above-benchmark rates.
  // This is a diagnostic signal — not the headline Recoverable Contribution KPI.
  // The KPI tile uses RECOVERABLE_LOW / RECOVERABLE_HIGH from business-snapshot.ts.
  const benchmarkDiscountRate    = 0.10;
  const benchmarkRefundRate      = 0.05;
  const benchmarkPaymentFeeRate  = 0.02;

  const excessDiscountLoss =
    discountRate > benchmarkDiscountRate
      ? netSales * (discountRate - benchmarkDiscountRate)
      : 0;

  const excessRefundLoss =
    refundRate > benchmarkRefundRate
      ? netSales * (refundRate - benchmarkRefundRate)
      : 0;

  const excessPaymentFees =
    COST_ASSUMPTIONS.paymentFeeRate > benchmarkPaymentFeeRate
      ? netSales *
        (COST_ASSUMPTIONS.paymentFeeRate - benchmarkPaymentFeeRate)
      : 0;

  const liveOrderLeakageEstimate =
    excessDiscountLoss +
    excessRefundLoss +
    excessPaymentFees;

  const liveOrderLeakageEstimatePct =
    netSales > 0
      ? liveOrderLeakageEstimate / netSales
      : 0;

  // ── Customer repeat analysis ──────────────────────────────────────────────────
  const ordersByCustomer = new Map<string, number>();

  rows.forEach((row) => {
    if (!row.customer_id) return;

    const currentCount = ordersByCustomer.get(row.customer_id) ?? 0;
    ordersByCustomer.set(row.customer_id, currentCount + 1);
  });

  const customerCount = ordersByCustomer.size;
  const repeatCustomerCount = Array.from(ordersByCustomer.values()).filter(
    (count) => count > 1
  ).length;

  const repeatPurchaseRate =
    customerCount > 0 ? repeatCustomerCount / customerCount : 0;

  return {
    totalRevenue,
    netSales,
    grossSales,
    orderCount,
    customerCount,
    repeatCustomerCount,
    averageOrderValue,
    totalDiscounts,
    discountRate,
    repeatPurchaseRate,
    refundRate,
    contributionMargin,
    contributionMarginPercent,
    liveOrderLeakageEstimate,
    liveOrderLeakageEstimatePct,
  };
}
