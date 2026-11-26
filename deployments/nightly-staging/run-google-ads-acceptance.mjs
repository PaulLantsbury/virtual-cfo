// One-off staging-only historical Google Ads spend acceptance. No schedule.
import { runGoogleAdsAcceptance } from '../../experiments/marketing/google-ads-acceptance.mjs';

function unavailable() {
  process.stderr.write('Google Ads staging acceptance unavailable; review the staging checklist\n');
  process.exitCode = 1;
}

if (process.argv.length !== 2) {
  unavailable();
} else {
  try {
    const env = process.env;
    const result = await runGoogleAdsAcceptance({
      env,
      createRuntime: async (configuredEnv) => {
        const module = await import('../../artifacts/api-server/src/lib/google-ads-collector-runtime.mjs');
        if (typeof module.createGoogleAdsCollectorRuntime !== 'function') throw new Error('unavailable');
        return module.createGoogleAdsCollectorRuntime(configuredEnv);
      },
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.state === 'already_running') process.exitCode = 1;
  } catch { unavailable(); }
}
