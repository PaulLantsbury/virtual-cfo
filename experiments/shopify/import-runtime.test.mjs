import test from 'node:test';
import assert from 'node:assert/strict';
import {importConnectionOptions,importDatabase,initialiseImportRuntime} from './import-runtime.mjs';
const config={projectRef:'bioalckltvkhlczusdvl',databaseUrl:'postgresql://night_scout_import_login:synthetic@db.bioalckltvkhlczusdvl.supabase.co/postgres',scope:{storeId:'90000000-0000-4000-8000-000000000003',batchId:'93000000-0000-4000-8000-000000000003',from:'2026-02-01',to:'2026-02-28'}};
test('operator configuration binds staging, dedicated login and immutable batch scope',()=>{
 const o=importConnectionOptions(config);assert.equal(o.pool.ssl.rejectUnauthorized,true);assert.equal(o.pool.max,1);assert.ok(Object.isFrozen(o.scope));
 for(const change of [{projectRef:'futkktdebdygsdrcknpr'},{databaseUrl:config.databaseUrl.replace('night_scout_import_login','postgres')},{databaseUrl:config.databaseUrl+'?sslmode=disable'},{scope:{...config.scope,to:'2026-02-30'}}])assert.throws(()=>importConnectionOptions({...config,...change}),/configuration is invalid/);
});
test('uncertain commit discards connection without rerunning work',async()=>{
 let calls=0,discard;const db=importDatabase({connect:async()=>({query:async q=>{if(q==='COMMIT')throw new Error('lost ack');},release:v=>discard=v})});
 await assert.rejects(db.transaction(async()=>{calls++;}),/lost ack/);assert.equal(calls,1);assert.equal(discard,true);
});
test('failed readiness closes pool and exposes no connection details',async()=>{
 let closed=false;
 await assert.rejects(initialiseImportRuntime(config,{createPool:()=>({connect:async()=>({query:async()=>({rows:[{role:'postgres',safe_login:false,unsafe_writes:true,lock_ready:true}]}),release:()=>{}}),end:async()=>{closed=true;}})}),e=>e.message==='Importer could not be initialised');assert.equal(closed,true);
});
