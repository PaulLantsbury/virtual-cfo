import type { GoogleAdsSpendReportDependencies } from '../routes/google-ads-spend-report.js';
export type GoogleAdsReportRuntime = Readonly<{
  service: NonNullable<GoogleAdsSpendReportDependencies['service']>;
  authenticate(authorization: string): Promise<Readonly<{ userId: string; isOwner: true }>>;
  close(): Promise<void>;
}>;

export function createGoogleAdsReportRuntime(
  env: NodeJS.ProcessEnv,
  dependencies?: Readonly<Record<string, unknown>>,
): Promise<GoogleAdsReportRuntime | undefined>;
