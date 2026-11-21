import test from 'node:test';
import assert from 'node:assert/strict';
import {planReconnectStart, planReconnectCommit} from './customer-lifecycle-reconnect.mjs';
const now=1_000_000;
const context={verified:true,owner:true,membershipActive:true,actorId:'owner_a',sessionBinding:'session_a',storeId:'store_a'};
const connection={id:'connection_a',storeId:'store_a',tenantId:'tenant_a',credentialVersion:7,scopeVersion:'read_v1',leaseExpiresAt:null};
const start=(over={})=>planReconnectStart({context,connection,now,attemptId:'attempt_a',stateDigest:'a'.repeat(64),expiresAt:now+600_000,scopeVersion:'read_v1',...over});
const attempt={...start(),status:'exchanging',exchangeClaimId:'claim_a'};
const proof={serverVerified:true,exchangeClaimId:'claim_a',attemptId:attempt.id,stateDigest:attempt.stateDigest,tenantId:'tenant_a',scopeVersion:'read_v1',consentedAt:now+10,freshCodeExchange:true,offlineAccess:true,envelopeValidated:true,stagedEnvelopeId:'envelope_a'};
const commit=(over={})=>planReconnectCommit({context,connection,attempt,proof,now:now+20,...over});
test('successful reconnect preserves identity, mapping and evidence and advances version once',()=>{
 const command=commit(); assert.equal(command.expectedVersion,7);assert.equal(command.replacementVersion,8);
 assert.equal(command.preserveMapping,true);assert.equal(command.preserveEvidence,true);
 assert.equal(command.tenantId,connection.tenantId); assert.ok(Object.isFrozen(command));
 assert.equal(JSON.stringify(command).includes('stateDigest'),false);
});
test('start rejects live duplicate but permits expired attempt replacement',()=>{
 assert.throws(()=>start({activeAttempt:{...attempt,status:'pending'}}));
 assert.throws(()=>start({activeAttempt:attempt}));
 assert.doesNotThrow(()=>start({activeAttempt:{...attempt,status:'pending',expiresAt:now}}));
});
for(const [name,patch] of Object.entries({nonmember:{membershipActive:false},nonowner:{owner:false},unverified:{verified:false},crossstore:{storeId:'store_b'}})) {
 test(`both transitions reject ${name}`,()=>{const c={...context,...patch};assert.throws(()=>start({context:c}));assert.throws(()=>commit({context:c}));});
}
for(const [name,patch] of Object.entries({replay:{status:'consumed'},expired:{expiresAt:now+20},session:{sessionBinding:'session_b'},actor:{actorId:'owner_b'},store:{storeId:'store_b'},tenant:{tenantId:'tenant_b'},version:{expectedVersion:6},scope:{scopeVersion:'write_v1'},future:{createdAt:now+30}})) {
 test(`callback rejects ${name}`,()=>assert.throws(()=>commit({attempt:{...attempt,...patch}})));
}
for(const [name,patch] of Object.entries({wrongclaim:{exchangeClaimId:'claim_b'},unverified:{serverVerified:false},wrongstate:{stateDigest:'b'.repeat(64)},wrongattempt:{attemptId:'other'},wrongtenant:{tenantId:'tenant_b'},wrongscope:{scopeVersion:'other'},oldconsent:{consentedAt:now-1},futureconsent:{consentedAt:now+30},nocode:{freshCodeExchange:false},nooffline:{offlineAccess:false},badenvelope:{envelopeValidated:false},noenvelope:{stagedEnvelopeId:''}})) {
 test(`callback rejects provider proof ${name}`,()=>assert.throws(()=>commit({proof:{...proof,...patch}})));
}
test('refresh and retirement races invalidate reconnect',()=>{
 for(const patch of [{credentialVersion:8},{retired:true},{leaseExpiresAt:now+100}]) assert.throws(()=>commit({connection:{...connection,...patch}}));
});
test('attempt must be short-lived and scopes cannot expand',()=>{
 for(const patch of [{expiresAt:now},{expiresAt:now+600_001},{scopeVersion:'write_v1'},{stateDigest:'raw_state'}]) assert.throws(()=>start(patch));
});

test('malformed lease and overflowing credential versions fail closed at both transitions',()=>{
 for(const patch of [{leaseExpiresAt:undefined},{leaseExpiresAt:NaN},{leaseExpiresAt:'expired'},{leaseExpiresAt:1.5},{credentialVersion:Number.MAX_SAFE_INTEGER}]) {
  const changed={...connection,...patch};assert.throws(()=>start({connection:changed}));assert.throws(()=>commit({connection:changed}));
 }
});
test('pending and exchanging attempts with malformed expiry cannot be replaced',()=>{
 for(const status of ['pending','exchanging']) for(const expiresAt of [undefined,NaN,'expired',1.5]) {
  assert.throws(()=>start({activeAttempt:{...attempt,status,expiresAt}}));
 }
});
