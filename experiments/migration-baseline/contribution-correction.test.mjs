import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {restoreObservedPublic} from './restore.mjs';

const correction=readFileSync(new URL('../../db-migrations/proposed/20260908000001_recoverable_contribution_monthly_only.sql',import.meta.url),'utf8');
const store='20000000-0000-0000-0000-000000000001';
const other='20000000-0000-0000-0000-000000000002';
let db;
beforeEach(async()=>{
  db=new PGlite();
  await restoreObservedPublic(db);
  await db.query(`INSERT INTO public.stores(id,shopify_domain,shopify_store_id) VALUES ($1,'test-a.invalid','test-a'),($2,'test-b.invalid','test-b')`,[store,other]);
});
afterEach(async()=>{await db.close();});
async function add(type,low,high,status='open',scope=store){
  await db.query(`INSERT INTO public.opportunities(store_id,category,title,impact_type,impact_low,impact_high,status) VALUES ($1,'Test','Synthetic test',$2,$3,$4,$5)`,[scope,type,low,high,status]);
}
async function range(scope=store){
  return (await db.query(`SELECT recoverable_low::text low,recoverable_high::text high FROM public.recoverable_contribution_range($1)`,[scope])).rows[0];
}

test('mixed impacts reproduce the defect then return only monthly contribution for the selected store',async()=>{
  await add('monthly_contribution','100','200');
  await add('monthly_contribution','50.25','75.75','in_progress');
  await add('cash_release','10000','20000');
  await add('one_off_profit','5000','6000');
  await add(null,'700','800');
  await add('unknown_future_type','30','40');
  await add('monthly_contribution','999','1999','archived');
  await add('monthly_contribution','888','1888','open',other);
  assert.deepEqual(await range(),{low:'15880.25',high:'27115.75'},'captured live function reproduces mixed-impact defect');
  await db.exec(correction);
  assert.deepEqual(await range(),{low:'150.25',high:'275.75'});
  assert.deepEqual(await range(other),{low:'888.00',high:'1888.00'});
});

test('empty or exclusively nonmonthly/archived inputs retain the legacy zero result',async()=>{
  await db.exec(correction);
  assert.deepEqual(await range(),{low:'0',high:'0'});
  await add('cash_release','10000','20000');
  await add('monthly_contribution','100','200','archived');
  await add(null,'300','400');
  assert.deepEqual(await range(),{low:'0',high:'0'});
  // Preserved legacy SUM/COALESCE behaviour; not certification of missing estimates.
  await add('monthly_contribution',null,null);
  assert.deepEqual(await range(),{low:'0',high:'0'});
});

test('correction preserves records, other objects, function identity and privileges on repeat application',async()=>{
  await add('cash_release','10000','20000');
  await add('monthly_contribution','100','200');
  const snapshot=async()=>({
    catalog:(await db.query(readFileSync(new URL('./capture-public.sql',import.meta.url),'utf8'))).rows[0].catalog,
    grants:(await db.query(readFileSync(new URL('./capture-object-grants.sql',import.meta.url),'utf8'))).rows,
    rows:(await db.query('SELECT * FROM public.opportunities ORDER BY id')).rows,
    identity:(await db.query(`SELECT oid,proowner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid='public.recoverable_contribution_range(uuid)'::regprocedure`)).rows
  });
  const before=await snapshot();
  await db.exec(correction);
  const after=await snapshot();
  const stripTarget=s=>({...s,catalog:{...s.catalog,functions:s.catalog.functions.filter(f=>f.name!=='recoverable_contribution_range')}});
  assert.deepEqual(stripTarget(after),stripTarget(before));
  assert.notEqual(after.catalog.functions.find(f=>f.name==='recoverable_contribution_range').definition,before.catalog.functions.find(f=>f.name==='recoverable_contribution_range').definition);
  await db.exec(correction);
  assert.deepEqual(await snapshot(),after,'repeat application changes nothing');
});
