// Synthetic local integration only; no provider calls or remote database access.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,sql,U} from './finance-fixture.mjs';
import {INTAKE_TARGET} from './intake-runtime.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {createDurableSyncJournal} from './durable-sync-journal.mjs';
import {contextFixture,orderFixture,pageFixture,detailsFixture} from './fixtures.mjs';
import {parseShopifyStatus} from '../../artifacts/virtual-cfo/src/lib/connections/shopifyStatus.ts';
import {shopifyTestDataStatus} from '../../artifacts/virtual-cfo/src/lib/connections/shopifyTestDataStatus.ts';

test('test-order source → retained candidate → member status → ingestion message, with replay and no merchant finance writes', async () => {
  const {db} = await setup();
  try {
    await db.exec(sql('proposals/shopify-intake-2026-09-17.sql'));
    await db.exec(sql('proposals/shopify-sync-history-2026-09-17.sql'));
    const target={shopId:INTAKE_TARGET.shopId,domain:INTAKE_TARGET.domain};
    const scope={storeId:INTAKE_TARGET.storeId,shopId:target.shopId,from:'2026-02-01',to:'2026-02-28'};
    await db.query('INSERT INTO store_memberships VALUES($1,$2)',[U,scope.storeId]);
    const journal=createDurableSyncJournal(db,{scope});
    const before=(await db.query('SELECT (SELECT count(*) FROM public.orders) orders,(SELECT count(*) FROM finance_v1.coverage_evidence) coverage')).rows[0];
    const readStatus=()=>db.transaction(async tx=>{
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[U]);
      await tx.exec('SET LOCAL ROLE authenticated');
      const raw=(await tx.query('SELECT public.shopify_connection_status($1) result',[scope.storeId])).rows[0].result;
      return parseShopifyStatus(raw,scope.storeId);
    });
    const empty=await readStatus();
    assert.equal(shopifyTestDataStatus(empty).state,'unavailable');
    async function collectAndRecord(ids){
      const orders=ids.map(id=>({...orderFixture(id),test:true}));
      const context=contextFixture();context.shop.id=target.shopId;context.shop.myshopifyDomain=target.domain;
      const read=async(op,variables)=>op==='context'?context:op==='orders'?pageFixture(orders):detailsFixture(Number(variables.id.split('/').at(-1)));
      const extraction=await loadShopifyDetails(read,await collectShopifyOrders(read,target));
      const attempt=await journal.begin();
      const receipt=await recordShopifyCandidate(db,extraction,scope);
      await journal.finish(attempt,{state:'completed',resultCode:receipt.status});
      return receipt;
    }
    const first=await collectAndRecord([701]);
    assert.equal(first.status,'recorded_requires_review');
    const one=await readStatus();
    assert.equal(one.candidate.orderCount,1);
    assert.equal(one.candidate.testExcludedCount,1);
    assert.equal(one.candidate.mappedEventCount,0);
    assert.equal(one.financialVerification,'not_assessed');
    assert.match(shopifyTestDataStatus(one).title,/1 test order received and excluded from sales/);
    const replay=await collectAndRecord([701]);
    assert.equal(replay.status,'replay');
    assert.equal(replay.batchId,first.batchId);
    assert.equal((await db.query('SELECT count(*) total FROM ingest_v1.batches')).rows[0].total,1);
    const changed=await collectAndRecord([701,702]);
    assert.equal(changed.status,'changed_requires_review');
    const two=await readStatus();
    assert.equal(two.candidate.orderCount,2);
    assert.equal(two.candidate.testExcludedCount,2);
    assert.equal(two.candidate.mappedEventCount,0);
    const stored=(await db.query('SELECT payload FROM ingest_v1.batches WHERE id=$1',[changed.batchId])).rows[0].payload;
    assert.deepEqual(stored.source.orders.map(o=>o.id),['gid://shopify/Order/701','gid://shopify/Order/702']);
    assert.equal(stored.mapped.events.length,0);
    assert.equal(stored.mapped.candidate.netProductSales,0);
    assert.equal(stored.mapped.coverageCertified,false);
    const after=(await db.query('SELECT (SELECT count(*) FROM public.orders) orders,(SELECT count(*) FROM finance_v1.coverage_evidence) coverage')).rows[0];
    assert.deepEqual(after,before);
    assert.match(shopifyTestDataStatus(two).title,/2 test orders received/);
    assert.doesNotMatch(JSON.stringify(two),/gid:\/\/shopify|source\.orders|access_token/);
  } finally { await db.close(); }
});
