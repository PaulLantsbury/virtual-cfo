/** Operational acknowledgement, not live scheduler telemetry or financial evidence.
 * Update only after inspecting the deployed worker. Never infer overnight success
 * from the shared manual/scheduled collection journal.
 */
export const nightlyDeployment = {
  projectRef: 'bioalckltvkhlczusdvl',
  storeId: '56d92f8a-746e-4b4f-b408-81fc98c4aa17',
  acknowledgedOn: '2026-09-17',
  timezone: 'Europe/London',
  intendedLocalTime: '02:00',
  startupWindow: '02:00–02:15',
  reportFrom: '2026-09-17',
  reportTo: '2026-09-17',
  scheduleVerification: 'confirmed' as 'pending' | 'confirmed',
};

export function deploymentForStore(supabaseUrl: string | undefined, storeId: string | null | undefined) {
  if (!supabaseUrl || storeId !== nightlyDeployment.storeId) return null;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:' || url.hostname !== `${nightlyDeployment.projectRef}.supabase.co` || url.port || url.username || url.password) return null;
    return nightlyDeployment;
  } catch { return null; }
}
