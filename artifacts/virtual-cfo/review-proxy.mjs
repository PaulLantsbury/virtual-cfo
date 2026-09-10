/** Opt-in local review API routing. Never accepts a remote destination or credentials. */
export function localReviewProxy(env) {
 const raw = env.NIGHT_SCOUT_LOCAL_REVIEW_API_PORT;
 if (raw === undefined) return undefined;
 if (!/^[1-9][0-9]{0,4}$/.test(raw) || Number(raw) > 65535 || Number(raw) === Number(env.PORT)) {
  throw new Error('Local review API port must be a distinct valid port');
 }
 return {
  '^/api/financial-reviews(?:/|$)': {
   target: `http://127.0.0.1:${raw}`,
   changeOrigin: false,
   timeout: 35000,
   proxyTimeout: 35000,
  },
 };
}
