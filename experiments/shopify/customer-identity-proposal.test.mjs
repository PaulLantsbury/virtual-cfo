import test from 'node:test';
import assert from 'node:assert/strict';
import {CUSTOMER_IDENTITY_QUERY,prepareCustomerIdentityObservation as prepare} from './customer-identity-proposal.mjs';
import {sourceVersions,compareSourceVersions} from './source-versions.mjs';
import {orderFixture} from './fixtures.mjs';
const input=()=>({storeId:'90000000-0000-4000-8000-000000000001',shopId:'gid://shopify/Shop/1',expectedOrderId:'gid://shopify/Order/1',observedAt:'2026-09-17T12:00:00Z',data:{order:{id:'gid://shopify/Order/1',updatedAt:'2026-03-05T12:00:00Z',customer:{id:'gid://shopify/Customer/100',email:'must-not-retain@example.invalid',firstName:'Must not retain'}}}});
test('proposed separate query selects customer ID only; projection drops incidental contact fields',()=>{
 assert.match(CUSTOMER_IDENTITY_QUERY,/customer\s*\{\s*id\s*\}/);assert.doesNotMatch(CUSTOMER_IDENTITY_QUERY,/email|firstName|lastName|address|phone/);
 const i=input(),before=structuredClone(i),result=prepare(i);assert.deepEqual(i,before);assert.equal(result.shopifyCustomerId,'gid://shopify/Customer/100');assert.equal(result.storeId,i.storeId);assert.equal(result.identityCollectionVersion,1);assert.doesNotMatch(JSON.stringify(result),/must-not-retain|firstName|email/);
 const other=prepare({...i,storeId:'90000000-0000-4000-8000-000000000002'});assert.notEqual(other.storeId,result.storeId); // No cross-store merge or invented guest key.
});
test('explicit no customer differs from uncollected, malformed or mismatched observation',()=>{
 const i=input();i.data.order.customer=null;assert.equal(prepare(i).shopifyCustomerId,null);
 delete i.data.order.customer;assert.throws(()=>prepare(i),/Incomplete/);
 for(const customer of [{}, {id:'bad'}, {id:'gid://shopify/Order/1'}]){i.data.order.customer=customer;assert.throws(()=>prepare(i),/Invalid customer/);}
 assert.throws(()=>prepare({...input(),expectedOrderId:'gid://shopify/Order/2'}),/Incomplete/);
});
test('separate identity observations preserve existing financial source hashes; naive field addition conflicts',()=>{
 const order=orderFixture(),before=structuredClone(order),versions=sourceVersions([order]);
 const previous=versions.map(r=>({source_id:r.id,source_version:r.version,fingerprint:r.fingerprint}));
 prepare(input());assert.deepEqual(order,before);assert.deepEqual(sourceVersions([order]),versions);assert.equal(compareSourceVersions(previous,sourceVersions([order])).status,'accepted');
 const naivelyExtended={...order,customer:{id:'gid://shopify/Customer/100'}};
 assert.equal(compareSourceVersions(previous,sourceVersions([naivelyExtended])).status,'conflicting_source');
});

test('invalid source calendar dates and unknown offsets are rejected before normalisation',()=>{
 for(const date of ['2026-02-30T12:00:00Z','2026-09-17T24:00:00Z','2026-09-17T12:00:00-00:00']){const i=input();i.data.order.updatedAt=date;assert.throws(()=>prepare(i),/Incomplete/);assert.throws(()=>prepare({...input(),observedAt:date}),/Invalid identity/);}
});
