import test from 'node:test';
import assert from 'node:assert/strict';
import {startReviewRuntime} from '../src/lib/review-startup.ts';
test('review runtime stays off without explicit enablement and ignores generic credentials',async()=>{
 assert.equal(await startReviewRuntime({DATABASE_URL:'must-not-be-used',SUPABASE_URL:'https://must-not-be-used.invalid'}),undefined);
 assert.equal(await startReviewRuntime({NIGHT_SCOUT_REVIEW_ENABLED:'false'}),undefined);
});
test('explicit enablement with missing or mismatched configuration fails before connecting',async()=>{
 await assert.rejects(startReviewRuntime({NIGHT_SCOUT_REVIEW_ENABLED:'true'}),/configuration is invalid/);
 await assert.rejects(startReviewRuntime({NIGHT_SCOUT_REVIEW_ENABLED:'true',NIGHT_SCOUT_REVIEW_PROJECT_REF:'abcdefghijklmnopqrst',NIGHT_SCOUT_REVIEW_AUTH_URL:'https://wrong.invalid',NIGHT_SCOUT_REVIEW_PUBLIC_KEY:'sb_publishable_test',NIGHT_SCOUT_REVIEW_DATABASE_URL:'postgresql://postgres:private@wrong.invalid/postgres'}),e=>e.message==='Review server configuration is invalid');
});
