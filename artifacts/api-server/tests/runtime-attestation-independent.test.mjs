/** Independent candidate security tests. Artificial Auth, disposable SQL/HTTP only.
 * No hosted target/operator/revision proof, deployment or permissions change. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import express from 'express';
import http from 'node:http';
import {createCustomerRuntimeAttestationService,CUSTOMER_ATTESTATION_POLICY} from '../../../experiments/synthetic-company/customer-runtime-attestation-service.mjs';
import {createFinancialReviewRouter} from '../src/routes/financial-reviews.ts';
const userId='61000000-0000-4000-8000-000000000001',ordinary='61000000-0000-4000-8000-000000000002';
const storeId='71000000-0000-4000-8000-000000000001',revision='a'.repeat(40);
const scope={storeId,from:'2026-10-01',to:'2026-10-31'};
const options={trustedRevision:revision,runtimeProjectRef:'fictional-other-project'};
async function fixture({operator=true,member=true,enabled=true}={}){
 const db=await PGlite.create();try{
  await db.exec('CREATE ROLE night_scout_review_service NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;CREATE TABLE public.store_memberships(user_id uuid,store_id uuid);CREATE SCHEMA ingest_v1;CREATE TABLE ingest_v1.review_authorizations(reviewer_id uuid,store_id uuid);GRANT USAGE ON SCHEMA ingest_v1 TO night_scout_review_service;GRANT SELECT ON public.store_memberships,ingest_v1.review_authorizations TO night_scout_review_service;');
  if(member)await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[userId,storeId]);
  if(operator)await db.query('INSERT INTO ingest_v1.review_authorizations VALUES($1,$2)',[userId,storeId]);
  await db.query('INSERT INTO public.store_memberships VALUES($1,$2)',[ordinary,storeId]);
  let clock=Date.parse('2026-11-21T17:00:00Z'),identity=userId,afterAuth=null,authCalls=0;
  const calls=[],port={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_review_service');calls.push({transaction:true});return fn({exec:async sql=>{calls.push({sql});return tx.exec(sql);},query:async(sql,args)=>{calls.push({sql,args});return tx.query(sql,args);}});})};
  const auth={auth:{getUser:async()=>{authCalls++;if(afterAuth)await afterAuth();return {data:{user:{id:identity,is_anonymous:false}},error:null};}}};
  const service=createCustomerRuntimeAttestationService(port,auth,{...options,policy:{...CUSTOMER_ATTESTATION_POLICY,enabled},now:()=>new Date(clock)});
  return {db,service,calls,port,auth,user:id=>identity=id,clock:value=>clock=Date.parse(value),afterAuth:fn=>afterAuth=fn,authCalls:()=>authCalls,run:()=>service.inspect(scope,'Bearer fictional-token')};
 }catch(error){await db.close();throw error;}
}
const inspections=h=>h.calls.filter(c=>c.sql?.includes('session_user::text')).length;
test('independent actual SQL: current operator and membership authorize one bounded inspection in the same readonly transaction',async()=>{
 const h=await fixture();try{const result=await h.run();assert.equal(result.state,'observed');assert.equal(result.serviceMatches,true);assert.equal(result.serviceRestricted,true);assert.equal(result.transactionReadOnly,true);assert.equal(result.transactionRepeatableRead,true);assert.equal(result.targetProjectAttested,false,'Fictional test target is not attested');assert.equal(result.revision,revision);assert.equal(inspections(h),1);assert.equal(h.calls.filter(c=>c.transaction).length,1);assert.equal(h.calls.filter(c=>c.sql==='SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY').length,1);assert.equal(h.calls.filter(c=>c.sql?.startsWith('SELECT')).length,2);assert.ok(h.calls.some(c=>c.sql?.includes("statement_timeout='2000ms'")));assert.ok(h.calls.some(c=>c.sql?.includes("idle_in_transaction_session_timeout='3000ms'")));assert.ok(h.calls.filter(c=>c.sql).every(c=>!/^\s*(INSERT|UPDATE|DELETE|GRANT|CREATE|ALTER|DROP)/i.test(c.sql)));await assert.rejects(h.run,/unavailable/);assert.equal(inspections(h),1);for(const secret of ['fictional-token','night_scout_review_service','session_login','database_name','reviewer_id'])assert.ok(!JSON.stringify(result).includes(secret));}finally{await h.db.close();}
});
test('independent actual SQL: ordinary members and removed operator or member rights never inspect catalog',async()=>{
 for(const kind of ['ordinary','operator-removed','member-removed']){const h=await fixture();try{
  if(kind==='ordinary')h.user(ordinary);
  else h.afterAuth(()=>h.db.query(kind==='operator-removed'?'DELETE FROM ingest_v1.review_authorizations WHERE reviewer_id=$1':'DELETE FROM public.store_memberships WHERE user_id=$1',[userId]));
  await assert.rejects(h.run,/authorised/);assert.equal(inspections(h),0);assert.equal(h.authCalls(),1);
 }finally{await h.db.close();}}
});
test('independent lifecycle: default disabled, exact process expiry and exact removal deadline deny inspection',async()=>{
 const off=await fixture({enabled:false});try{await assert.rejects(off.run,/unavailable/);assert.equal(off.authCalls(),0);assert.equal(off.calls.length,0);}finally{await off.db.close();}
 for(const time of ['2026-11-21T17:05:00Z','2026-11-21T18:00:00Z']){const h=await fixture();try{h.clock(time);await assert.rejects(h.run,/unavailable/);assert.equal(h.authCalls(),0);assert.equal(inspections(h),0);}finally{await h.db.close();}}
});
test('independent concurrent callers cannot perform two inspections and failed authorized inspection is not rearmed',async()=>{
 const h=await fixture();try{const results=await Promise.allSettled([h.run(),h.run()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(inspections(h),1);}finally{await h.db.close();}
 let queries=0;const tx={exec:async()=>{},query:async sql=>{if(sql.includes('review_authorizations'))return {rows:[{}]};queries++;throw Error('SECRET SQL connection');}};
 const service=createCustomerRuntimeAttestationService({transaction:fn=>fn(tx)},{auth:{getUser:async()=>({data:{user:{id:userId,is_anonymous:false}}})}},{...options,policy:{...CUSTOMER_ATTESTATION_POLICY,enabled:true},now:()=>new Date('2026-11-21T17:00:00Z')});
 await assert.rejects(service.inspect(scope,'Bearer fictional'),/unavailable/);await assert.rejects(service.inspect(scope,'Bearer fictional'),/unavailable/);assert.equal(queries,1);
});
async function server(service,run){const app=express();app.use('/reviews',createFinancialReviewRouter(service));const s=http.createServer(app);await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});try{await run(async(body,authorization='Bearer fictional',query='')=>{const response=await fetch(`http://127.0.0.1:${s.address().port}/reviews/prepare${query}`,{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});return {status:response.status,cache:response.headers.get('cache-control'),body:await response.json()};});}finally{await new Promise(resolve=>s.close(resolve));}}
const observation={contract:'customer-runtime-attestation-v1',state:'observed',revision,loginMatches:false,serviceMatches:true,databaseMatches:true,loginRestricted:false,serviceRestricted:true,transactionReadOnly:true,transactionRepeatableRead:true,targetProjectAttested:false};
test('independent HTTP: revision/target/operator tampering is rejected before attestation service invocation',async()=>{
 let calls=0;const service={prepare:async()=>({legacy:true}),restore:async()=>({}),attestRuntime:async()=>{calls++;return observation;}};
 await server(service,async request=>{for(const extra of [{trustedRevision:'b'.repeat(40)},{revision:'b'.repeat(40)},{targetProjectAttested:true},{projectRef:'forged'},{reviewerId:userId},{operator:true}])assert.equal((await request({scope,runtimeAttestation:true,...extra})).status,400);assert.equal((await request({scope,runtimeAttestation:true},'')).status,401);for(const query of ['?revision=forged','?projectRef=forged','?runtimeAttestation=true'])assert.equal((await request({scope,runtimeAttestation:true},'Bearer fictional',query)).status,400);assert.equal(calls,0);assert.equal((await request({scope})).body.legacy,true);});
});
test('independent HTTP: poisoned dependency output never leaks private role/token/target fields',async()=>{
 await server({prepare:async()=>({}),restore:async()=>({}),attestRuntime:async()=>({...observation,token:'SECRET-TOKEN',rawRoles:['SECRET-ROLE'],databaseUrl:'SECRET-ENDPOINT'})},async request=>{const result=await request({scope,runtimeAttestation:true});assert.ok(!JSON.stringify(result).includes('SECRET'));assert.equal(result.cache,'no-store');});
});

test('independent lifecycle: expiry during an authorized inspection suppresses the result and leaves the attempt spent',async()=>{
 for(const [start,end]of [['2026-11-21T17:00:00Z','2026-11-21T17:05:00Z'],['2026-11-21T17:59:59.999Z','2026-11-21T18:00:00Z']]){
  let time=Date.parse(start),catalog=0;const row={session_login:'night_scout_review_login',effective_role:'night_scout_review_service',database_name:'postgres',read_only:'on',isolation:'repeatable read',unsafe_login:false,unsafe_service:false};
  const tx={exec:async()=>{},query:async sql=>{if(sql.includes('review_authorizations'))return {rows:[{}]};catalog++;time=Date.parse(end);return {rows:[row]};}};
  const service=createCustomerRuntimeAttestationService({transaction:fn=>fn(tx)},{auth:{getUser:async()=>({data:{user:{id:userId,is_anonymous:false}}})}},{...options,policy:{...CUSTOMER_ATTESTATION_POLICY,enabled:true},now:()=>new Date(time)});
  await assert.rejects(service.inspect(scope,'Bearer fictional'),/unavailable/);assert.equal(catalog,1);await assert.rejects(service.inspect(scope,'Bearer fictional'),/unavailable/);assert.equal(catalog,1);
 }
});

test('independent HTTP: coerced state objects are refused rather than projected with nested secrets',async()=>{
 const state={toString:()=> 'observed',nested:'SECRET-STATE'};
 await server({prepare:async()=>({}),restore:async()=>({}),attestRuntime:async()=>({...observation,state})},async request=>{const result=await request({scope,runtimeAttestation:true});assert.equal(result.status,503);assert.ok(!JSON.stringify(result).includes('SECRET-STATE'));assert.equal(result.cache,'no-store');});
});
test('independent Auth failures and expiry during token verification stop before any database inspection',async()=>{
 const h=await fixture();try{h.auth.auth.getUser=async()=>({data:{user:{id:userId,is_anonymous:true}}});await assert.rejects(h.run,/verified/);assert.equal(h.calls.length,0);h.auth.auth.getUser=async()=>{throw Error('SECRET-AUTH');};await assert.rejects(h.run,/verified/);assert.equal(h.calls.length,0);}finally{await h.db.close();}
 const expiring=await fixture();try{expiring.afterAuth(()=>expiring.clock('2026-11-21T17:05:00Z'));await assert.rejects(expiring.run,/unavailable/);assert.equal(expiring.calls.length,0);assert.equal(expiring.authCalls(),1);}finally{await expiring.db.close();}
});
