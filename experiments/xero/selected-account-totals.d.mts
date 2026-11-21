export type XeroBankSummaryContext={currency:string;baseCurrency:unknown;from:string;to:string;snapshotFrom:unknown;snapshotTo:unknown;accountDirectory:unknown};
/** Validates source reports and selected IDs; returns selected integer-pence values only. */
export function extractSelectedAccountTotals(input?:{profitAndLoss?:unknown;balanceSheet?:unknown;bankSummary?:unknown;bankSummaryContext?:XeroBankSummaryContext;mapping?:unknown}):Readonly<Record<string,number>>;
