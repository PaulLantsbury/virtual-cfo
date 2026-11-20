import test from 'node:test';
import assert from 'node:assert/strict';
import {XERO_STAGING_RETAINED_SCOPES,createStagingRetainedAuthorization,createStagingRetainedStateGuard,exchangeStagingRetainedCode,readStagingRetainedXeroConfig} from './staging-retained-oauth.mjs';
const config=readStagingRetainedXeroConfig({enabled:'true',clientId:'1'.repeat(32),clientSecret:'s'.repeat(32),redirectUri:'http://localhost:3000/xero/callback'});
const privateRefresh='r'.repeat(48),privateAccess='a'.repeat(48),privateCode='c'.repeat(48);
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});

test('only the explicit staging config requests read scopes plus offline_access',()=>{
 assert.deepEqual(config.scopes,XERO_STAGING_RETAINED_SCOPES);
 assert.equal(config.scopes.at(-1),'offline_access');
 assert.equal(readStagingRetainedXeroConfig({enabled:'false'}),undefined);
 assert.throws(()=>readStagingRetainedXeroConfig({...config,enabled:'true',redirectUri:'https://example.test/callback'}),/unavailable/);
 const made=createStagingRetainedAuthorization(config,{stateKey:'k'.repeat(32),now:1_700_000_000_000,nonce:'n'.repeat(24)});
 const url=new URL(made.url);
 assert.equal(url.searchParams.get('scope'),XERO_STAGING_RETAINED_SCOPES.join(' '));
 assert.equal(url.searchParams.get('redirect_uri'),'http://localhost:3000/xero/callback');
});

test('state is signed, one-time and cannot be used across the local non-retained flow',()=>{
 let now=1_700_000_000_000;const guard=createStagingRetainedStateGuard({stateKey:'k'.repeat(32),now:()=>now});
 const made=guard.issue(config,{nonce:'n'.repeat(24)});
 assert.equal(guard.consume(made.state),true);assert.equal(guard.consume(made.state),false);
 const second=guard.issue(config,{nonce:'m'.repeat(24)});now+=600_001;assert.equal(guard.consume(second.state),false);
});

test('retained exchange is POST-only, discovers one tenant, and never exposes access token',async()=>{
 const requests=[];const result=await exchangeStagingRetainedCode({authorizationCode:privateCode,config,fetchImpl:async(url,options)=>{requests.push([url,options]);if(url.includes('/token'))return json({access_token:privateAccess,refresh_token:privateRefresh,expires_in:1800});return json([{tenantId:'tenant-test'}]);}});
 assert.deepEqual(result,{tenantId:'tenant-test',refreshCredential:privateRefresh});
 assert.equal(requests.length,2);assert.equal(requests[0][1].method,'POST');assert.equal(new URLSearchParams(requests[0][1].body).get('grant_type'),'authorization_code');assert.match(requests[0][1].headers.authorization,/^Basic /);assert.equal(requests[1][1].headers.authorization,`Bearer ${privateAccess}`);
 assert.doesNotMatch(JSON.stringify({result:result.tenantId,requests:requests.map(([url])=>url)}),/a{20}|r{20}|c{20}/);
});

test('malformed, multi-tenant and provider failures collapse without leaking code or token material',async()=>{
 const failures=[
  async()=>json({access_token:privateAccess,refresh_token:privateRefresh,expires_in:1}),
  async url=>url.includes('/token')?json({access_token:privateAccess,refresh_token:privateRefresh,expires_in:1800}):json([{tenantId:'a'},{tenantId:'b'}]),
  async()=>{throw Error(`provider ${privateRefresh} ${privateCode}`)},
 ];
 for(const fetchImpl of failures){try{await exchangeStagingRetainedCode({authorizationCode:privateCode,config,fetchImpl});assert.fail('expected failure');}catch(error){assert.equal(error.message,'Xero staging consent unavailable');assert.doesNotMatch(String(error.stack),/r{20}|c{20}/);}}
});
