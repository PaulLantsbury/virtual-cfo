import type { GoogleAdsRouterDependencies } from '../routes/google-ads.js';
export type GoogleAdsRuntime = Readonly<{
  service: NonNullable<GoogleAdsRouterDependencies['service']>;
  authenticate(authorization: string): Promise<Readonly<{ userId: string; isOwner: true }>>;
  allowedOrigins: readonly string[];
  close(): Promise<void>;
}>;

export function createGoogleAdsRuntime(
  env: NodeJS.ProcessEnv,
  dependencies?: Readonly<Record<string, unknown>>,
): Promise<GoogleAdsRuntime | undefined>;
