import test from 'node:test';
import assert from 'node:assert/strict';
import {QUERIES} from './queries.mjs';

// Regression for the CURRENT documented connector contract, not a legal claim
// that order identifiers are anonymous or a decision about future cohort data.
test('current Shopify selection does not request shopper identity or contact fields',()=>{
 const personalFields=new Set(['customer','customers','customerId','email','phone','firstName','lastName','displayName','name','billingAddress','shippingAddress','defaultAddress','addresses','address1','address2','city','zip','note','customAttributes']);
 for(const [operation,query] of Object.entries(QUERIES)){
  const selectedTokens=query.match(/[_A-Za-z][_0-9A-Za-z]*/g)??[];
  assert.deepEqual(selectedTokens.filter(token=>personalFields.has(token)),[],`${operation} added personal/free-text source fields; review the collection contract explicitly`);
 }
});
