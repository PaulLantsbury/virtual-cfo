import {setTimeout as delay} from 'node:timers/promises';
import {API_VERSION} from './queries.mjs';
import {createShopifyReader} from './client.mjs';
import {verifyShopifyConnection} from './verify-connection.mjs';
import {prepareCustomerIdentityObservation} from './customer-identity-proposal.mjs';
export const CUSTOMER_IDENTITIES_QUERY='query NightScoutCustomerIdentities($after: String) { orders(first: 100, after: $after, sortKey: ID) { pageInfo { hasNextPage endCursor } nodes { id updatedAt customer { id } } } }';
const failure='Customer identity collection incomplete; no observation batch returned';
const ensure=ok=>{if(!ok)throw Error(failure);};
/** Separate server-only path. Never extends or mutates financial source objects.
 * Successful pagination is not a transactionally isolated snapshot or financial
 * completeness assertion. Only projected IDs/timestamps leave this function.
 */
export async function collectCustomerIdentities({connection,storeId,resolveCredential,fetchImpl=globalThis.fetch,sleep=(ms,signal)=>delay(ms,undefined,{signal}),signal,maxPages=10,timeoutMs=60000,now=()=>new Date()}={}){
 const controller=new AbortController();let timer,onAbort;
 const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 try{
 ensure(typeof storeId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)&&typeof resolveCredential==='function'&&Number.isInteger(maxPages)&&maxPages>0&&maxPages<=10&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=60000);
 timer=setTimeout(cancel,timeoutMs);
 const aborted=new Promise((_,reject)=>{onAbort=()=>reject(Error(failure));controller.signal.addEventListener('abort',onAbort,{once:true});if(controller.signal.aborted)onAbort();});
 return await Promise.race([aborted,(async()=>{
 let token;
 const checked=await verifyShopifyConnection({connection,resolveCredential:async(...args)=>{token=await resolveCredential(...args);return token;},fetchImpl,sleep,signal:controller.signal,timeoutMs});
 controller.signal.throwIfAborted();
 ensure(typeof token==='string'&&token.trim());
 const contextRead=createShopifyReader({domain:checked.settings.domain,accessToken:token,fetchImpl,sleep});
 async function identityPermission(){const c=await contextRead('context',{},controller.signal);ensure(c.shop?.id===checked.settings.shopId&&c.shop?.myshopifyDomain===checked.settings.domain&&c.shop?.currencyCode===checked.settings.currency&&c.shop?.ianaTimezone===checked.settings.timezone&&Array.isArray(c.currentAppInstallation?.accessScopes)&&['read_orders','read_all_orders','read_customers'].every(required=>c.currentAppInstallation.accessScopes.some(s=>s?.handle===required)));}
 await identityPermission();
 const endpoint=`https://${checked.settings.domain}/admin/api/${API_VERSION}/graphql.json`;
 async function read(after){
 for(let attempt=0;attempt<3;attempt++){
 controller.signal.throwIfAborted();
 const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]),headers:{'Content-Type':'application/json','X-Shopify-Access-Token':token},body:JSON.stringify({query:CUSTOMER_IDENTITIES_QUERY,variables:{after}})});
 if([429,502,503].includes(response.status)){ensure(attempt<2);const requested=Number(response.headers.get('retry-after'));await sleep(Number.isFinite(requested)&&requested>0?Math.min(requested*1000,5000):500*(attempt+1),controller.signal);continue;}
 ensure(response.ok&&response.headers.get('x-shopify-api-version')===API_VERSION);
 const size=Number(response.headers.get('content-length'));ensure(!Number.isFinite(size)||size<=1048576);
 const text=await response.text();ensure(Buffer.byteLength(text,'utf8')<=1048576);const payload=JSON.parse(text);
 if(Array.isArray(payload?.errors)&&payload.errors.length&&payload.errors.every(e=>e.extensions?.code==='THROTTLED')&&attempt<2){await sleep(1000*(attempt+1),controller.signal);continue;}
 ensure(payload&&typeof payload==='object'&&(payload.errors===undefined||(Array.isArray(payload.errors)&&payload.errors.length===0))&&payload.data&&typeof payload.data==='object');
 return payload.data;
 }
 throw Error(failure);
 }
 const observedAt=now().toISOString(),observations=[],ids=new Set(),cursors=new Set();let after=null;
 for(let page=0;;page++){
 ensure(page<maxPages);controller.signal.throwIfAborted();const data=await read(after),orders=data.orders;
 ensure(orders&&Array.isArray(orders.nodes)&&orders.nodes.length<=100&&typeof orders.pageInfo?.hasNextPage==='boolean');
 for(const order of orders.nodes){
 ensure(!ids.has(order?.id));const observation=prepareCustomerIdentityObservation({data:{order},storeId,shopId:checked.settings.shopId,expectedOrderId:order?.id,observedAt});
 ids.add(observation.shopifyOrderId);observations.push(observation);ensure(observations.length<=1000);
 }
 const {hasNextPage,endCursor}=orders.pageInfo;if(!hasNextPage)break;
 ensure(orders.nodes.length>0&&typeof endCursor==='string'&&endCursor.length>0&&endCursor.length<=4096&&!cursors.has(endCursor));cursors.add(endCursor);after=endCursor;
 }
 await verifyShopifyConnection({connection:checked.settings,resolveCredential:async()=>token,fetchImpl,sleep,signal:controller.signal,timeoutMs});await identityPermission();controller.signal.throwIfAborted();
 return {status:'identity_observations_collected',apiVersion:API_VERSION,storeId,shopId:checked.settings.shopId,observations,financialDataChanged:false,customerMetricsDerived:false,coverageCertified:false,limitations:['NOT_SNAPSHOT_ISOLATED']};
 })()]);
 }catch{throw Error(failure);}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(onAbort)controller.signal.removeEventListener('abort',onAbort);}
}
