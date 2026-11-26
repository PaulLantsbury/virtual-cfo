import {createMetaAdsRuntime} from './meta-ads-runtime.mjs';
import {createMetaAdsReportRuntime} from './meta-ads-report-runtime.mjs';
import {createGoogleAdsRuntime} from './google-ads-runtime.mjs';
import {createGoogleAdsReportRuntime} from './google-ads-report-runtime.mjs';

// Web startup never constructs collectors or schedules provider requests.
// Constructors return undefined before touching dependencies unless explicitly enabled.
export async function startMarketingProviderRuntime(env, factories = {
  meta: createMetaAdsRuntime,
  metaReport: createMetaAdsReportRuntime,
  google: createGoogleAdsRuntime,
  googleReport: createGoogleAdsReportRuntime,
}) {
  const opened = [];
  const close = async () => {
    const pending = opened.splice(0);
    await Promise.allSettled(pending.map(runtime => Promise.resolve().then(() => runtime.close())));
  };
  try {
    const routes = {};
    for (const name of ['meta', 'metaReport', 'google', 'googleReport']) {
      const runtime = await factories[name](env);
      if (runtime) {
        opened.push(runtime);
        routes[name] = {service: runtime.service, authenticate: runtime.authenticate,
          ...(runtime.allowedOrigins ? {allowedOrigins: runtime.allowedOrigins} : {})};
      }
    }
    return Object.freeze({routes: Object.freeze(routes), close});
  } catch {
    await close();
    throw new Error('Marketing provider configuration unavailable');
  }
}
