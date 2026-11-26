import type { MetaAdsSpendReportDependencies } from '../routes/meta-ads-spend-report.js';

export type MetaAdsReportRuntime = Readonly<{
  service: NonNullable<MetaAdsSpendReportDependencies['service']>;
  authenticate: NonNullable<MetaAdsSpendReportDependencies['authenticate']>;
  close(): Promise<void>;
}>;

export declare function createMetaAdsReportRuntime(
  env: NodeJS.ProcessEnv,
  dependencies?: Readonly<Record<string, unknown>>,
): Promise<MetaAdsReportRuntime | undefined>;
