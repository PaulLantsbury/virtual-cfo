import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,U} from '../shopify/finance-fixture.mjs';
import {prepareHistoricalStagingPackage,HISTORICAL_STAGING_TARGET as target} from './historical-staging-package.mjs';
import {historicalManifest,CURRENT_PERIODS} from './historical-testing-fixture.mjs';
import {createProfitSalesReader} from './profit-sales-reader.mjs';
import {readProfitEvidence} from './profit-evidence-reader.mjs';
import {setupProfitStagingFixture,PROFIT_STAGING_IDS} from './profit-staging-fixture.mjs';

test('Intake-aware canonical package completes September, supports only elapsed October sales, preserves Store D and refuses schema drift/replay',async()=>{
 const p=await prepareHistoricalStagingPackage({...target,reviewerId:U,current:true,intake:true,verifyStoreD:true});
 assert.equal(p.fixtureMode,'current-2026-10-09');
 assert.equal(p.rows['public.orders'],141);
 assert.equal(p.rows['finance_v1.profit_evidence_versions'],14);
 assert.equal(p.rows['finance_v1.coverage_evidence'],16);
 assert.equal(historicalManifest({current:true}).orders.filter(o=>o.day>'2026-10-08').length,0);
 assert.equal(CURRENT_PERIODS.at(-1)[2],8);
 assert.match(p.compatibilityPreflightSql,/^BEGIN READ ONLY;/);
 const {db}=await setup(undefined,{installIntake:false});
 try{
  // Match the hosted reporting connection's UTC session before baseline capture.
  await db.exec("SET TIME ZONE 'UTC'");
  await db.exec(sql('staging/20260910_review_setup.sql'));
  await db.exec(sql('proposals/20260913_profit_evidence.sql'));
  const readSales=createProfitSalesReader({userId:U});
  await setupProfitStagingFixture(db,{userId:U,readSales});
  const before=(await db.query('SELECT to_jsonb(o) row FROM public.orders o WHERE store_id=$1 ORDER BY id',[PROFIT_STAGING_IDS.store])).rows;
  const readiness=async()=> (await db.exec(p.compatibilityPreflightSql))[1].rows[0].readiness;
  const diagnostic=async()=> (await db.exec(p.schemaDiagnosticsSql))[1].rows[0].diagnostics;
  const initial=await diagnostic();assert.equal(initial.schema_contract_matches,true);assert.deepEqual(initial.mismatches,{columns:[],constraints:[],triggers:[],not_null_attributes:[]});assert.equal(initial.application_authorized,false);assert.equal(initial.expected_catalog_major,18);
  assert.equal(initial.visible_constraint_types.n,126);assert.equal(p.intakeAware,true);
  await db.exec('ALTER TABLE public.orders ALTER COLUMN store_id DROP NOT NULL');assert.equal((await readiness()).schema_contract_matches,false);assert.ok((await diagnostic()).mismatches.not_null_attributes.length);await db.exec('ALTER TABLE public.orders ALTER COLUMN store_id SET NOT NULL');
  const clean=await readiness();assert.equal(clean.schema_contract_matches,true);assert.equal(clean.reserved_target_vacant,true);assert.equal(clean.reviewer_verification_still_required,true);assert.equal(clean.auth_identity_verification_still_required,true);
  await db.exec('ALTER TABLE public.orders ADD COLUMN unexpected text');assert.equal((await readiness()).schema_contract_matches,false);const changed=await diagnostic();assert.ok(changed.mismatches.columns.some(c=>c.table==='public.orders'&&c.name==='unexpected'&&c.status==='unexpected_or_changed_record'));assert.equal(changed.application_authorized,false);await db.exec('ALTER TABLE public.orders DROP COLUMN unexpected');
  const secondReviewer='80000000-0000-4000-8000-000000000002';
  await db.query('INSERT INTO auth.users(id) VALUES($1)',[secondReviewer]);await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[secondReviewer,PROFIT_STAGING_IDS.store]);
  await assert.rejects(db.exec(p.operatorApplySql),/singleton reviewer mismatch/);await db.exec('ROLLBACK');
  await db.query('DELETE FROM public.store_memberships WHERE user_id=$1 AND store_id=$2',[secondReviewer,PROFIT_STAGING_IDS.store]);
  // Source JSON must retain the preparation timezone even when the operator
  // session differs. Omitting it reproduces the stale-overhead guard failure.
  await db.exec("SET TIME ZONE 'Europe/London'");
  const timezoneSql="SET LOCAL TIME ZONE 'UTC';\n";
  assert.ok(p.operatorApplySql.includes(timezoneSql));
  const unpinned=p.operatorApplySql.replace(timezoneSql,'');
  await assert.rejects(db.exec(unpinned),/Unsupported or stale overhead source/);await db.exec('ROLLBACK');
  assert.equal((await readiness()).reserved_target_vacant,true);
  await db.exec(p.operatorApplySql.replace(/COMMIT;\n$/,'ROLLBACK;\n'));
  assert.equal((await readiness()).reserved_target_vacant,true);
  assert.equal((await db.query("SELECT current_setting('TimeZone') tz")).rows[0].tz,'Europe/London');
  await db.exec("SET TIME ZONE 'UTC'");
  const tampered=p.operatorApplySql.replace('DO $store_d_preserved$',`UPDATE public.orders SET gross_sales=gross_sales+1 WHERE store_id='${PROFIT_STAGING_IDS.store}';\nDO $store_d_preserved$`);
  await assert.rejects(db.exec(tampered),/Store D fingerprint changed/);await db.exec('ROLLBACK');assert.equal((await readiness()).reserved_target_vacant,true);
  await db.exec(p.operatorApplySql.replace(/COMMIT;\n$/,'ROLLBACK;\n'));assert.equal((await readiness()).reserved_target_vacant,true);
  await db.exec(p.operatorApplySql);assert.equal((await db.query("SELECT current_setting('TimeZone') tz")).rows[0].tz,'UTC');await db.exec(p.postflightSql);
  const sepScope={storeId:target.storeId,currency:'GBP',from:'2026-09-01',to:'2026-09-30'};
  const sep=await readProfitEvidence(db,{versionId:p.versionIds['2026-09'],scope:sepScope,readSales});assert.equal(sep.readError,null);
  for(const [key,amount] of Object.entries({cogs:36000,grossProfit:60000,contribution:49600,operatingProfit:46600,ebitda:47200}))assert.equal(sep.result[key].value,amount,key);
  assert.equal(sep.result.sales.netProductSales,96000);assert.equal(sep.result.sales.netShipping,3600);assert.equal(sep.result.sales.originalOrders,12);assert.equal(sep.result.sales.aov.value,8000);
  const octScope={...sepScope,from:'2026-10-01',to:'2026-10-08'};
  const oct=await readProfitEvidence(db,{versionId:'97000000-0000-4000-8000-000000009999',scope:octScope,readSales});assert.equal(oct.readError,'Version scope mismatch');assert.equal(oct.result.sales.netProductSales,24000);assert.equal(oct.result.sales.netShipping,900);assert.equal(oct.result.sales.originalOrders,3);assert.equal(oct.result.operatingProfit.value,null);assert.match(oct.result.reason,/complete calendar month/);
  assert.equal((await db.query("SELECT count(*)::integer n FROM finance_v1.profit_evidence_versions WHERE store_id=$1 AND date_from='2026-10-01'",[target.storeId])).rows[0].n,0);
  await assert.rejects(readSales(db,{...octScope,to:'2026-10-31'}),/coverage/i);
  await assert.rejects(db.exec(p.operatorApplySql),/occupied/);await db.exec('ROLLBACK');
  assert.deepEqual((await db.query('SELECT to_jsonb(o) row FROM public.orders o WHERE store_id=$1 ORDER BY id',[PROFIT_STAGING_IDS.store])).rows,before);
 }finally{await db.close();}
});
