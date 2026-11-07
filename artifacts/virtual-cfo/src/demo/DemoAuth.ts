/** Standalone demo only. Never import or alias this module into the signed-in app. */
export const DEMO_USER_ID = 'demo-user';
export const DEMO_STORE_ID = 'demo-store';
const demoAccess = Object.freeze({
  status: 'ready' as const,
  userId: DEMO_USER_ID,
  storeId: DEMO_STORE_ID,
  stores: Object.freeze([{ id: DEMO_STORE_ID, name: 'Scout & Co · sample store' }]),
  revision: 1,
});
/** Provides synthetic context to the shared SAMPLE plan, without an auth SDK or session. */
export function useAuth() { return demoAccess; }
