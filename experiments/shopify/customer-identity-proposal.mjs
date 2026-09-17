// PREPARATION ONLY: not used by the live collector, importer or browser.
// No network call, credential lookup, database write or repeat-customer calculation.
export const CUSTOMER_IDENTITY_QUERY='query NightScoutCustomerIdentity($id: ID!) { order(id: $id) { id updatedAt customer { id } } }';
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
const gid=(value,type)=>typeof value==='string'&&new RegExp(`^gid://shopify/${type}/[1-9][0-9]*$`).test(value);
const instant=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
/** Caller must independently authenticate/verify this store's Shopify connection.
 * Explicit source null means no identifier was supplied, not a synthetic guest ID.
 * Missing customer selection is incomplete collection and cannot become null.
 */
export function prepareCustomerIdentityObservation({data,storeId,shopId,expectedOrderId,observedAt}){
 requireValue(typeof storeId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)&&gid(shopId,'Shop')&&gid(expectedOrderId,'Order')&&instant(observedAt),'Invalid identity observation scope');
 const order=data?.order;
 requireValue(order?.id===expectedOrderId&&instant(order.updatedAt)&&Object.hasOwn(order,'customer'),'Incomplete customer identity observation');
 requireValue(order.customer===null||(order.customer&&gid(order.customer.id,'Customer')),'Invalid customer identifier');
 return Object.freeze({identityCollectionVersion:1,storeId,shopId,shopifyOrderId:order.id,shopifyCustomerId:order.customer===null?null:order.customer.id,sourceOrderUpdatedAt:new Date(order.updatedAt).toISOString(),observedAt:new Date(observedAt).toISOString()});
}
