import test from 'node:test';
import assert from 'node:assert/strict';
import {XERO_READ_SCOPES,XERO_REDIRECT_URI,createAuthorization,createSingleUseStateGuard,readXeroTestConfig,verifyAuthorizationState} from './read-only-oauth.mjs';

const config=()=>readXeroTestConfig({enabled:'true',clientId:'12345678-1234-1234-1234-123456789abc',clientSecret:'x'.repeat(32),redirectUri:XERO_REDIRECT_URI});
test('disabled by default and accepts only the exact local test callback',()=>{
 assert.equal(readXeroTestConfig({}),undefined);
 for(const change of [{redirectUri:'http://127.0.0.1:3000/xero/callback'},{redirectUri:'https://localhost:3000/xero/callback'},{clientId:'client'},{clientSecret:'short'}])assert.throws(()=>readXeroTestConfig({enabled:'true',clientId:'12345678-1234-1234-1234-123456789abc',clientSecret:'x'.repeat(32),redirectUri:XERO_REDIRECT_URI,...change}),/invalid/);
});
test('authorisation URL is read-only granular scope set and carries a signed expiring state',()=>{
 const made=createAuthorization(config(),{now:1_000,nonce:'x'.repeat(24),stateKey:'s'.repeat(32)}),url=new URL(made.url);
 assert.equal(url.origin,'https://login.xero.com');assert.equal(url.searchParams.get('redirect_uri'),XERO_REDIRECT_URI);assert.equal(url.searchParams.get('scope'),XERO_READ_SCOPES.join(' '));assert.equal(url.searchParams.has('offline_access'),false);
 assert.equal(verifyAuthorizationState(made.state,{now:600_999,stateKey:'s'.repeat(32)}),true);assert.equal(verifyAuthorizationState(made.state,{now:601_001,stateKey:'s'.repeat(32)}),false);
});
test('state rejects replacement, malformed and wrong-key callbacks',()=>{
 const made=createAuthorization(config(),{now:1_000,nonce:'x'.repeat(24),stateKey:'s'.repeat(32)});
 assert.equal(verifyAuthorizationState(made.state.replace(/.$/,'x'),{now:2_000,stateKey:'s'.repeat(32)}),false);
 assert.equal(verifyAuthorizationState(made.state,{now:2_000,stateKey:'other'.repeat(8)}),false);
 assert.equal(verifyAuthorizationState('not-a-state',{now:2_000,stateKey:'s'.repeat(32)}),false);
});
test('snapshot consent requests only the settings and report scopes it uses',()=>{
 assert.deepEqual(XERO_READ_SCOPES,['accounting.settings.read','accounting.reports.profitandloss.read','accounting.reports.balancesheet.read','accounting.reports.trialbalance.read','accounting.reports.banksummary.read']);
});
test('issued state can be consumed once and never after expiry',()=>{
 let now=1_000;const guard=createSingleUseStateGuard({stateKey:'s'.repeat(32),now:()=>now});
 const made=guard.issue(config(),{nonce:'x'.repeat(24)});assert.equal(guard.consume(made.state),true);assert.equal(guard.consume(made.state),false);
 const expired=guard.issue(config(),{nonce:'y'.repeat(24)});now=601_001;assert.equal(guard.consume(expired.state),false);
});
