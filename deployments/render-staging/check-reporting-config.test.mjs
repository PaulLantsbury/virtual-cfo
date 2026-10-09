import test from 'node:test';
import assert from 'node:assert/strict';
import {reportingConfigReadiness} from './check-reporting-config.mjs';
test('diagnostic reports readiness without secret values, generic credentials or network',()=>{
 const env={NIGHT_SCOUT_REVIEW_ENABLED:'true',NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_REVIEW_PROJECT_REF:'bioalckltvkhlczusdvl',NIGHT_SCOUT_REVIEW_AUTH_URL:'https://bioalckltvkhlczusdvl.supabase.co',NIGHT_SCOUT_REVIEW_PUBLIC_KEY:'sb_publishable_synthetic',NIGHT_SCOUT_REVIEW_DATABASE_URL:'postgresql://night_scout_review_login:synthetic-private@db.bioalckltvkhlczusdvl.supabase.co/postgres',DATABASE_URL:'private-admin'};
 const result=reportingConfigReadiness(env);assert.equal(result.validDedicatedConfiguration,true);assert.equal(result.expectedProject,true);assert.equal(result.enabled,true);
 assert.doesNotMatch(JSON.stringify(result),/synthetic-private|synthetic_synthetic|sb_publishable_|postgresql:|private-admin/);
 const absent=reportingConfigReadiness({DATABASE_URL:env.NIGHT_SCOUT_REVIEW_DATABASE_URL});assert.equal(absent.validDedicatedConfiguration,false);assert.equal(absent.present.NIGHT_SCOUT_REVIEW_DATABASE_URL,false);
});
