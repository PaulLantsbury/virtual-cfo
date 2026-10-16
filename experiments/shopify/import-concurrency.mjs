import {importSubsequentEvidence} from './import-subsequent-evidence.mjs';
import {subsequentCandidate} from './subsequent-fixture.mjs';
import {sql} from './finance-fixture.mjs';
import assert from 'node:assert/strict';
import {importFixture} from './import-fixture.mjs';
import {importFirstEvidence} from './import-first-evidence.mjs';
const outcome=p=>p.then(value=>({value}),error=>({error}));
const barrier=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const importer=(client,afterLock,pauseAt='SELECT ingest_v1.lock_import_dependencies()')=>({transaction:async fn=>{
 await client.query('BEGIN');try{
 await client.query('SET LOCAL ROLE night_scout_import_service');
 const result=await fn({query:async(...args)=>{const r=await client.query(...args);if(args[0].startsWith(pauseAt))await afterLock?.();return r;}});
 await client.query('COMMIT');return result;
 }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}
}});
export async function runImportChecks({admin,connect,adapter,waiting}){
 for(const [index,name] of ['import_race','import_disconnect','append_race','append_disconnect'].entries()){
  await admin.query(`CREATE DATABASE ${name}`);
  const owner=await connect(name),first=await connect(name),second=await connect(name);
  first.on('error',()=>{});
  try{
   let {input}=await importFixture(adapter(owner),{createRoles:false,reuseImportRole:index>0});
   const append=name.startsWith('append_'),disconnect=name.endsWith('disconnect');
   const writer=append?importSubsequentEvidence:importFirstEvidence;
   if(append){await owner.query(sql('proposed/ingest_v1_incremental_receipts.sql'));await importFirstEvidence(adapter(owner),input);input=await subsequentCandidate(adapter(owner),input,'refund');}
   const locked=barrier(),release=barrier();
   const a=outcome(writer(importer(first,async()=>{locked.resolve();await release.promise;},disconnect?'INSERT INTO finance_v1.coverage_evidence':'SELECT ingest_v1.lock_import_dependencies()'),input));
   await Promise.race([locked.promise,a.then(r=>{throw r.error??new Error('Import ended before barrier');})]);
   const b=outcome(writer(importer(second),input));
   try{await waiting(owner,second);
    if(disconnect)await owner.query('SELECT pg_terminate_backend($1)',[first.processID]);
   }finally{release.resolve();}
   const ar=await a,br=await b;
   if(!disconnect){assert.equal(ar.value?.status,'imported_awaiting_review');assert.equal(br.value?.status,'already_imported');}
   else{assert.ok(ar.error);assert.equal(br.value?.status,'imported_awaiting_review');}
   // Simulate a lost success acknowledgement: discard the earlier result and retry.
   assert.equal((await writer(importer(second),input)).status,'already_imported');
   const counts=(await owner.query('SELECT (SELECT count(*) FROM public.orders WHERE store_id=$1)::int orders,(SELECT count(*) FROM public.refunds WHERE store_id=$1)::int refunds,(SELECT count(*) FROM ingest_v1.import_receipts)::int receipts',[input.storeId])).rows[0];
   assert.deepEqual(counts,append?{orders:1,refunds:2,receipts:2}:{orders:1,refunds:1,receipts:1});
   assert.equal((await owner.query('SELECT sales_and_refunds_complete FROM finance_v1.coverage_evidence WHERE store_id=$1',[input.storeId])).rows[0].sales_and_refunds_complete,false);
   console.log(`PASS ${name}: observed contention, single import/receipt and safe explicit retry`);
  }finally{await Promise.allSettled([owner.end(),first.end(),second.end()]);}
 }
}
