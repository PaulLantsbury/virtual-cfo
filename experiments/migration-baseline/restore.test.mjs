import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {root,catalog,grants,restoreObservedPublic} from './restore.mjs';

test('all 25 ledger versions have hash-verified recovered repository files',()=>{
  const manifest=JSON.parse(readFileSync(new URL('recovery-manifest.json',root)));
  for(const version of catalog.ledger)assert.equal(manifest.filter(m=>m.version===version).length,1,version);
  for(const entry of manifest)assert.equal(createHash('sha256').update(readFileSync(new URL(entry.file,root))).digest('hex'),entry.sha256,entry.file);
});
test('observed public schema restores empty and accepts the additive proposal',async()=>{
  const db=new PGlite();
  try{
    await restoreObservedPublic(db);
    const captured=(await db.query(readFileSync(new URL('./capture-public.sql',import.meta.url),'utf8'))).rows[0].catalog;
    const ordered=rows=>[...rows].sort((a,b)=>((a.table||'')+a.name).localeCompare((b.table||'')+b.name));
    for(const key of Object.keys(captured))assert.deepEqual(ordered(captured[key]),ordered(catalog[key]),key+' round trips without structural changes');
    const actualGrants=(await db.query(readFileSync(new URL('./capture-object-grants.sql',import.meta.url),'utf8'))).rows;
    const nonOwner=rows=>rows.filter(g=>g.grantee!=='postgres').map(g=>({...g,arguments:g.arguments??''})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    assert.deepEqual(nonOwner(actualGrants),nonOwner(grants),'non-owner object grants preserved');
    const counts=(await db.query(`SELECT
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') tables,
      (SELECT count(*)::int FROM pg_views WHERE schemaname='public') views,
      (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') functions,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') policies`)).rows[0];
    assert.deepEqual(counts,{tables:22,views:5,functions:24,policies:0});
    for(const table of catalog.tables)assert.equal((await db.query(`SELECT count(*)::int n FROM public."${table.name}"`)).rows[0].n,0);
    const current=(await db.query(`SELECT p.proname name,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`)).rows;
    for(const f of catalog.functions)assert.equal(current.find(c=>c.name===f.name).definition,f.definition,f.name);
    assert.equal((await db.query(`SELECT public.net_sales('10000000-0000-0000-0000-000000000001','2026-04-01','2026-04-30')::text AS n`)).rows[0].n,'0');
    await db.query('SELECT * FROM public.v_month_on_month LIMIT 1');
    const before=(await db.query(`SELECT p.proname,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1`)).rows;
    await db.exec(readFileSync(new URL('../../db-migrations/proposed/finance_v1_sales_evidence.sql',import.meta.url),'utf8'));
    const after=(await db.query(`SELECT p.proname,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1`)).rows;
    assert.deepEqual(after,before,'proposal leaves existing functions unchanged');
    assert.equal((await db.query('SELECT count(*)::int n FROM finance_v1.order_evidence')).rows[0].n,0);
  }finally{await db.close();}
});
