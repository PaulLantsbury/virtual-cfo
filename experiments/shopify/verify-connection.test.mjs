import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyShopifyConnection} from './verify-connection.mjs';
import {API_VERSION, QUERIES} from './queries.mjs';
import {createShopifyCredentialProvider} from './credential-provider.mjs';

const connection = {shopId:'gid://shopify/Shop/123',domain:'example-test.myshopify.com',currency:'GBP',timezone:'Europe/London'};
const secret = 'secret-not-for-output';
const context = () => ({shop:{id:connection.shopId,myshopifyDomain:connection.domain,currencyCode:'GBP',ianaTimezone:'Europe/London'},
  currentAppInstallation:{accessScopes:[{handle:'read_orders'},{handle:'read_all_orders'}]}});
const response = (data = context(), version = API_VERSION) => new Response(JSON.stringify({data}), {headers:{'x-shopify-api-version':version}});
const options = (overrides = {}) => ({connection, resolveCredential:async()=>secret, fetchImpl:async()=>response(), ...overrides});

test('only fixed context query is issued; summary cannot imply collected or reconciled finance', async () => {
  let requests = 0;
  const result = await verifyShopifyConnection(options({resolveCredential:async(expected,{signal}) => {
    assert.deepEqual(expected,{shopId:connection.shopId,domain:connection.domain});
    assert.equal(signal.aborted,false); return secret;
  }, fetchImpl:async(url,init) => {
    requests++;
    assert.equal(url,`https://${connection.domain}/admin/api/${API_VERSION}/graphql.json`);
    assert.equal(init.redirect,'error');
    assert.equal(init.headers['X-Shopify-Access-Token'],secret);
    assert.deepEqual(JSON.parse(init.body),{query:QUERIES.context,variables:{}});
    return response({...context(),customers:[{email:secret}],accessToken:secret});
  }}));
  assert.equal(requests,1);
  assert.deepEqual(result,{status:'context_verified',apiVersion:API_VERSION,settings:connection,
    verifiedRequiredScopes:['read_orders','read_all_orders'],ordersCollected:false,dataImported:false,sourceReconciled:false,coverageCertified:false});
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('identity, currency, timezone and either absent scope fail closed', async () => {
  const changes = [data=>data.shop.id='gid://shopify/Shop/999',data=>data.shop.myshopifyDomain='another.myshopify.com',
    data=>data.shop.currencyCode='USD',data=>data.shop.ianaTimezone='America/New_York',
    data=>data.currentAppInstallation.accessScopes=[{handle:'read_orders'}],
    data=>data.currentAppInstallation.accessScopes=[{handle:'read_all_orders'}],
    data=>data.currentAppInstallation.accessScopes=[null],data=>data.currentAppInstallation=null];
  for (const change of changes) {
    const data=context(); change(data);
    await assert.rejects(verifyShopifyConnection(options({fetchImpl:async()=>response(data)})), /Shopify (identity|reporting settings|full order-history)/);
  }
});

test('API fallback, access rejection and raw provider/network/GraphQL errors are secret-safe', async () => {
  for (const overrides of [
    {resolveCredential:async()=>{throw new Error(secret);}},
    {fetchImpl:async()=>{throw new Error(secret);}},
    {fetchImpl:async()=>response(context(),'2026-10')},
    {fetchImpl:async()=>new Response(secret,{status:401})},
    {fetchImpl:async()=>new Response(JSON.stringify({errors:[{message:secret}]}),{headers:{'x-shopify-api-version':API_VERSION}})},
  ]) {
    await assert.rejects(verifyShopifyConnection(options(overrides)), error => {
      assert.ok(!error.message.includes(secret)); assert.equal(error.cause,undefined); return true;
    });
  }
});

test('invalid canonical configuration fails before credential resolution or network', async () => {
  for (const change of [{domain:'https://example.com'}, {shopId:'123'}, {currency:'gbp'}, {timezone:'No/Such_Zone'}]) {
    await assert.rejects(verifyShopifyConnection(options({connection:{...connection,...change},resolveCredential:()=>assert.fail('must not resolve')})), /Invalid Shopify verification/);
  }
});

test('cancelled or hung resolver is bounded, and cancellation starts no request', async () => {
  const controller=new AbortController();controller.abort(new Error(secret));
  await assert.rejects(verifyShopifyConnection(options({signal:controller.signal,resolveCredential:()=>assert.fail('must not resolve')})), /cancelled or timed out/);
  let requests=0;
  await assert.rejects(verifyShopifyConnection(options({timeoutMs:10,resolveCredential:()=>new Promise(()=>{}),fetchImpl:()=>requests++})), /cancelled or timed out/);
  assert.equal(requests,0);
});

test('each verification resolves credentials again and retains existing bounded read retry', async () => {
  let resolves=0,requests=0;
  const args=options({resolveCredential:async()=>{resolves++;return secret;},sleep:async()=>{},fetchImpl:async()=>{
    requests++;return requests===1?new Response('',{status:429}):response();
  }});
  await verifyShopifyConnection(args);await verifyShopifyConnection(args);
  assert.equal(resolves,2);assert.equal(requests,3);
});

test('real credential provider plus verifier fails old granted scope then checks fresh token after invalidation', async () => {
  let exchanges=0,contexts=0;
  const tokenFetch=async(url,init)=>{
    exchanges++;
    assert.equal(url,`https://${connection.domain}/admin/oauth/access_token`);
    assert.equal(new URLSearchParams(init.body).get('client_secret'),secret);
    return new Response(JSON.stringify({access_token:`private-token-${exchanges}`,expires_in:86400}));
  };
  const provider=createShopifyCredentialProvider({domain:connection.domain,
    loadCredentials:async()=>({clientId:'synthetic-client',clientSecret:secret}),fetchImpl:tokenFetch});
  const args=options({resolveCredential:provider.resolveCredential,fetchImpl:async(_url,init)=>{
    contexts++;
    const data=context();
    if(init.headers['X-Shopify-Access-Token']==='private-token-1') data.currentAppInstallation.accessScopes=[{handle:'read_orders'}];
    else assert.equal(init.headers['X-Shopify-Access-Token'],'private-token-2');
    return response(data);
  }});
  await assert.rejects(verifyShopifyConnection(args),/full order-history read permissions are missing/);
  // Merely publishing requested scopes does not establish actual installed grants.
  await assert.rejects(verifyShopifyConnection(args),/full order-history read permissions are missing/);
  assert.equal(exchanges,1);
  provider.invalidate();
  const verified=await verifyShopifyConnection(args);
  assert.equal(exchanges,2);assert.equal(contexts,3);
  assert.equal(verified.status,'context_verified');assert.equal(verified.dataImported,false);
  assert.ok(!JSON.stringify(verified).includes('private-token'));
  assert.ok(!JSON.stringify(verified).includes(secret));
});
