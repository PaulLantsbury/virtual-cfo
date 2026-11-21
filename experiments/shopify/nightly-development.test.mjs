import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm,chmod} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {setup,sql} from './finance-fixture.mjs';import {INTAKE_TARGET as target} from './intake-runtime.mjs';import {runNightlyDevelopment} from './nightly-development.mjs';
test('launcher checks without collection and a due explicit tick uses existing intake path once',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nightly-'));const file=join(dir,'config.json');const {db}=await setup();
 try{await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.exec(sql('proposals/shopify-sync-history-2026-09-17.sql'));await db.exec(sql('proposals/shopify-nightly-claims-2026-09-17.sql'));
 const scope={storeId:target.storeId,shopId:target.shopId,from:'2026-09-17',to:'2026-09-17'};
 await writeFile(file,JSON.stringify({projectRef:target.projectRef,databaseUrl:`postgresql://night_scout_intake_login:synthetic@db.${target.projectRef}.supabase.co/postgres`,scope}),{mode:0o600});let records=0;
 const deps={now:()=>new Date('2026-09-17T01:00:00Z'),createPool:()=>({connect:async()=>({query:(...a)=>db.query(...a),release(){}}),end:async()=>{}}),check:async args=>{if(args.mode==='record'){records++;return {...scope,status:'replay',batchId:'11111111-1111-4111-8111-111111111111',financeImported:false,coverageCertified:false,reviewRequired:true};}return {};}};
 const checked=await runNightlyDevelopment({configPath:file},deps);assert.equal(checked.state,'prepared_not_installed');assert.equal(records,0);
 const tick={configPath:file,mode:'tick',confirmTarget:`${target.projectRef}/${target.storeId}`};assert.equal((await runNightlyDevelopment(tick,deps)).state,'completed');assert.equal((await runNightlyDevelopment(tick,deps)).state,'already_claimed');assert.equal(records,1);
 await chmod(file,0o644);await assert.rejects(runNightlyDevelopment({configPath:file},deps));assert.equal(records,1);
 }finally{await db.close();await rm(dir,{recursive:true,force:true});}
});

test('resolved rolling window is identical in durable claim, sync journal and intake after a missed day',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nightly-rolling-'));const file=join(dir,'config.json');const {db}=await setup();
 try{
  await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.exec(sql('proposals/shopify-sync-history-2026-09-17.sql'));await db.exec(sql('proposals/shopify-nightly-claims-2026-09-17.sql'));
  let records=0;
  for(const [at,from,to] of [['2026-10-09T01:00:00Z','2026-09-08','2026-10-08'],['2026-10-11T01:00:00Z','2026-09-10','2026-10-10']]){
   const scope={storeId:target.storeId,shopId:target.shopId,from,to};
   await writeFile(file,JSON.stringify({projectRef:target.projectRef,databaseUrl:`postgresql://night_scout_intake_login:synthetic@db.${target.projectRef}.supabase.co/postgres`,scope}),{mode:0o600});
   const deps={now:()=>new Date(at),createPool:()=>({connect:async()=>({query:(...a)=>db.query(...a),release(){}}),end:async()=>{}}),check:async args=>{if(args.mode==='record'){records++;return {...scope,status:'recorded_requires_review',batchId:'11111111-1111-4111-8111-111111111111',financeImported:false,coverageCertified:false,reviewRequired:true};}return {};}};
   const result=await runNightlyDevelopment({configPath:file,mode:'tick',confirmTarget:`${target.projectRef}/${target.storeId}`},deps);assert.equal(result.state,'completed');
   const claim=(await db.query('SELECT date_from::text AS f,date_to::text AS t FROM ingest_v1.nightly_claims ORDER BY local_date DESC LIMIT 1')).rows[0];
   const attempt=(await db.query('SELECT date_from::text AS f,date_to::text AS t FROM ingest_v1.sync_attempts ORDER BY started_at DESC LIMIT 1')).rows[0];
   assert.deepEqual(claim,{f:from,t:to});assert.deepEqual(attempt,{f:from,t:to});
  }
  assert.equal(records,2);assert.equal((await db.query("SELECT count(*)::int n FROM ingest_v1.nightly_claims WHERE local_date='2026-10-10'")).rows[0].n,0);
 }finally{await db.close();await rm(dir,{recursive:true,force:true});}
});
