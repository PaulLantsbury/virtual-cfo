import {setup,sql} from './finance-fixture.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {expected,contextFixture,pageFixture,orderFixture,detailsFixture} from './fixtures.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';
const C='90000000-0000-4000-8000-000000000003';
export async function importFixture(database,options){
 const {db}=await setup(database,options);
 await db.exec(options?.reuseImportRole?sql('proposed/ingest_v1_import_service.sql').replace(/^CREATE ROLE night_scout_import_service.*;$/m,''):sql('proposed/ingest_v1_import_service.sql'));
 await db.exec(sql('proposed/ingest_v1_import_receipts.sql'));
 await db.query("INSERT INTO stores(id,shopify_domain,shopify_store_id) VALUES($1,'new-fixture.myshopify.com','3')",[C]);
 const request=async op=>op==='context'?contextFixture():op==='orders'?pageFixture([orderFixture()]):detailsFixture();
 const data=await loadShopifyDetails(request,await collectShopifyOrders(request,expected));
 data.settings={...data.settings,domain:'new-fixture.myshopify.com',shopId:'gid://shopify/Shop/3'};
 const scope={storeId:C,from:'2026-02-01',to:'2026-02-28',shopId:data.settings.shopId};
 const recorded=await recordShopifyCandidate(db,data,scope);
 return {db,input:{...scope,batchId:recorded.batchId}};
}
