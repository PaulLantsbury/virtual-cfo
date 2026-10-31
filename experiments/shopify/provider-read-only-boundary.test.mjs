import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hasOnlyShopifyReadScopes} from './client.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {collectCustomerIdentities} from './collect-customer-identities.mjs';
import {verifyShopifyConnection} from './verify-connection.mjs';
import {API_VERSION,QUERIES} from './queries.mjs';
import {hasRequiredXeroScopes as legacyXeroScopes} from '../../deployments/nightly-staging/xero-refresh-runtime.mjs';
import {hasRequiredXeroScopes as demoXeroScopes} from '../../deployments/demo-staging/demo-source-primitives.mjs';

const expected={shopId:'gid://shopify/Shop/123',domain:'reader-boundary.myshopify.com',currency:'GBP',timezone:'Europe/London'};
const context=handles=>({shop:{id:expected.shopId,myshopifyDomain:expected.domain,currencyCode:'GBP',ianaTimezone:'Europe/London'},currentAppInstallation:{accessScopes:handles.map(handle=>({handle}))}});
test('Shopify substituted write-capable credentials stop after context, before any orders',async()=>{
 for(const extra of ['write_orders','write_customers','write_products','WRITE_ORDERS','unknown_capability',null]){
  const handles=['read_orders','read_all_orders',extra];assert.equal(hasOnlyShopifyReadScopes(context(handles).currentAppInstallation.accessScopes),false);
  let pages=0;
  await assert.rejects(collectShopifyOrders(async operation=>{assert.equal(operation,'context');pages++;return context(handles);},expected),/read permissions/);
  assert.equal(pages,1);
  let requests=0;
  await assert.rejects(verifyShopifyConnection({connection:expected,resolveCredential:async()=> 'synthetic-reader-token',fetchImpl:async(_url,init)=>{requests++;assert.equal(JSON.parse(init.body).query,QUERIES.context);return new Response(JSON.stringify({data:context(handles)}),{headers:{'x-shopify-api-version':API_VERSION}});}}),/read permissions/);
  assert.equal(requests,1);
 }
 assert.equal(hasOnlyShopifyReadScopes(['read_orders','read_all_orders','read_customers'].map(handle=>({handle}))),true);
});
test('both Xero reader refresh paths reject added provider business-write scopes',()=>{
 const scopes='accounting.settings.read accounting.reports.profitandloss.read accounting.reports.balancesheet.read accounting.reports.trialbalance.read accounting.reports.banksummary.read offline_access';
 for(const accepts of [legacyXeroScopes,demoXeroScopes]){
  assert.equal(accepts(scopes),true);
  for(const extra of ['accounting.transactions','accounting.contacts','accounting.settings'])assert.equal(accepts(scopes+' '+extra),false);
 }
});
test('identity collection rejects permissions elevated after verification and discards an elevated final context',async()=>{
 for(const elevateAt of [2,3]){
  let contexts=0,pages=0;
  await assert.rejects(collectCustomerIdentities({connection:expected,storeId:'90000000-0000-4000-8000-000000000004',resolveCredential:async()=> 'synthetic-reader-token',fetchImpl:async(_url,init)=>{
   const body=JSON.parse(init.body);let data;
   if(body.query===QUERIES.context){contexts++;data=context(['read_orders','read_all_orders','read_customers',...(contexts>=elevateAt?['write_orders']:[])]);}
   else{pages++;data={orders:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}};}
   return new Response(JSON.stringify({data}),{headers:{'x-shopify-api-version':API_VERSION}});
  }}),/incomplete/);
  assert.equal(pages,elevateAt===2?0:1);
 }
});
test('customer and scheduled reader local import graphs exclude external writer runtimes',async()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url)),seen=new Set();
 const pending=['artifacts/api-server/src/index.ts','deployments/nightly-staging/run-xero-daily-cron.mjs','deployments/nightly-staging/render-shopify-daily.mjs','deployments/demo-staging/run-demo-daily-cron.mjs','experiments/xero-demo/reader-consent-server.mjs'];
 while(pending.length){
  const name=pending.pop();if(seen.has(name))continue;seen.add(name);
  assert.doesNotMatch(name,/(?:test-programme\/(?:run-provider|provider-|shopify-|xero-(?:generation|test-writer|writer-bootstrap))|test-writer-runtime)/,name);
  const source=await readFile(resolve(root,name),'utf8');
  for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"]+)['"]/g)){
   const base=resolve(root,dirname(name),match[1]);let found;
   for(const candidate of [base,base+'.ts',base+'.mjs',base+'.js',base+'/index.ts'])try{if((await stat(candidate)).isFile()){found=candidate;break;}}catch{}
   assert.ok(found,`${name}: unresolved ${match[1]}`);
   if(/\.(?:ts|mjs|js)$/.test(found))pending.push(relative(root,found));
  }
 }
 assert.ok(seen.size>40,'must inspect the transitive graphs');
 assert.ok(seen.has('experiments/shopify/collect.mjs'));
 assert.ok(seen.has('experiments/xero/read-only-period-snapshot.mjs'));
});
