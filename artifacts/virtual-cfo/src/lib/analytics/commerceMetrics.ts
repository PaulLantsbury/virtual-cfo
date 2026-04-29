import { supabase } from "../supabase";
import { COST_ASSUMPTIONS } from "./costAssumptions";
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
  recoverableContribution: number;
  recoverableContributionPercent: number;
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
      recoverableContribution: 0,
      recoverableContributionPercent: 0,
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
  const benchmarkDiscountRate = 0.10;
  const benchmarkRefundRate = 0.05;
  const benchmarkPaymentFeeRate = 0.02;

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

  const recoverableContribution =
    excessDiscountLoss +
    excessRefundLoss +
    excessPaymentFees;

  const recoverableContributionPercent =
    netSales > 0
      ? recoverableContribution / netSales
      : 0;
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
    recoverableContribution,
    recoverableContributionPercent,
  };
}