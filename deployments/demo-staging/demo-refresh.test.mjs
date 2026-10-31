import test from 'node:test';import assert from 'node:assert/strict';import {createDemoRefreshJob} from './demo-refresh.mjs';import {createDemoConnectionPreflight} from './demo-preflight.mjs';import {fixture,tenant} from './demo-fixture.mjs';
test('new reader fences rotation, verifies genuine GBP demo before reports/evidence, and exposes only safe receipt',async()=>{
 const f=fixture(),job=createDemoRefreshJob(f),r=await job();assert.equal(r.state,'supported');assert.equal(f.db.version,2);assert.equal(f.db.lease,null);assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].slice(11,16),[8000,-300,-2000,-500,10320]);assert.ok(f.events.indexOf('rotate')<f.events.indexOf('connections'));assert.ok(f.events.indexOf('preflight-connected')<f.events.indexOf('report'));assert.equal(f.preflights[0][4],'ok');assert.equal(f.events.at(-1),'evidence-supported');assert.doesNotMatch(JSON.stringify(r),/synthetic|token|ciphertext|8000|10320/);const count=f.sql.length;await assert.rejects(job());assert.equal(f.sql.length,count);
});
test('non-demo/wrong currency/arraylike org blocks all accounting/report persistence while retaining encrypted rotation',async()=>{
 for(const options of [{demo:false},{currency:'USD'},{arrayLikeOrg:true},{secondOrgNonDemo:true}]){const f=fixture(options),r=await createDemoRefreshJob(f)();assert.equal(r.state,'failed');assert.equal(f.writes.length,0);assert.equal(f.events.filter(e=>e==='report').length,0);assert.equal(f.db.version,2);assert.equal(f.db.lease,null);assert.equal(f.preflights.at(-1)[2],'failed');}
});
test('wrong store/tenant, missing mapping/job, held/bad lease and unsafe scopes fail closed without rebinding',async()=>{
 for(const options of [{context:{store_id:'other-store'}},{context:{tenant_id:'90000000-0000-4000-8000-000000000005'}},{context:{mapping:null}},{noJob:true},{context:{lease_expires_at:new Date(Date.now()+60000)}},{badLease:new Date(Date.now()-1000)}]){const f=fixture(options);await assert.rejects(createDemoRefreshJob(f)());assert.equal(f.events.includes('token'),false);assert.equal(f.writes.length,0);}
 const f=fixture({scopes:'accounting.transactions offline_access'}),r=await createDemoRefreshJob(f)();assert.equal(r.reason,'insufficient_scope');assert.equal(f.writes.length,0);assert.equal(f.db.version,2);assert.equal(f.events.includes('report'),false);
});
test('real demo with missing accounting data records failure rather than zero supported cash',async()=>{
 const f=fixture({missingCash:true}),r=await createDemoRefreshJob(f)();assert.equal(r.state,'failed');assert.equal(f.writes.length,1);assert.equal(f.writes[0][6],'failed');assert.equal(f.writes[0][15],null);assert.equal(f.preflights[0][2],'connected');
});
test('separate preflight checks demo and never calls accounting persistence',async()=>{
 for(const demo of [true,false]){const f=fixture({demo}),r=await createDemoConnectionPreflight(f)();assert.equal(r.state,demo?'connected':'failed');if(!demo)assert.equal(r.reason,'non_demo_organisation');assert.equal(f.writes.length,0);assert.equal(f.sql.some(s=>s.q.includes('worker_record_accounting')),false);assert.equal(f.db.lease,null);}
});
test('source outage keeps prior supported evidence as stale, never creates zero financial facts',async()=>{
 const f=fixture({reportFailure:true,prior:{source_fingerprint:'a'.repeat(64),report_as_of:'2026-10-29',booked_revenue_minor:'8000',processing_fee_minor:'-300',advertising_minor:'-2000',software_minor:'-500',included_cash_minor:'10320'}}),r=await createDemoRefreshJob(f)();assert.equal(r.state,'stale');assert.equal(f.writes.length,1);assert.equal(f.writes[0][6],'failed');assert.deepEqual(f.writes[0].slice(11,16),[null,null,null,null,null]);assert.equal(f.db.lease,null);
});
test('queued work after hardstop is refused and in-flight token cleanup cannot start further intake',async()=>{
 const f=fixture();let time=new Date('2026-10-30T12:00:00Z');const job=createDemoRefreshJob({...f,clock:()=>time});time=new Date('2026-11-06T03:00:00Z');await assert.rejects(job());assert.equal(f.sql.length,0);assert.equal(f.events.length,0);
 const g=fixture();time=new Date('2026-10-30T12:00:00Z');const fetchImpl=async(url,options)=>{const response=await g.fetchImpl(url,options);if(String(url).endsWith('/token'))time=new Date('2026-11-06T03:00:00Z');return response;};
 const outcome=await createDemoRefreshJob({...g,clock:()=>time,fetchImpl})();assert.equal(outcome.state,'failed');assert.equal(g.db.version,2);assert.equal(g.db.lease,null);assert.equal(g.writes.length,0);assert.equal(g.events.includes('connections'),false);
});
