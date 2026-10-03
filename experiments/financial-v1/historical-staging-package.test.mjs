import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,U} from '../shopify/finance-fixture.mjs';
import {prepareHistoricalStagingPackage,HISTORICAL_STAGING_TARGET as target,HISTORICAL_STAGING_TABLES as tables} from './historical-staging-package.mjs';
import {readProfitEvidence} from './profit-evidence-reader.mjs';
import {createProfitSalesReader} from './profit-sales-reader.mjs';
import {PERIODS} from './historical-testing-fixture.mjs';
const options={...target,reviewerId:U};
let packagePromise;
const prepared=()=>packagePromise??=prepareHistoricalStagingPackage(options);
async function database(){const {db}=await setup(undefined,{installIntake:false});await db.exec(sql('proposals/20260913_profit_evidence.sql'));return db;}
async function attestation(db,project=target.project,reviewer=U){await db.query("SELECT set_config('night_scout.approved_project',$1,false),set_config('night_scout.approved_reviewer',$2,false)",[project,reviewer]);}
async function snapshot(db){const data={};for(const table of tables)data[table]=(await db.query(`SELECT to_jsonb(t)::text r FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;return data;}
async function refused(db,text,pattern){await assert.rejects(db.exec(text),pattern);await db.exec('ROLLBACK');}
const expected=[
 ['2025-08',48000,18000,30000,24800,21800,22400],['2025-09',72000,27000,45000,37200,34200,34800],['2025-10',72000,27000,45000,37200,34200,34800],['2025-11',96000,36000,60000,49600,46600,47200],['2025-12',120000,45000,75000,62000,59000,59600],['2026-01',48000,18000,30000,24800,21800,22400],['2026-02',46000,18000,28000,22700,19700,20300],['2026-03',69000,27000,42000,33800,30800,31400],['2026-04',72000,25500,46500,38700,35700,36300],['2026-05',72000,27000,45000,37200,34200,34800],['2026-06',96000,36000,60000,49600,46600,47200],['2026-07',96000,36000,60000,49600,46600,47200],['2026-08',96000,36000,60000,49600,46600,47200],
];
test('Package is deterministic, has no schema/auth/grant changes and rejects unapproved targets',async()=>{
 const first=await prepared(),second=await prepareHistoricalStagingPackage(options);assert.deepEqual(first,second);
 assert.equal(first.status,'prepared-only');assert.equal(first.rows['public.orders'],132);assert.equal(first.rows['public.refunds'],2);assert.equal(first.rows['finance_v1.coverage_evidence'],15);assert.equal(first.rows['finance_v1.profit_evidence_versions'],13);
 assert.doesNotMatch(first.applySql,/CREATE TABLE|ALTER TABLE|INSERT INTO auth\.|\bGRANT\b|\bDELETE FROM\b|\bUPDATE public\./i);
 assert.match(first.rehearsalSql,/ROLLBACK;\n$/);assert.match(first.applySql,/COMMIT;\n$/);
 for(const override of [{project:'futkktdebdygsdrcknpr'},{host:'db.futkktdebdygsdrcknpr.supabase.co'},{database:'other'},{reviewerId:undefined},{reviewerId:"bad' OR true"}])await assert.rejects(prepareHistoricalStagingPackage({...options,...override}),/required/);
});
test('Generated SQL rehearses without residue and applies exact stored evidence in disposable PostgreSQL only',async()=>{
 const p=await prepared(),db=await database();try{
  const before=await snapshot(db);await attestation(db);await db.exec(p.preflightSql);await db.exec(p.rehearsalSql);assert.deepEqual(await snapshot(db),before);
  await db.exec(p.applySql);await db.exec(p.postflightSql);
  const after=await snapshot(db);
  for(const [table,rows]of Object.entries(before))assert.ok(rows.every(r=>after[table].some(a=>a.r===r.r)),`Existing ${table} preserved`);
  const readSales=createProfitSalesReader({userId:U});
  for(const [month,sales,cogs,gross,contribution,operating,ebitda]of expected){
   const day=PERIODS.find(p=>p[0]===month)[2],scope={storeId:target.storeId,currency:'GBP',from:`${month}-01`,to:`${month}-${day}`};
   const r=await readProfitEvidence(db,{versionId:p.versionIds[month],scope,readSales});assert.equal(r.readError,null,month);assert.equal(r.result.sales.netProductSales,sales);assert.equal(r.result.sales.aov.value,8000);
   for(const [key,value]of Object.entries({cogs,grossProfit:gross,contribution,operatingProfit:operating,ebitda})){assert.equal(r.result[key].state,'ready');assert.equal(r.result[key].value,value,`${month}/${key}`);}
  }
  const partial=await readProfitEvidence(db,{versionId:p.versionIds['2026-09'],scope:{storeId:target.storeId,currency:'GBP',from:'2026-09-01',to:'2026-09-17'},readSales});assert.equal(partial.result.sales.netProductSales,48000);assert.equal(partial.result.operatingProfit.value,null);assert.match(partial.result.reason,/complete calendar month/);
  await refused(db,p.applySql,/occupied/);assert.deepEqual(await snapshot(db),after);
  await db.query('UPDATE public.overhead_entries SET amount=amount+1 WHERE id=(SELECT id FROM public.overhead_entries WHERE store_id=$1 LIMIT 1)',[target.storeId]);await refused(db,p.postflightSql,/fingerprint mismatch/);
 }finally{await db.close();}
});
test('Missing reviewer, wrong target, dirty target and schema drift stop before any imported rows',async()=>{
 const p=await prepared(),db=await database();try{
  const before=await snapshot(db);
  await refused(db,p.applySql,/attestation/);assert.deepEqual(await snapshot(db),before);
  await attestation(db,'futkktdebdygsdrcknpr');await refused(db,p.applySql,/attestation/);assert.deepEqual(await snapshot(db),before);
  await attestation(db);await db.query('DELETE FROM public.store_memberships WHERE user_id=$1',[U]);const missing=await snapshot(db);await refused(db,p.applySql,/Existing approved reviewer/);assert.deepEqual(await snapshot(db),missing);
  await db.query('INSERT INTO public.store_memberships(user_id,store_id) VALUES($1,$2)',[U,'90000000-0000-4000-8000-000000000001']);
  await db.query('INSERT INTO public.stores(id,shopify_domain,shopify_store_id) VALUES($1,$2,$3)',[target.storeId,target.domain,'dirty-fixture']);const dirty=await snapshot(db);await refused(db,p.applySql,/occupied/);assert.deepEqual(await snapshot(db),dirty);
 }finally{await db.close();}
 const drift=await database();try{await attestation(drift);await drift.exec('ALTER TABLE public.orders ADD COLUMN unexpected text');const before=await snapshot(drift);await refused(drift,p.applySql,/schema contract differs/);assert.deepEqual(await snapshot(drift),before);}finally{await drift.close();}
});
