// Synthetic API responses + real restricted writer in disposable PostgreSQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql} from './finance-fixture.mjs';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
import {API_VERSION,QUERIES} from './queries.mjs';
import {collectCustomerIdentities,CUSTOMER_IDENTITIES_QUERY} from './collect-customer-identities.mjs';
import {recordCustomerIdentityObservations} from './customer-identity-writer.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {expected,contextFixture,pageFixture,orderFixture,detailsFixture} from './fixtures.mjs';
const snapshot=async db=>{const result={};for(const table of ['public.orders','public.refunds','public.customers','ingest_v1.batches','ingest_v1.heads','ingest_v1.source_versions','finance_v1.coverage_evidence'])result[table]=(await db.query(`SELECT to_jsonb(r) row FROM ${table} r ORDER BY to_jsonb(r)::text`)).rows;return result;};
test('separate collector and restricted identity writer replay safely without changing financial candidates or contact tables',async()=>{
 const {db}=await setup();try{
 await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));await db.exec(sql('proposals/shopify-customer-identity-2026-09-17.sql'));
 const restricted={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_intake_service');return fn(tx);}),lockCandidateStore:(tx,id)=>tx.query('SELECT ingest_v1.lock_intake_store($1)',[id])};
 const request=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([orderFixture()]):detailsFixture();
 const financial=await loadShopifyDetails(request,await collectShopifyOrders(request,expected));financial.settings={shopId:target.shopId,domain:target.domain,currency:target.currency,timezone:target.timezone};financial.orders[0].test=true;
 const scope={storeId:target.storeId,shopId:target.shopId,from:'2026-02-01',to:'2026-02-28'};const firstCandidate=await recordShopifyCandidate(restricted,financial,scope),before=await snapshot(db),financialBefore=structuredClone(financial);
 let redact=false;
 const fetchImpl=async(url,options)=>{
  assert.equal(url,`https://${target.domain}/admin/api/${API_VERSION}/graphql.json`);assert.equal(options.redirect,'error');
  const {query}=JSON.parse(options.body);let data;
  if(query===QUERIES.context)data={shop:{id:target.shopId,myshopifyDomain:target.domain,currencyCode:target.currency,ianaTimezone:target.timezone},currentAppInstallation:{accessScopes:['read_orders','read_all_orders','read_customers'].map(handle=>({handle}))}};
  else{assert.equal(query,CUSTOMER_IDENTITIES_QUERY);data={orders:{nodes:[{id:'gid://shopify/Order/1',updatedAt:'2026-03-05T12:00:00Z',customer:{id:'gid://shopify/Customer/100',email:'must-not-retain@example.invalid'}},{id:'gid://shopify/Order/2',updatedAt:'2026-03-05T12:00:00Z',customer:null}],pageInfo:{hasNextPage:false,endCursor:null}}};}
  return new Response(JSON.stringify(redact&&query===CUSTOMER_IDENTITIES_QUERY?{data,errors:[{message:'private access details',extensions:{code:'ACCESS_DENIED'}}]}:{data}),{headers:{'x-shopify-api-version':API_VERSION}});
 };
 const collect=()=>collectCustomerIdentities({connection:target,storeId:target.storeId,resolveCredential:async()=> 'synthetic-token',fetchImpl});
 const collected=await collect();assert.equal(collected.observations.length,2);assert.doesNotMatch(JSON.stringify(collected),/must-not-retain|email/);
 const first=await recordCustomerIdentityObservations(restricted,collected.observations);assert.equal(first.insertedCount,2);assert.equal(first.replayCount,0);
 const replay=await recordCustomerIdentityObservations(restricted,(await collect()).observations);assert.equal(replay.insertedCount,0);assert.equal(replay.replayCount,2);
 const rows=(await db.query('SELECT shopify_order_id,shopify_customer_id FROM shopify_identity_v1.order_observations ORDER BY shopify_order_id')).rows;
 assert.deepEqual(rows,[{shopify_order_id:'gid://shopify/Order/1',shopify_customer_id:'gid://shopify/Customer/100'},{shopify_order_id:'gid://shopify/Order/2',shopify_customer_id:null}]);
 assert.deepEqual(financial,financialBefore);assert.deepEqual(await snapshot(db),before);
 const financialReplay=await recordShopifyCandidate(restricted,financial,scope);assert.equal(financialReplay.status,'replay');assert.equal(financialReplay.batchId,firstCandidate.batchId);assert.deepEqual(await snapshot(db),before);
 redact=true;await assert.rejects(collect(),e=>e.message.includes('incomplete')&&!e.message.includes('private'));assert.equal((await db.query('SELECT count(*)::int n FROM shopify_identity_v1.order_observations')).rows[0].n,2);
 }finally{await db.close();}
});
