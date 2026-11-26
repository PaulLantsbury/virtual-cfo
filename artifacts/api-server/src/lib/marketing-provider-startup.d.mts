import type {MarketingProviderDependencies} from '../app.js';
export declare function startMarketingProviderRuntime(env: NodeJS.ProcessEnv): Promise<Readonly<{
  routes: MarketingProviderDependencies;
  close(): Promise<void>;
}>>;
