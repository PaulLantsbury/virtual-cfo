import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createPgLedger } from './provider-pg-ledger.mjs';
import { createProviderTransport } from './provider-transport.mjs';
import {shopifyOrderPlan,xeroInvoicePlan} from './provider-write-plan.mjs';
test('durable claim: cap, duplicate/digest conflicts, uncertain global stop, immutable transitions', async () => {
  const db = new PGlite();
  try {
    await db.exec(readFileSync(new URL('./provider-ledger-proposal.sql', import.meta.url),'utf8'));
    await db.exec("INSERT INTO staging_test_programme.programmes VALUES('p','shopify','bioalckltvkhlczusdvl','dev.myshopify.com',now()-interval '1 hour',now()+interval '1 day',2,true,false)");
    const pool = { connect:async () => ({ query:(...args) => db.query(...args), release(){} }) };
    const ledger = createPgLedger({ pool, programmeKey:'p' });
    const a = {key:'a',provider:'shopify',target:'dev.myshopify.com',payloadDigest:'a'.repeat(64),cap:2};
    assert.equal((await ledger.claim(a)).state,'claimed');
    assert.equal((await ledger.claim(a)).state,'existing');
    assert.equal((await ledger.claim({...a,payloadDigest:'b'.repeat(64)})).state,'blocked');
    assert.equal((await ledger.claim({...a,key:'b'})).state,'blocked');
    await ledger.markSubmitted('a');
    assert.equal((await ledger.claim({...a,key:'b'})).state,'blocked');
    await ledger.confirm('a','test-source');
    await assert.rejects(ledger.markSubmitted('a'));
    assert.equal((await ledger.claim({...a,key:'b'})).state,'claimed');
    assert.equal((await ledger.claim({...a,key:'c'})).state,'blocked');
    await ledger.markSubmitted('b');
    await ledger.markUncertain('b');
    assert.equal((await ledger.claim({...a,key:'d'})).state,'blocked');
    assert.equal((await db.query("SELECT stopped FROM staging_test_programme.programmes WHERE programme_key='p'")).rows[0].stopped,true);
    await assert.rejects(ledger.confirm('b','unknown'));
  } finally { await db.close(); }
});
test('transport target verification uses provider evidence, never sends invoices to email endpoint', async () => {
  const calls = [];
  const transport = createProviderTransport({provider:'xero',target:'90000000-0000-4000-8000-000000000002',token:'synthetic-secret',fetchImpl:async(url,opts)=>{
    calls.push({url,opts}); return new Response(JSON.stringify(url.endsWith('/connections') ? [{tenantId:'90000000-0000-4000-8000-000000000002',tenantType:'ORGANISATION'}] : {Organisations:[{IsDemoCompany:true,BaseCurrency:'GBP'}]}));
  }});
  assert.equal(await transport.verifyTarget({provider:'xero',target:'90000000-0000-4000-8000-000000000002',verifiedTestTarget:true}),true);
  assert.equal(calls[0].url,'https://api.xero.com/connections');
  assert.equal(calls[1].url,'https://api.xero.com/api.xro/2.0/Organisation');
  assert.equal(calls[0].opts.redirect,'error');
  await assert.rejects(transport.write({provider:'xero',target:'90000000-0000-4000-8000-000000000002',body:{Invoices:[{Status:'AUTHORISED'}]}}));
  assert.equal(calls.length,2);
});
test('oversized and raw provider errors become bounded safe errors', async () => {
  const options = {provider:'shopify',target:'dev.myshopify.com',token:'synthetic-secret'};
  const activation = {provider:'shopify',target:options.target,verifiedTestTarget:true};
  const large = createProviderTransport({...options,fetchImpl:async()=>new Response('x'.repeat(131073))});
  await assert.rejects(large.verifyTarget(activation),{message:'PROVIDER_UNAVAILABLE'});
  const failed = createProviderTransport({...options,fetchImpl:async()=>{throw new Error('secret');}});
  await assert.rejects(failed.verifyTarget(activation),{message:'PROVIDER_UNAVAILABLE'});
});
test('forged plans cannot enable payments, emails, stock or extra posted Xero invoices',async()=>{
 let requests=0;
 const shop=createProviderTransport({provider:'shopify',target:'dev.myshopify.com',token:'synthetic-secret',fetchImpl:async()=>{requests++;assert.fail('unsafe network call');}});
 const base=shopifyOrderPlan({kind:'create-order',route:'shopify-development',test:true,currency:'GBP',targetStore:'dev.myshopify.com',amounts:{units:1,grossProductsPence:6000,productDiscountPence:0,productVatPence:0,netShippingPence:0,shippingVatPence:0}});
 for(const mutate of [p=>p.variables.order.test=false,p=>p.variables.options.sendReceipt=true,p=>p.variables.order.lineItems[0].variantId='stock-id',p=>p.variables.order.transactions=[{amount:60}]]){
  const forged=structuredClone(base);mutate(forged);await assert.rejects(shop.write(forged),{message:'UNSAFE_WRITE_PLAN'});
 }
 const tenant='90000000-0000-4000-8000-000000000002';
 const xero=createProviderTransport({provider:'xero',target:tenant,token:'synthetic-secret',fetchImpl:async()=>{requests++;assert.fail('unsafe network call');}});
 const invoice=xeroInvoicePlan({target:tenant,date:'2026-10-12',amountPence:1000,contactId:'90000000-0000-4000-8000-000000000001',accountCode:'200',programmeId:'test',ordinal:1});
 for(const mutate of [p=>p.body.Invoices.push({...p.body.Invoices[0],Status:'AUTHORISED'}),p=>p.body.Invoices[0].LineItems[0].ItemCode='stock',p=>p.body.Invoices[0].Payments=[{}],p=>p.body.Invoices[0].Contact.EmailAddress='test@example.invalid']){
  const forged=structuredClone(invoice);mutate(forged);await assert.rejects(xero.write(forged),{message:'UNSAFE_WRITE_PLAN'});
 }
 assert.equal(requests,0);
});
test('posted Xero demo mode requires flag and fresh provider demo proof; no payments or VAT',async()=>{
 const target='90000000-0000-4000-8000-000000000002';let demo=true,writes=0;
 const plan=xeroInvoicePlan({target,date:'2026-10-12',amountPence:1000,contactId:'90000000-0000-4000-8000-000000000001',accountCode:'200',programmeId:'test',ordinal:1,status:'AUTHORISED'});
 const fetchImpl=async(url,opts)=>{
  if(url.endsWith('/connections'))return new Response(JSON.stringify([{tenantId:target,tenantType:'ORGANISATION'}]));
  if(url.endsWith('/Organisation'))return new Response(JSON.stringify({Organisations:[{IsDemoCompany:demo,BaseCurrency:'GBP'}]}));
  writes++;assert.equal(url,'https://api.xero.com/api.xro/2.0/Invoices');assert.equal(opts.method,'PUT');
  const body=JSON.parse(opts.body);assert.equal(body.Invoices.length,1);assert.equal(body.Invoices[0].LineAmountTypes,'NoTax');
  return new Response(JSON.stringify({Invoices:[{...body.Invoices[0],InvoiceID:'90000000-0000-4000-8000-000000000004',Total:10}]}));
 };
 const active={target,provider:'xero',verifiedTestTarget:true};
 const disabled=createProviderTransport({provider:'xero',target,token:'synthetic',fetchImpl});await disabled.verifyTarget(active);await assert.rejects(disabled.write(plan));
 const enabled=createProviderTransport({provider:'xero',target,token:'synthetic',fetchImpl,allowPostedDemo:true});await assert.rejects(enabled.write(plan));
 assert.equal(await enabled.verifyTarget(active),true);const result=await enabled.write(plan);assert.equal(await enabled.verifyResult(plan,result),true);assert.equal(writes,1);
 demo=false;assert.equal(await enabled.verifyTarget(active),false);await assert.rejects(enabled.write(plan));assert.equal(writes,1);
});
