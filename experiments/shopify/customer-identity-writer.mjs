import {eventDay} from '../financial-v1/event-evidence.mjs';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
const keys=['identityCollectionVersion','storeId','shopId','shopifyOrderId','shopifyCustomerId','sourceOrderUpdatedAt','observedAt'].sort().join(',');
const gid=(value,type)=>typeof value==='string'&&new RegExp(`^gid://shopify/${type}/[1-9][0-9]*$`).test(value);
const instant=value=>{try{eventDay(value,'UTC');return true;}catch{return false;}};
const valid=ok=>{if(!ok)throw Error('Invalid customer identity observation');};
/** Server-only append-only sidecar. Caller must verify Shopify identity before
 * collection and inject the authorised intakeDatabase capability. No collector,
 * financial candidate, public.orders.customer_id or customer metric is changed.
 * The unique source fact excludes observedAt; unchanged retries preserve the
 * first recorded observation time. Conflicting facts remain separate history.
 */
export async function recordCustomerIdentityObservations(db,observations){
 valid(typeof db?.transaction==='function'&&Array.isArray(observations)&&observations.length<=1000);
 const projected=observations.map(o=>{
 valid(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===keys&&o.identityCollectionVersion===1&&o.storeId===target.storeId&&o.shopId===target.shopId&&gid(o.shopifyOrderId,'Order')&&(o.shopifyCustomerId===null||gid(o.shopifyCustomerId,'Customer'))&&instant(o.sourceOrderUpdatedAt)&&instant(o.observedAt));
 return {identityCollectionVersion:1,storeId:target.storeId,shopId:target.shopId,shopifyOrderId:o.shopifyOrderId,shopifyCustomerId:o.shopifyCustomerId,sourceOrderUpdatedAt:new Date(o.sourceOrderUpdatedAt).toISOString(),observedAt:new Date(o.observedAt).toISOString()};
 });
 try{return await db.transaction(async tx=>{
 const rows=(await tx.query('SELECT shopify_domain,shopify_store_id,currency_code,timezone FROM public.stores WHERE id=$1',[target.storeId])).rows;
 valid(rows.length===1&&rows[0].shopify_domain===target.domain&&rows[0].shopify_store_id==='95601983836'&&rows[0].currency_code.trim()===target.currency&&rows[0].timezone===target.timezone);
 let insertedCount=0;
 for(const o of projected){
 const inserted=await tx.query('INSERT INTO shopify_identity_v1.order_observations(identity_collection_version,store_id,shop_id,shopify_order_id,shopify_customer_id,source_order_updated_at,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id',[1,o.storeId,o.shopId,o.shopifyOrderId,o.shopifyCustomerId,o.sourceOrderUpdatedAt,o.observedAt]);
 valid(inserted.rows.length<=1);insertedCount+=inserted.rows.length;
 }
 return {status:'identity_observations_recorded',insertedCount,replayCount:projected.length-insertedCount,financialDataChanged:false,customerMetricsDerived:false};
 });}catch{throw Error('Customer identity observation outcome unconfirmed; inspect retained observations before retrying');}
}
