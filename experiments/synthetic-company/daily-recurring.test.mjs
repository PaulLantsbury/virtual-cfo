/** Operator control-flow tests with an explicit in-memory PostgreSQL contract fixture; no live database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {operateDaily,OPERATOR_PURPOSE,OPERATOR_CLOCK_SQL} from './daily-operator.mjs';
import {DAILY_PROGRAMME_PURPOSE,DAILY_PROGRAMME_SCOPE} from './daily-programme.mjs';
import {DAILY_FUNCTION_CONTRACT,DAILY_PROTECTED_TABLES,capabilityDigest} from './daily-capability-preflight.mjs';
import {addDays} from './generator.mjs';

const caller='daily_capability_invoker',owner='daily_capability_owner',reviewer='daily_capability_reviewer',login='recurring_fixture_login';
const protection=t=>capabilityDigest(JSON.stringify({policies:t.policies,triggers:t.triggers,rls:t.rls,forceRls:t.forceRls,columns:t.columns,constraints:t.constraints}));
function clockAt(iso){
 const now=new Date(iso),parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hourCycle:'h23',hour:'2-digit',minute:'2-digit'}).formatToParts(now);
 const part=name=>parts.find(p=>p.type===name).value;
 const london_day=`${part('year')}-${part('month')}-${part('day')}`;
 return {server_now:iso,london_day,cutoff:addDays(london_day,-1),london_hour:Number(part('hour')),london_minute:Number(part('minute'))};
}
function fixture(options={}){
 const catalog={schemaPresent:true,schemaOwner:reviewer,schemaPrivileges:[{grantee:caller,privilege:'USAGE'},{grantee:owner,privilege:'USAGE'},{grantee:reviewer,privilege:'USAGE'},{grantee:reviewer,privilege:'CREATE'}],roles:[caller,owner,reviewer,login].map(name=>({name,login:name===login,superuser:false,bypassRls:false,createRole:false,createDb:false,replication:false,inherit:false})),memberships:[{role:caller,member:login,adminOption:false,inheritOption:false,setOption:true}],functions:[],tables:[],unsafeOtherFunctions:[],auditedPrincipals:[caller,owner,login],boundLoginPrivileges:[],unsafeSchemaCreate:[],unsafeSequencePrivileges:[],unsafeSecurityDefinerExecute:[]};
 for(const spec of DAILY_FUNCTION_CONTRACT)catalog.functions.push({...spec,owner,securityDefiner:true,definition:'reviewed recurring control-flow fixture '+spec.name,settings:spec.name==='append_completed_day'?['search_path=pg_catalog','lock_timeout=5s']:['search_path=pg_catalog'],executeGrantees:[owner,...(spec.caller?[caller]:[])]});
 for(const name of DAILY_PROTECTED_TABLES)catalog.tables.push({schema:'finance_history_v2',name,kind:'r',owner:'separate_fixture_owner',rls:true,forceRls:false,callerSelect:false,callerDml:false,callerColumnUpdate:false,ownerSelect:true,ownerDeleteTruncate:false,ownerInsert:!['contracts','invalidations'].includes(name),ownerColumnInsert:!['contracts','invalidations'].includes(name),ownerUpdateColumns:name==='contracts'?['through_day']:[],policies:[],triggers:[],columns:[],constraints:[]});
 for(const name of ['programme','reviewed_days','publication_receipts'])catalog.tables.push({schema:'finance_daily_v1',name,kind:'r',owner:reviewer,rls:true,forceRls:false,callerSelect:false,callerDml:false,callerColumnUpdate:false,ownerSelect:true,ownerDeleteTruncate:false,ownerInsert:name==='publication_receipts',ownerColumnInsert:name==='publication_receipts',ownerUpdateColumns:[],policies:[],triggers:[],columns:[],constraints:[]});
 const initialThrough=options.initialThrough??'2026-11-18';
 const programme={purpose:DAILY_PROGRAMME_PURPOSE,scope:{...DAILY_PROGRAMME_SCOPE},initialThrough,ceiling:addDays(initialThrough,2),days:[1,2].map((n)=>({day:addDays(initialThrough,n),expectedThrough:addDays(initialThrough,n-1),materialSha256:String(n).repeat(64),reviewRef:`reviewed-fixture:day-${n}`}))};
 const binding={purpose:OPERATOR_PURPOSE,syntheticOnly:true,scope:{...DAILY_PROGRAMME_SCOPE},connection:{host:'/private/tmp/night-scout-not-a-real-socket',port:5432,database:'postgres',user:login,password:'',ssl:false},initialThrough,ceiling:programme.ceiling,appendApproved:true,programme,
  expected:{callerRole:caller,ownerRole:owner,schemaOwner:reviewer,memberships:catalog.memberships,functionHashes:Object.fromEntries(catalog.functions.map(f=>[f.name,capabilityDigest(f.definition)])),tableProtectionHashes:Object.fromEntries(catalog.tables.filter(t=>t.schema==='finance_history_v2').map(t=>[t.name,protection(t)])),planProtectionHashes:Object.fromEntries(catalog.tables.filter(t=>t.schema==='finance_daily_v1').map(t=>[t.name,protection(t)])),canonicalValidationAccepted:true,restrictedCallerTestsAccepted:true,protectedFingerprintsAccepted:true}};
 const state={now:options.now??'2026-11-20T02:00:00Z',through:options.through??initialThrough,recorded:new Set(options.recorded??[]),connections:0,appends:[],queries:[],loseCommit:options.loseCommit===true};
 const createClient=()=>{
  state.connections++;let effective=login,clockReads=0,catalogReads=0,pendingDay=null,readOnly=true;
  return {on(){},async connect(){options.onConnect?.(binding);},async end(){},async query(sql,values){
   state.queries.push({sql,values,readOnly,connection:state.connections});
   if(sql.includes('current_user AS current_role'))return {rows:[{current_role:effective,session_role:login,server_version:170011}]};
   if(sql==="SELECT set_config('role',$1,false)"){effective=values[0];return {rows:[]};}
   if(sql.includes(' AS preflight')){catalogReads++;return {rows:[{preflight:options.lateCatalog&&catalogReads>1?{...catalog,unsafeOtherFunctions:['unapproved-function']}:catalog}]};}
   if(sql===OPERATOR_CLOCK_SQL){clockReads++;const stamp=clockAt(state.now);return {rows:[options.lateClock&&clockReads>1?{...stamp,london_hour:3}:stamp]};}
   if(sql.includes('inspect_daily_receipt')){
    const day=values[0],entry=programme.days.find(e=>e.day===day);assert.ok(entry,'Fixture inspection must remain in the finite reviewed programme');
    const result={state:state.recorded.has(day)?'committed-reconciled':'absent-review-before-retry',materialSha256:entry.materialSha256,reviewRef:entry.reviewRef,
     programme:{...DAILY_PROGRAMME_SCOPE,initialThrough,ceiling:programme.ceiling,currentThrough:state.through,enabled:true},publication:state.recorded.has(day)?{publishedAt:state.now}:null,inspectedAt:state.now,receipt:{runId:`fixture-run:${day}`}};
    if(options.badHash)result.materialSha256='f'.repeat(64);
    if(options.badRef)result.reviewRef='unreviewed-other-package';
    if(!readOnly&&options.lateMaterial)result.materialSha256='e'.repeat(64);
    if(!readOnly&&options.lateHorizon)result.programme.currentThrough=addDays(day,1);
    return {rows:[{result}]};
   }
   if(sql.includes('append_completed_day')){
    assert.equal(readOnly,false);state.appends.push([...values]);pendingDay=values[1];
    return {rows:[{result:{state:'committed-reconciled',replay:false,receipt:{runId:`fixture-run:${pendingDay}`}}}]};
   }
   if(sql==='COMMIT'&&pendingDay){state.recorded.add(pendingDay);state.through=pendingDay;pendingDay=null;if(state.loseCommit){state.loseCommit=false;throw new Error('Injected acknowledged-on-server commit with lost client response');}}
   if(sql==='ROLLBACK')pendingDay=null;
   if(sql==='BEGIN READ WRITE')readOnly=false;
   if(sql.includes('READ ONLY'))readOnly=true;
   return {rows:[]};
  }};
 };
 return {binding,programme,state,createClient};
}
const run=(f,mode='append',extra={})=>operateDaily({enabled:true,recurring:true,mode,binding:f.binding,...extra},f);

test('one unchanged programme appends two consecutive days through independent invocations',async()=>{
 const f=fixture(),before=JSON.stringify(f.binding.programme);
 const first=await run(f);assert.equal(first.day,'2026-11-19');assert.equal(first.state,'committed-reconciled');
 f.state.now='2026-11-21T02:00:00Z';
 const second=await run(f);assert.equal(second.day,'2026-11-20');assert.equal(second.state,'committed-reconciled');
 assert.deepEqual(f.state.appends,[['2026-11-18','2026-11-19'],['2026-11-19','2026-11-20']]);
 assert.equal(f.state.connections,2);assert.equal(JSON.stringify(f.binding.programme),before);
 assert.ok(f.state.queries.some(q=>q.connection===2&&q.sql.includes('inspect_daily_receipt')&&q.values[0]==='2026-11-19'));
});
test('unreviewed material hash or review reference stops before any append',async()=>{
 for(const options of [{badHash:true},{badRef:true}]){const f=fixture(options);await assert.rejects(run(f),/independently-reviewed-day-material-differs/);assert.equal(f.state.appends.length,0);}
});
test('catalog, server clock, material or horizon drift immediately before dispatch stops append',async()=>{
 for(const options of [{lateCatalog:true},{lateClock:true},{lateMaterial:true},{lateHorizon:true}]){
  const f=fixture(options);await assert.rejects(run(f),/candidate-changed|cutoff-changed|material-changed|programme-horizon/);assert.equal(f.state.appends.length,0);
 }
});
test('exact same-day replay inspects only and uncertain COMMIT is not automatically retried',async()=>{
 const f=fixture({loseCommit:true});
 await assert.rejects(run(f),error=>error.operatorErrorClass==='unknown-outcome-inspect-independently'&&error.operatorDay==='2026-11-19'&&error.mutationAttempted===true);
 assert.equal(f.state.appends.length,1);assert.equal(f.state.connections,1);
 const inspected=await run(f,'inspect');assert.equal(inspected.state,'committed-reconciled');assert.equal(inspected.mutationAttempted,false);
 assert.equal(f.state.connections,2);assert.equal(f.state.appends.length,1);
 const replay=await run(f);assert.equal(replay.state,'already-recorded-inspect');assert.equal(f.state.appends.length,1);
});
test('a missed day never chooses oldest missing material or catches up; expired programme never dispatches',async()=>{
 const gap=fixture({now:'2026-11-21T02:00:00Z'});
 await assert.rejects(run(gap),/actual-programme-horizon-differs/);assert.equal(gap.state.appends.length,0);
 const expired=fixture({now:'2026-11-22T02:00:00Z'});
 assert.equal((await run(expired)).state,'outside-reviewed-programme');assert.equal(expired.state.appends.length,0);
 assert.ok(!expired.state.queries.some(q=>q.sql.startsWith('SELECT finance_daily_v1.inspect_daily_receipt')));
});
test('UTC cron candidates admit only 02:00 London across summer, winter and DST changes',async()=>{
 for(const [iso,expected] of [
  ['2026-07-20T01:00:00Z',true],['2026-07-20T02:00:00Z',false],
  ['2026-11-20T01:00:00Z',false],['2026-11-20T02:00:00Z',true],
  ['2026-03-29T01:00:00Z',true],['2026-03-29T02:00:00Z',false],
  ['2026-10-25T01:00:00Z',false],['2026-10-25T02:00:00Z',true],
 ]){
  const stamp=clockAt(iso),f=fixture({now:iso,initialThrough:addDays(stamp.london_day,-2)});
  const result=await run(f);
  assert.equal(result.state,expected?'committed-reconciled':'outside-london-window',iso);
  assert.equal(f.state.appends.length,expected?1:0,iso);
 }
});
test('disabled recurring CLI reads no private binding or ambient credentials and never connects',async()=>{
 const f=fixture();assert.deepEqual(await run(f,'append',{enabled:false}),{state:'disabled',mode:'append',connections:0});assert.equal(f.state.connections,0);
 const out=execFileSync(process.execPath,[new URL('./daily-operator.mjs',import.meta.url).pathname,'--recurring','--binding-file=/does/not/exist'],{encoding:'utf8',env:{PGHOST:'unreachable.invalid',PGPASSWORD:'not-a-real-secret',DATABASE_URL:'postgresql://unreachable.invalid/no-database'}});
 assert.deepEqual(JSON.parse(out),{state:'disabled',mode:'inspect',connections:0});
});
test('programme binding requires explicit recurring mode before opening a connection',async()=>{
 const f=fixture();await assert.rejects(operateDaily({enabled:true,mode:'append',binding:f.binding},f),/explicit-recurring-mode-required/);assert.equal(f.state.connections,0);
});
