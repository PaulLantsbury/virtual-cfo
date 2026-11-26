import type { MetaAdsRouterDependencies } from '../routes/meta-ads.js';

export type MetaAdsRuntime = Readonly<{
  service: NonNullable<MetaAdsRouterDependencies['service']>;
  authenticate: NonNullable<MetaAdsRouterDependencies['authenticate']>;
  allowedOrigins: readonly string[];
  close(): Promise<void>;
}>;

export declare function createMetaAdsRuntime(
  env: NodeJS.ProcessEnv,
  dependencies?: Readonly<Record<string, unknown>>,
): Promise<MetaAdsRuntime | undefined>;
