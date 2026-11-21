import test from 'node:test';import assert from 'node:assert/strict';
import {mintShopifyWriterToken} from './shopify-writer-token.mjs';
test('per-run writer client credentials mint at exact shop and verify minimal write_orders scope',async()=>{
 const calls=[];const token=await mintShopifyWriterToken({target:'dev.myshopify.com',clientId:'writer-id',clientSecret:'synthetic+&secret',fetchImpl:async(url,opts)=>{
  calls.push({url,opts});return new Response(JSON.stringify(url.endsWith('/access_token')?{access_token:'synthetic-access-token',expires_in:86400}:{access_scopes:[{handle:'read_orders'},{handle:'write_orders'}]}));
 }});assert.equal(token,'synthetic-access-token');assert.equal(calls.length,2);assert.equal(calls[0].url,'https://dev.myshopify.com/admin/oauth/access_token');assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[0].opts.body)),{grant_type:'client_credentials',client_id:'writer-id',client_secret:'synthetic+&secret'});assert.equal(calls[1].url,'https://dev.myshopify.com/admin/oauth/access_scopes.json');assert.equal(calls.every(c=>c.opts.redirect==='error'),true);
});
test('reader token, extra writer scope, malformed/oversized replies fail without secret exposure',async()=>{
 for(const scopes of [[{handle:'read_orders'}],[{handle:'read_orders'},{handle:'write_orders'},{handle:'write_products'}]]){
  await assert.rejects(mintShopifyWriterToken({target:'dev.myshopify.com',clientId:'id',clientSecret:'secret',fetchImpl:async url=>new Response(JSON.stringify(url.endsWith('/access_token')?{access_token:'synthetic-access-token',expires_in:86400}:{access_scopes:scopes}))}),{message:'SHOPIFY_TEST_WRITER_UNAVAILABLE'});
 }
 await assert.rejects(mintShopifyWriterToken({target:'dev.myshopify.com',clientId:'id',clientSecret:'secret',fetchImpl:async()=>new Response('x'.repeat(32769))}),{message:'SHOPIFY_TEST_WRITER_UNAVAILABLE'});
});
