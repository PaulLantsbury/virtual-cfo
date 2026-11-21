import test from 'node:test';
import assert from 'node:assert/strict';
import {checkIntakeStoreLock} from './intake-lock-check.mjs';
import {INTAKE_TARGET as t} from './intake-runtime.mjs';
const config={projectRef:t.projectRef,databaseUrl:`postgresql://night_scout_intake_login:synthetic@db.${t.projectRef}.supabase.co/postgres`,scope:{storeId:t.storeId,shopId:t.shopId,from:'2026-09-17',to:'2026-09-17'}};
function fixture({block=true,code='55P03'}={}){
 const queries=[],pools=[];let secondLocks=0;
 const createPool=options=>{const n=pools.length;const p={ended:false,released:false,options,end:async()=>{p.ended=true;},connect:async()=>({release:()=>{p.released=true;},query:async q=>{queries.push(q);if(q.startsWith('SELECT current_user'))return {rows:[{role:'night_scout_intake_service',login:'night_scout_intake_login'}]};if(n===1&&q.startsWith('SELECT ingest_v1.lock')){secondLocks++;if(secondLocks===1&&block)throw Object.assign(Error('private secret'),{code});}return {rows:[]};}})};pools.push(p);return p;};
 return {queries,pools,createPool};
}
test('explicit gate prevents any connection; two-session check rolls back and closes',async()=>{
 const f=fixture();await assert.rejects(checkIntakeStoreLock(config,{createPool:f.createPool}),/confirmation/);assert.equal(f.pools.length,0);
 const r=await checkIntakeStoreLock(config,{createPool:f.createPool,confirmTarget:`${t.projectRef}/${t.storeId}`});assert.equal(r.status,'lock_contention_verified');assert.equal(r.candidateReplayVerified,false);assert.equal(f.pools.length,2);assert.ok(f.pools.every(p=>p.ended&&p.released&&p.options.max===1));assert.ok(f.queries.every(q=>!/^(INSERT|UPDATE|DELETE|COMMIT)/.test(q)));
});
test('missing contention or wrong SQL error fails without leaking details and closes both pools',async()=>{
 for(const options of [{block:false},{code:'XX000'}]){const f=fixture(options);await assert.rejects(checkIntakeStoreLock(config,{createPool:f.createPool,confirmTarget:`${t.projectRef}/${t.storeId}`}),e=>e.message==='Staging intake lock check failed; no acceptance recorded');assert.ok(f.pools.every(p=>p.ended&&p.released));}
});
