// Entirely invented eligible evidence, created in disposable PostgreSQL only.
// This is NOT collected Shopify data and never changes a real order's test flag.
import {setup,sql,U} from './finance-fixture.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {expected,contextFixture,orderFixture,pageFixture,detailsFixture,connectionFixture} from './fixtures.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {importFirstEvidence} from './import-first-evidence.mjs';
import {importSubsequentEvidence} from './import-subsequent-evidence.mjs';
import {prepareCandidateReview} from './review-candidate.mjs';
import {restoreReviewedPeriod} from './restore-reviewed-period.mjs';
import {fetchVerifiedSales} from '../financial-v1/rpc-sales-adapter.mjs';
export const SYNTHETIC_STORE='90000000-0000-4000-8000-000000000005';
export const PERIODS={sale:{from:'2026-02-01',to:'2026-02-28'},refund:{from:'2026-03-01',to:'2026-03-31'}};
const money=amount=>({shopMoney:{amount,currencyCode:'GBP'}});
export async function syntheticReportingFixture(){
 const {db}=await setup();
 for(const name of ['ingest_v1_import_service','ingest_v1_import_receipts','ingest_v1_incremental_receipts','ingest_v1_review_restoration','ingest_v1_review_service'])await db.exec(sql(`proposed/${name}.sql`));
 await db.query("INSERT INTO stores(id,shopify_domain,shopify_store_id) VALUES($1,'synthetic-reporting.invalid','5')",[SYNTHETIC_STORE]);
 await db.query('INSERT INTO store_memberships VALUES($1,$2)',[U,SYNTHETIC_STORE]);
 await db.query('INSERT INTO ingest_v1.review_authorizations VALUES($1,$2)',[SYNTHETIC_STORE,U]);
 const order=orderFixture(5),detail=detailsFixture(5),shippingId='gid://shopify/ShippingLine/5';
 // Hand-worked: £100 product - £10 discount + £18 VAT + £5 shipping + £1 VAT = £114.
 order.originalTotalPriceSet=money('114.00');order.transactions[0].amountSet=money('114.00');order.totalTaxSet=money('19.00');order.totalDiscountsSet=money('11.00');order.totalShippingPriceSet=money('5.00');
 detail.order.shippingLines=connectionFixture([{id:shippingId,isRemoved:false,originalPriceSet:money('6.00'),discountedPriceSet:money('5.00'),taxLines:[{priceSet:money('1.00')}]}]);
 // March refund: £20 product + £4 VAT + £2 shipping + £0.40 VAT = £26.40.
 order.transactions[1].amountSet=money('26.40');order.refunds[0].totalRefundedSet=money('26.40');order.refunds[0].transactions.nodes[0]=structuredClone(order.transactions[1]);
 detail.order.refunds[0].refundShippingLines=connectionFixture([{id:'gid://shopify/RefundShippingLine/5',shippingLine:{id:shippingId},subtotalAmountSet:money('2.00'),taxAmountSet:money('0.40')}]);
 const request=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([order]):detail;
 const data=await loadShopifyDetails(request,await collectShopifyOrders(request,expected));
 data.settings={...data.settings,domain:'synthetic-reporting.invalid',shopId:'gid://shopify/Shop/5'};
 const inputs={};for(const [key,period] of Object.entries(PERIODS)){
  const scope={storeId:SYNTHETIC_STORE,shopId:data.settings.shopId,...period};
  const candidate=await recordShopifyCandidate(db,data,scope);inputs[key]={...scope,batchId:candidate.batchId};
 }
 const importer={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_import_service');return fn(tx);})};
 const importEvidence=async()=>({first:await importFirstEvidence(importer,inputs.sale),refund:await importSubsequentEvidence(importer,inputs.refund)});
 const review=async key=>{
  await db.exec('SET ROLE night_scout_review_service');try{
   const scope=inputs[key],packet=await prepareCandidateReview(db,scope);
   if(packet.status!=='awaiting_independent_coverage_review')throw Error(JSON.stringify(packet));
   return await restoreReviewedPeriod(db,{scope,batchId:packet.batchId,snapshotDigest:packet.snapshotDigest,coverageConfirmed:true,evidenceRef:'synthetic-only-hand-worked-reporting-case',completenessStatement:'Disposable synthetic fixture: exactly one eligible original sale and one later-month refund. This attestation says nothing about a live store.'},{authenticateReviewer:async()=>({id:U})});
  }finally{await db.exec('RESET ROLE');}
 };
 const read=async(key,storeId=SYNTHETIC_STORE)=>{
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[U]);await db.exec('SET ROLE authenticated');try{
   return await fetchVerifiedSales(async(_,p)=>({data:(await db.query('SELECT public.verified_sales_source($1,$2,$3) data',[p.p_store_id,p.p_date_from,p.p_date_to])).rows[0].data,error:null}),{storeId,currency:'GBP',...PERIODS[key]});
  }finally{await db.exec('RESET ROLE');}
 };
 return {db,inputs,data,importEvidence,review,read,provenance:'disposable-synthetic-only'};
}
