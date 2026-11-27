/** Trusted adapters authenticate and bind these values before invoking the pure core. */
export interface MonthlyRecurringCostSource {
  readonly storeId: string;
  readonly currency: string;
  readonly costId: string;
  /** Complete calendar month, YYYY-MM. */
  readonly month: string;
  readonly sourceVersionId: string;
  readonly selection: 'selected';
  /** Evidence metadata, not a substitute for authorisation or classification review. */
  readonly classification: { readonly type: 'recurring-monthly'; readonly approved: true; readonly approvalId: string };
  readonly coverage: { readonly from: string; readonly to: string; readonly complete: true };
  /** Safe integer pence. Negative source amounts represent explicitly recorded credits. */
  readonly amountPence: number;
}
export interface MonthlyCostAllocationRequest {
  readonly storeId: string;
  readonly currency: string;
  readonly costId: string;
  /** Inclusive, already-resolved business-calendar dates, YYYY-MM-DD. */
  readonly from: string;
  readonly to: string;
  /** Exactly one envelope per intersecting month; no inferred missing-zero months. */
  readonly sources: readonly MonthlyRecurringCostSource[];
}
export interface MonthlyCostAllocationPortion {
  readonly month: string;
  readonly sourceVersionId: string;
  readonly classificationApprovalId: string;
  readonly sourceAmountPence: number;
  readonly sourceFrom: string;
  readonly sourceTo: string;
  readonly from: string;
  readonly to: string;
  readonly calendarDays: number;
  readonly allocatedDays: number;
  readonly valuePence: number;
  readonly cumulativeStartPence: number;
  readonly cumulativeEndPence: number;
}
export type MonthlyCostAllocationCode = 'invalid-scope' | 'invalid-period' | 'missing-source' | 'source-scope-mismatch' |
  'unexpected-source-month' | 'ambiguous-source' | 'unselected-source' | 'unsupported-classification' |
  'incomplete-source' | 'invalid-money' | 'money-overflow' | 'invalid-week';
interface AllocationBasis {
  readonly methodVersion: typeof MONTHLY_COST_ALLOCATION_METHOD;
  readonly kind: 'allocated-estimate';
  readonly isActualCash: false;
  readonly label: string;
}
export type MonthlyCostAllocation = (AllocationBasis & {
  readonly state: 'supported';
  readonly valuePence: number;
  readonly portions: readonly MonthlyCostAllocationPortion[];
  readonly code: null;
  readonly reason: null;
  readonly scope: Readonly<Pick<MonthlyCostAllocationRequest, 'storeId' | 'currency' | 'costId' | 'from' | 'to'>>;
}) | (AllocationBasis & {
  readonly state: 'unavailable';
  readonly valuePence: null;
  readonly portions: readonly [];
  readonly code: MonthlyCostAllocationCode;
  readonly reason: string;
});
export const MONTHLY_COST_ALLOCATION_METHOD: 'recurring-monthly-calendar-days-cumulative-half-away-v1';
export function allocateMonthlyRecurringCost(request: MonthlyCostAllocationRequest): MonthlyCostAllocation;
export function allocateCompleteMondaySundayWeek(request: MonthlyCostAllocationRequest): MonthlyCostAllocation;
