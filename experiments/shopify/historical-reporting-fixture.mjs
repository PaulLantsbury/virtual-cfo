// Disposable PostgreSQL only. Invented API-shaped payloads, NOT Shopify collection.
// The ledger's inclusive rows are expressed as equivalent exclusive invented
// orders because the current intake mapper deliberately rejects inclusive input.
import {setup,sql,U} from './finance-fixture.mjs';
import {historicalManifest,historicalInput,PERIODS} from '../financial-v1/historical-testing-fixture.mjs';
import {normaliseSale} from '../financial-v1/calculations.mjs';
import {pence} from '../financial-v1/source-adapter.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
import {importFirstEvidence} from './import-first-evidence.mjs';
import {importSubsequentEvidence} from './import-subsequent-evidence.mjs';
import {prepareCandidateReview} from './review-candidate.mjs';
import {restoreReviewedPeriod} from './restore-reviewed-period.mjs';
import {fetchVerifiedSales} from '../financial-v1/rpc-sales-adapter.mjs';
export const HISTORICAL_REPORTING_STORE='90000000-0000-4000-8000-000000000007';
const money=n=>({shopMoney:{amount:(n/100).toFixed(2),currencyCode:'GBP'}});
const connection=nodes=>({nodes,pageInfo:{hasNextPage:false}});
const gid=(type,id)=>`gid://shopify/${type}/${id}`;
export function historicalExtraction(){
 const manifest=historicalManifest();
 const sourceOrderIds=new Map(manifest.orders.map((o,i)=>[o.id,String(10001+i)]));
 const orders=manifest.orders.map(o=>{
  const id=sourceOrderIds.get(o.id),lineId=gid('LineItem',id),shippingId=gid('ShippingLine',id);
  const n=normaliseSale({gross:pence(o.gross),grossVat:pence(o.gross_vat),discount:pence(o.discount),discountVat:pence(o.discount_vat),shipping:pence(o.shipping),shippingVat:pence(o.shipping_vat),basis:o.tax_basis});
  const sale={id:gid('OrderTransaction',Number(id)*10),kind:'SALE',status:'SUCCESS',processedAt:o.occurredAt,amountSet:money(n.customerCharge)};
  const refunds=manifest.refunds.filter(r=>r.order_id===o.id).map(r=>{
   const rid=20001+manifest.refunds.indexOf(r),tx={id:gid('OrderTransaction',Number(id)*10+1),kind:'REFUND',status:'SUCCESS',processedAt:r.occurredAt,amountSet:money(pence(r.amount))};
   return {id:gid('Refund',rid),createdAt:r.occurredAt,updatedAt:r.occurredAt,totalRefundedSet:money(pence(r.amount)),transactions:connection([tx]),orderAdjustments:connection([]),refundLineItems:connection([{id:gid('RefundLineItem',rid),quantity:1,lineItem:{id:lineId},subtotalSet:money(pence(r.product_cash)-pence(r.product_vat)),totalTaxSet:money(pence(r.product_vat))}]),refundShippingLines:connection(pence(r.shipping_cash)?[{id:gid('RefundShippingLine',rid),shippingLine:{id:shippingId},subtotalAmountSet:money(pence(r.shipping_cash)-pence(r.shipping_vat)),taxAmountSet:money(pence(r.shipping_vat))}]:[])};
  });
  const transactions=[sale,...refunds.flatMap(r=>r.transactions.nodes)];
  return {id:gid('Order',id),createdAt:o.occurredAt,processedAt:o.occurredAt,updatedAt:refunds.at(-1)?.updatedAt??o.occurredAt,cancelledAt:null,test:false,edited:false,taxesIncluded:false,currencyCode:'GBP',displayFinancialStatus:refunds.length?'PARTIALLY_REFUNDED':'PAID',originalTotalPriceSet:money(n.customerCharge),totalDiscountsSet:money(n.discountExVat),totalTaxSet:money(n.productVat+n.shippingVat),totalShippingPriceSet:money(n.netShipping),transactions,transactionsCount:{count:transactions.length,precision:'EXACT'},refunds,
   lineItems:connection([{id:lineId,quantity:o.id.endsWith('b')?2:1,isGiftCard:false,originalTotalSet:money(n.grossProductExVat),discountAllocations:[{allocatedAmountSet:money(n.discountExVat)}],taxLines:[{priceSet:money(n.productVat)}]}]),shippingLines:connection(n.netShipping?[{id:shippingId,isRemoved:false,originalPriceSet:money(n.netShipping),discountedPriceSet:money(n.netShipping),taxLines:[{priceSet:money(n.shippingVat)}]}]:[])};
 });
 return {manifest,sourceOrderIds,data:{status:'details_for_mapping',apiVersion:'2026-07',settings:{shopId:gid('Shop',7),domain:'historical-pipeline.invalid',currency:'GBP',timezone:'Europe/London'},orders}};
}
export async function historicalReportingFixture(){
 const {db}=await setup();
 for(const name of ['ingest_v1_import_service','ingest_v1_import_receipts','ingest_v1_incremental_receipts','ingest_v1_review_restoration','ingest_v1_review_service'])await db.exec(sql(`proposed/${name}.sql`));
 const {manifest,sourceOrderIds,data}=historicalExtraction();
 await db.query("INSERT INTO stores(id,shopify_domain,shopify_store_id,name) VALUES($1,'historical-pipeline.invalid','7','Disposable Synthetic Historical Pipeline')",[HISTORICAL_REPORTING_STORE]);
 await db.query('INSERT INTO store_memberships VALUES($1,$2)',[U,HISTORICAL_REPORTING_STORE]);
 await db.query('INSERT INTO ingest_v1.review_authorizations VALUES($1,$2)',[HISTORICAL_REPORTING_STORE,U]);
 const scopes=Object.fromEntries(PERIODS.map(([month])=>[month,{...historicalInput(month).scope,storeId:HISTORICAL_REPORTING_STORE}]));
 scopes['2025-09-partial']={...historicalInput('2025-09',{throughDay:17}).scope,storeId:HISTORICAL_REPORTING_STORE};
 const inputs={};
 for(const [key,scope] of Object.entries(scopes)){
  const candidate=await recordShopifyCandidate(db,data,{...scope,shopId:data.settings.shopId});
  if(candidate.mappingState!=='mapped_for_review')throw Error(JSON.stringify(candidate));
  inputs[key]={...scope,batchId:candidate.batchId};
 }
 const importer={transaction:fn=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE night_scout_import_service');return fn(tx);})};
 const importEvidence=async()=>{
  const results={};for(const [key,input] of Object.entries(inputs))results[key]=await(key==='2025-08'?importFirstEvidence:importSubsequentEvidence)(importer,input);
  return results;
 };
 const review=async key=>{
  if(!inputs[key])throw Error('Unknown exact fixture period');
  await db.exec('SET ROLE night_scout_review_service');try{
   const scope=inputs[key],packet=await prepareCandidateReview(db,scope);
   if(packet.status!=='awaiting_independent_coverage_review')throw Error(JSON.stringify(packet));
   return await restoreReviewedPeriod(db,{scope,batchId:packet.batchId,snapshotDigest:packet.snapshotDigest,coverageConfirmed:true,evidenceRef:'disposable-historical-manifest-v1',completenessStatement:'Invented disposable fixture only: all132 original sales and two refund events reconcile to the fixed manifest. This exact-period synthetic attestation says nothing about live Shopify coverage.'},{authenticateReviewer:async()=>({id:U})});
  }finally{await db.exec('RESET ROLE');}
 };
 const read=async(key,storeId=HISTORICAL_REPORTING_STORE)=>{
  if(!scopes[key])throw Error('Unknown exact fixture period');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[U]);await db.exec('SET ROLE authenticated');try{
   return await fetchVerifiedSales(async(_,p)=>({data:(await db.query('SELECT public.verified_sales_source($1,$2,$3) data',[p.p_store_id,p.p_date_from,p.p_date_to])).rows[0].data,error:null}),{...scopes[key],storeId});
  }finally{await db.exec('RESET ROLE');}
 };
 const orderIds=async()=>{const rows=(await db.query('SELECT id,shopify_order_id FROM orders WHERE store_id=$1',[HISTORICAL_REPORTING_STORE])).rows;return new Map([...sourceOrderIds].map(([original,source])=>[original,rows.find(r=>r.shopify_order_id===source)?.id]));};
 return {db,manifest,data,sourceOrderIds,scopes,inputs,importEvidence,review,read,orderIds,provenance:'disposable-synthetic-api-shaped-exclusive-equivalents-only'};
}
