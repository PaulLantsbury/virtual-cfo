import assert from 'node:assert/strict';
import {A,U,setup,sql} from './finance-fixture.mjs';
import {prepareCandidateReview} from './review-candidate.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {expected,contextFixture,orderFixture,pageFixture,detailsFixture} from './fixtures.mjs';
export const scope={storeId:A,from:'2026-08-01',to:'2026-08-31'};
export const identity={authenticateReviewer:async()=>({id:U})};
export async function restorationFixture(database,options){
 const f=await setup(database,options),{db}=f;
 await db.exec(sql('proposed/ingest_v1_review_restoration.sql'));
 const request=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([orderFixture()]):detailsFixture();
 const data=await loadShopifyDetails(request,await collectShopifyOrders(request,expected));
 // Align synthetic source with the established August £123 / September £23 records.
 const o=data.orders[0],money=amount=>({shopMoney:{amount,currencyCode:'GBP'}});
 o.originalTotalPriceSet=money('123');o.totalDiscountsSet=money('0');o.totalTaxSet=money('0');
 o.transactions[0].amountSet=money('123');o.transactions[0].processedAt='2026-08-15T12:00:00Z';
 o.transactions[1].amountSet=money('23');o.transactions[1].processedAt='2026-09-05T12:00:00Z';
 o.lineItems.nodes[0].originalTotalSet=money('123');o.lineItems.nodes[0].discountAllocations=[];o.lineItems.nodes[0].taxLines=[];
 o.refunds[0].totalRefundedSet=money('23');o.refunds[0].refundLineItems.nodes[0].subtotalSet=money('23');o.refunds[0].refundLineItems.nodes[0].totalTaxSet=money('0');
 o.refunds[0].transactions.nodes[0]=structuredClone(o.transactions[1]);
 await db.query("UPDATE public.orders SET shopify_order_id='1' WHERE store_id=$1",[A]);
 await db.query("UPDATE public.refunds SET shopify_refund_id='1' WHERE store_id=$1",[A]);
 await recordShopifyCandidate(db,data,{...scope,shopId:expected.shopId});
 await db.query('INSERT INTO ingest_v1.review_authorizations VALUES($1,$2)',[A,U]);
 const packet=await prepareCandidateReview(db,scope);
 assert.equal(packet.status,'awaiting_independent_coverage_review',JSON.stringify(packet.issues));
 return {...f,packet,request:{scope,batchId:packet.batchId,snapshotDigest:packet.snapshotDigest,coverageConfirmed:true,evidenceRef:'synthetic-completeness-review',completenessStatement:'Synthetic fixture contains the single original order and later refund; exclusions checked.'}};
}
