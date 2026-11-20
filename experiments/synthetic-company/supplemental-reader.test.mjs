import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupplementalService,supplementalDigest} from './supplemental-reader.mjs';
import {HISTORY_EDITION} from './history-context.mjs';
const scope={storeId:'10000000-0000-4000-8000-000000000001',currency:'GBP',from:'2026-10-01',to:'2026-10-31'};
const selection={edition:HISTORY_EDITION,versionId:'20000000-0000-4000-8000-000000000001'};
const userId='30000000-0000-4000-8000-000000000001',snapshotId='40000000-0000-4000-8000-000000000001';
const now=()=>new Date('2026-11-20T18:00:00Z');
function fixture({member=true,validAuth=true,kind='cash',validator=()=>true}={}){
 const financial={state:'supported',contract:'history-v2-proposal',versionId:selection.versionId,scope:structuredClone(scope),metadata:{edition:HISTORY_EDITION,sourceBasis:'synthetic-local',verification:'canonical-source-revision-only'},salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64)};
 const body={contract:'reviewed-supplement-v1',kind,scope:{...scope,timezone:'Europe/London'},financialVersionId:selection.versionId,salesRevision:financial.salesRevision,costRevision:financial.costRevision,sourceBasis:'synthetic-local',observedAt:'2026-11-20T17:00:00Z',payload:{contract:'test-only',pence:100,count:2}};
 const row={snapshot_id:snapshotId,store_id:scope.storeId,scope_from:scope.from,scope_to:scope.to,kind,financial_version:selection.versionId,sales_revision:financial.salesRevision,cost_revision:financial.costRevision,body,body_hash:supplementalDigest(body),observed_at:new Date(body.observedAt),invalidated:false};
 const calls=[],authCalls=[];let rows=[row],authValid=validAuth,hasMember=member;
 const tx={exec:async sql=>{calls.push({sql});},query:async(sql,args)=>{calls.push({sql,args});if(sql.includes('set_config'))return {rows:[{}]};if(sql.includes('public.store_memberships'))return {rows:hasMember?[{store_id:scope.storeId}]:[]};if(sql.includes('finance_review_supplement_v1.snapshots'))return {rows};if(sql.includes('finance_history_v2.contracts'))return {rows:[]};if(sql.includes('public.stores'))return {rows:[]};throw Error('Unexpected SQL private-secret');}};
 const db={transaction:async fn=>{calls.push({transaction:true});return fn(tx);}};
 const auth={auth:{getUser:async token=>{authCalls.push(token);return authValid?{data:{user:{id:userId,is_anonymous:false}}}:{error:new Error('private-auth-token'),data:{user:null}};}}};
 const options={now,validators:{[kind]:validator},readHistory:async(gotTx,gotScope,opts)=>{calls.push({canonical:true});assert.equal(gotTx,tx);assert.deepEqual(gotScope,scope);assert.deepEqual(opts.selection,selection);assert.equal(+opts.now(),+now());return structuredClone(financial);}};
 return {service:createSupplementalService(db,auth,options),db,auth,options,financial,row,calls,authCalls,setRows:v=>{rows=v;},setAuth:v=>{authValid=v;},setMember:v=>{hasMember=v;},rehash:()=>{row.body_hash=supplementalDigest(row.body);}};
}
test('both kinds require authenticated membership and read canonical source in same read-only transaction',async()=>{
 for(const kind of ['cash','acquisition']){
  const h=fixture({kind});const result=await h.service.read(scope,'Bearer token',selection,kind);
  assert.equal(result.state,'supported');assert.equal(result.snapshotId,snapshotId);assert.deepEqual(result.payload,h.row.body.payload);assert.equal('financial' in result,false);
  assert.equal(h.calls[1].sql,'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');assert.match(h.calls[2].sql,/set_config/);assert.deepEqual(h.calls[2].args,[userId]);
  assert.match(h.calls[3].sql,/public.store_memberships/);assert.equal(h.calls[4].canonical,true);assert.match(h.calls[5].sql,/finance_review_supplement_v1.snapshots/);
  assert.deepEqual(h.calls[5].args,[scope.storeId,scope.from,scope.to,kind,selection.versionId]);assert.ok(h.calls.filter(c=>c.sql).every(c=>!/INSERT|UPDATE|DELETE|GRANT|CREATE|ALTER/.test(c.sql)));
  result.payload.pence=999;assert.equal(h.row.body.payload.pence,100);
 }
});
test('missing authentication or membership never reads financial or supplemental records',async()=>{
 const h=fixture();await assert.rejects(h.service.read(scope,'',selection,'cash'),/sign-in required/);assert.equal(h.calls.length,0);
 h.setAuth(false);await assert.rejects(h.service.read(scope,'Bearer private',selection,'cash'),/sign-in could not be verified/);assert.equal(h.calls.length,0);
 h.setAuth(true);h.setMember(false);await assert.rejects(h.service.read(scope,'Bearer token',selection,'cash'),/Supplemental store membership required/);assert.equal(h.calls.some(c=>c.canonical),false);assert.equal(h.calls.some(c=>c.sql?.includes('snapshots')),false);
});
test('Auth and membership are checked anew on every request, with no cached previous identity',async()=>{
 const h=fixture();assert.equal((await h.service.read(scope,'Bearer first',selection,'cash')).state,'supported');h.setAuth(false);await assert.rejects(h.service.read(scope,'Bearer second',selection,'cash'),/sign-in/);assert.deepEqual(h.authCalls,['first','second']);
 h.setAuth(true);h.setMember(false);await assert.rejects(h.service.read(scope,'Bearer third',selection,'cash'),/membership/);
});
test('request rejects broader/extra scopes, currencies, periods, invalid editions/versions/kinds before any access',async()=>{
 const h=fixture();for(const bad of [{...scope,currency:'USD'},{...scope,timezone:'Europe/London'},{...scope,from:'2026-10-02'},{...scope,to:'2026-10-30'},{...scope,storeId:'bad'}])await assert.rejects(h.service.read(bad,'Bearer token',selection,'cash'));
 for(const bad of [undefined,{...selection,edition:'other'},{...selection,versionId:'bad'},{...selection,userId}])await assert.rejects(h.service.read(scope,'Bearer token',bad,'cash'));
 await assert.rejects(h.service.read(scope,'Bearer token',selection,'provider'));assert.equal(h.calls.length,0);assert.equal(h.authCalls.length,0);
});
test('invalidated or changed financial version/source cannot release a supplemental snapshot',async()=>{
 const changes=[f=>{f.state='unavailable';},f=>{f.versionId='20000000-0000-4000-8000-000000000002';},f=>{f.scope.storeId='10000000-0000-4000-8000-000000000002';},f=>{f.scope.from='2026-09-01';},f=>{f.metadata.sourceBasis='provider';},f=>{f.metadata.verification='cached';},f=>{f.salesRevision='c'.repeat(64);},f=>{f.costRevision='d'.repeat(64);}];
 for(const change of changes){const h=fixture();change(h.financial);assert.equal((await h.service.read(scope,'Bearer token',selection,'cash')).state,'unavailable');}
});
test('row indexes, canonical digest, invalidation and uniqueness are independently enforced',async()=>{
 const changes=[r=>{r.invalidated=true;},r=>{r.snapshot_id='bad';},r=>{r.store_id='10000000-0000-4000-8000-000000000002';},r=>{r.scope_from='2026-09-01';},r=>{r.scope_to='2026-09-30';},r=>{r.kind='acquisition';},r=>{r.financial_version='20000000-0000-4000-8000-000000000002';},r=>{r.sales_revision='c'.repeat(64);},r=>{r.cost_revision='d'.repeat(64);},r=>{r.body_hash='e'.repeat(64);},r=>{r.body.payload.pence++;}];
 for(const change of changes){const h=fixture();change(h.row);assert.equal((await h.service.read(scope,'Bearer token',selection,'cash')).state,'unavailable');}
 for(const n of [0,2]){const h=fixture();h.setRows(n?[h.row,h.row]:[]);assert.equal((await h.service.read(scope,'Bearer token',selection,'cash')).state,'unavailable');}
});
test('rehashed malicious envelope cannot change scope, basis, kind, financial revisions or observation authority',async()=>{
 const changes=[b=>{b.scope.timezone='UTC';},b=>{b.scope.currency='USD';},b=>{b.scope.storeId='10000000-0000-4000-8000-000000000002';},b=>{b.financialVersionId='20000000-0000-4000-8000-000000000002';},b=>{b.salesRevision='c'.repeat(64);},b=>{b.costRevision='d'.repeat(64);},b=>{b.sourceBasis='provider';},b=>{b.kind='acquisition';},b=>{b.extra='unexpected';},b=>{b.payload=[];},b=>{b.observedAt='2026-11-21T17:00:00Z';},b=>{b.observedAt='2026-10-31T00:00:00Z';},b=>{b.observedAt='2026-11-20T17:00:00';}];
 for(const change of changes){const h=fixture();change(h.row.body);h.row.observed_at=h.row.body.observedAt;h.rehash();assert.equal((await h.service.read(scope,'Bearer token',selection,'cash')).state,'unavailable');}
 const h=fixture();h.row.observed_at='2026-11-20T16:59:59Z';assert.equal((await h.service.read(scope,'Bearer token',selection,'cash')).state,'unavailable');
});
test('kind validators are mandatory, strict synchronous boolean and mutation isolated',async()=>{
 for(const validator of [()=>false,()=>null,()=>({state:'supported'}),async()=>true,async()=>{throw Error('private async detail');},()=>{throw Error('private validator detail');}]){const h=fixture({validator});assert.equal((await h.service.read(scope,'Bearer token',selection,'cash')).state,'unavailable');}
 const absent=fixture();const service=createSupplementalService(absent.db,absent.auth,{...absent.options,validators:{}});assert.equal((await service.read(scope,'Bearer token',selection,'cash')).state,'unavailable');assert.equal(absent.calls.some(c=>c.canonical),false);
 const mutated=fixture({validator:(payload,financial)=>{payload.pence=500;financial.scope.storeId='other';return true;}});const result=await mutated.service.read(scope,'Bearer token',selection,'cash');assert.equal(result.payload.pence,100);assert.equal(result.scope.storeId,scope.storeId);
});
test('low-level source/database errors fail closed without leaking diagnostics or payloads',async()=>{
 const h=fixture();const service=createSupplementalService(h.db,h.auth,{...h.options,readHistory:async()=>{throw Error('SECRET SQL and account value');}});const result=await service.read(scope,'Bearer token',selection,'cash');assert.equal(result.state,'unavailable');assert.doesNotMatch(JSON.stringify(result),/SECRET|account|SQL|pence/);
 const defaultReader=createSupplementalService(h.db,h.auth,{now,validators:{cash:()=>true}});assert.equal((await defaultReader.read(scope,'Bearer token',selection,'cash')).state,'unavailable');assert.equal(h.calls.some(c=>c.sql?.includes('finance_history_v2.contracts')),true);
});
test('canonical digest is order-independent and rejects unsafe, oversized or non-JSON inputs',()=>{
 assert.equal(supplementalDigest({z:1,a:{b:2,a:3}}),supplementalDigest({a:{a:3,b:2},z:1}));
 const cyclic={};cyclic.self=cyclic;const accessorArray=[1];Object.defineProperty(accessorArray,'0',{get(){throw Error('array getter executed');}});const symbolArray=[1];symbolArray[Symbol('hidden')]=true;const getter={};Object.defineProperty(getter,'value',{enumerable:true,get(){throw Error('getter executed');}});
 for(const value of [undefined,NaN,Infinity,1.1,-0,Number.MAX_SAFE_INTEGER+1,{x:undefined},{x:()=>1},new Date(),cyclic,getter,accessorArray,symbolArray,JSON.parse('{"__proto__":{}}'),{constructor:'x'},Array(2),{text:'x'.repeat(1024*1024+1)},Object.create(null)])assert.throws(()=>supplementalDigest(value));
 let depth={};for(let i=0;i<34;i++)depth={child:depth};assert.throws(()=>supplementalDigest(depth));
});

test('custom array prototypes cannot inject inherited JSON serialisation into source digests',()=>{const values=[1];Object.setPrototypeOf(values,{toJSON(){return [2];}});assert.throws(()=>supplementalDigest({values}),/array prototype/);});

const reserved='d7500000-0000-4000-8000-000000000009';
function matureFixture({from='2026-10-01',to='2026-10-31',storeId=reserved}={}){
 const h=fixture({kind:'acquisition'}),boundScope={storeId,currency:'GBP',from,to};
 const dependencies=Array.from({length:6},(_,i)=>({from:`2026-${String(i+4).padStart(2,'0')}-01`,to:new Date(Date.UTC(2026,i+4,0)).toISOString().slice(0,10),versionId:`21000000-0000-4000-8000-${String(i+4).padStart(12,'0')}`,salesRevision:'a'.repeat(64),costRevision:'b'.repeat(64)}));
 const currentSelection={...selection,versionId:from==='2026-09-01'?dependencies[5].versionId:selection.versionId};
 h.row.store_id=storeId;h.row.scope_from=from;h.row.scope_to=to;h.row.financial_version=currentSelection.versionId;
 h.row.body.scope={...boundScope,timezone:'Europe/London'};h.row.body.financialVersionId=currentSelection.versionId;
 h.row.body.payload.economics={policy:'test-only',first:{},mature:{scope:{from:'2026-04-01',to:'2026-06-30',observedThrough:'2026-09-30'}},dependencies,source:{}};
 h.financial.scope=structuredClone(boundScope);h.financial.versionId=currentSelection.versionId;
 h.financial.profit={state:'complete'};h.financial.components={cogs:100,variableCosts:10,advertising:10,overheadIncludingDA:10,depreciationAmortisation:1};
 h.rehash();const reads=[];let txIdentity;
 const behavior=new Map();
 const readHistory=async(tx,readScope,options)=>{
  if(!txIdentity)txIdentity=tx;else assert.equal(tx,txIdentity,'All dependency reads must share the original transaction');
  assert.equal(+options.now(),+now());reads.push({scope:structuredClone(readScope),selection:structuredClone(options.selection)});
  if(readScope.from===from&&readScope.to===to&&options.selection.versionId===currentSelection.versionId)return structuredClone(h.financial);
  const d=dependencies.find(d=>d.from===readScope.from);assert.ok(d);assert.deepEqual(readScope,{storeId:reserved,currency:'GBP',from:d.from,to:d.to});assert.deepEqual(options.selection,{edition:HISTORY_EDITION,versionId:d.versionId});
  const result={...structuredClone(h.financial),scope:structuredClone(readScope),versionId:d.versionId};
  const change=behavior.get(d.from);return change?change(result):result;
 };
 return {...h,boundScope,currentSelection,reads,behavior,dependencies,service:createSupplementalService(h.db,h.auth,{...h.options,readHistory})};
}
test('mature cohort validates all six exact source months canonically inside the same read-only transaction',async()=>{
 const h=matureFixture();const before=structuredClone(h.row.body.payload);const result=await h.service.read(h.boundScope,'Bearer valid',h.currentSelection,'acquisition');
 assert.equal(result.state,'supported');assert.equal(h.reads.length,7);assert.deepEqual(h.reads.slice(1).map(r=>r.scope.from),['2026-04-01','2026-05-01','2026-06-01','2026-07-01','2026-08-01','2026-09-01']);
 assert.deepEqual(result.payload,before);assert.deepEqual(h.row.body.payload,before);assert.ok(h.calls.filter(c=>c.sql).every(c=>!/INSERT|UPDATE|DELETE|GRANT|CREATE|ALTER/.test(c.sql)));
});
test('selected September financial source is reused without another canonical read',async()=>{
 const h=matureFixture({from:'2026-09-01',to:'2026-09-30'});assert.equal((await h.service.read(h.boundScope,'Bearer valid',h.currentSelection,'acquisition')).state,'supported');assert.equal(h.reads.length,6);assert.equal(h.reads.filter(r=>r.scope.from==='2026-09-01').length,1);
});
test('earlier cohort financial changes, invalidation, missing evidence or incomplete costs withhold the entire supplement',async()=>{
 for(const change of [r=>({...r,costRevision:'c'.repeat(64)}),r=>({...r,salesRevision:'d'.repeat(64)}),r=>({...r,state:'unavailable'}),()=>null,r=>({...r,scope:{...r.scope,storeId:'10000000-0000-4000-8000-000000000002'}}),r=>({...r,versionId:'22000000-0000-4000-8000-000000000002'}),r=>({...r,profit:{state:'incomplete'}}),r=>({...r,components:{...r.components,variableCosts:null}})]){
  const h=matureFixture();h.behavior.set('2026-04-01',change);const result=await h.service.read(h.boundScope,'Bearer valid',h.currentSelection,'acquisition');assert.equal(result.state,'unavailable');assert.equal('payload'in result,false);assert.equal(h.reads.length,2);
 }
});
test('missing, excessive, duplicate, gapped, wrong-period or extra-company dependency entries fail before additional reads',async()=>{
 const changes=[e=>{delete e.dependencies;},e=>{e.dependencies=e.dependencies.slice(1);},e=>{e.dependencies.push(structuredClone(e.dependencies[0]));},e=>{e.dependencies[1]=structuredClone(e.dependencies[0]);},e=>{e.dependencies[0].from='2026-03-01';},e=>{e.dependencies[0].to='2026-04-29';},e=>{e.dependencies[0].versionId='invalid';},e=>{e.dependencies[0].costRevision='invalid';},e=>{e.dependencies[0].storeId=reserved;}];
 for(const change of changes){const h=matureFixture();change(h.row.body.payload.economics);h.rehash();assert.equal((await h.service.read(h.boundScope,'Bearer valid',h.currentSelection,'acquisition')).state,'unavailable');assert.equal(h.reads.length,1);}
 const other=matureFixture({storeId:'10000000-0000-4000-8000-000000000002'});assert.equal((await other.service.read(other.boundScope,'Bearer valid',other.currentSelection,'acquisition')).state,'unavailable');assert.equal(other.reads.length,1);
});
test('absent mature cohort requires an explicit empty dependency list and adds no source reads',async()=>{
 const h=matureFixture();h.row.body.payload.economics.mature=null;h.row.body.payload.economics.dependencies=[];h.rehash();assert.equal((await h.service.read(h.boundScope,'Bearer valid',h.currentSelection,'acquisition')).state,'supported');assert.equal(h.reads.length,1);
 const bad=matureFixture();bad.row.body.payload.economics.mature=null;bad.rehash();assert.equal((await bad.service.read(bad.boundScope,'Bearer valid',bad.currentSelection,'acquisition')).state,'unavailable');
});
