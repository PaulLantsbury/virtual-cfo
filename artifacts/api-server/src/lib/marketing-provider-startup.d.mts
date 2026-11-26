import type {MarketingProviderDependencies} from '../app.js';
export declare function startMarketingProviderRuntime(env: NodeJS.ProcessEnv, factories?: undefined, options?: {reportOnly?: boolean}): Promise<Readonly<{
  routes: MarketingProviderDependencies;
  close(): Promise<void>;
}>>;
