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
