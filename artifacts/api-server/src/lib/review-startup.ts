import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {initialiseHistoryReportingRuntime} from '../../../../experiments/synthetic-company/history-runtime.mjs';
/** Explicit opt-in; only dedicated server variables are accepted. No live defaults. */
export async function startReviewRuntime(env:NodeJS.ProcessEnv){
 if(env.NIGHT_SCOUT_REVIEW_ENABLED!=='true')return undefined;
 return initialiseHistoryReportingRuntime({
  projectRef:env.NIGHT_SCOUT_REVIEW_PROJECT_REF??'',
  authUrl:env.NIGHT_SCOUT_REVIEW_AUTH_URL??'',
  publishableKey:env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY??'',
  databaseUrl:env.NIGHT_SCOUT_REVIEW_DATABASE_URL??'',
 },{createPool:options=>new pg.Pool(options),createAuthClient:(url,key,options)=>createClient(url,key,options)},{enabled:env.NIGHT_SCOUT_HISTORY_ENABLED==='true'});
}
