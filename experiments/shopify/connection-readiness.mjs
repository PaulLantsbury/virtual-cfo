import {createShopifyReader} from './client.mjs';
import {collectShopifyOrders} from './collect.mjs';
import {loadShopifyDetails} from './map-sales.mjs';
import {recordShopifyCandidate} from './record-candidate.mjs';

/** Server-only operator seam, not an HTTP endpoint or an authorisation layer.
 * Caller must provide an already authorised candidate-intake database capability.
 * It must NOT use the reviewer/import login or expose this function to browsers.
 * Credentials are supplied just-in-time and never returned, persisted or logged.
 * Existing candidate writer owns replay and changed-source invalidation; review,
 * import and coverage restoration remain separate existing authorised workflows.
 */
export function createConnectionReadiness({connection,scope,resolveCredential,db,fetchImpl=globalThis.fetch,sleep}) {
 const bad=()=>{throw new Error('Invalid Shopify connection readiness configuration');};
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!connection||!/^gid:\/\/shopify\/Shop\/[0-9]+$/.test(connection.shopId)||! /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(connection.domain)||!uuid.test(scope?.storeId)||scope.shopId!==connection.shopId||!day(scope.from)||!day(scope.to)||scope.from>scope.to||typeof resolveCredential!=='function'||typeof db?.transaction!=='function')bad();
 const expected=Object.freeze({shopId:connection.shopId,domain:connection.domain});
 const period=Object.freeze({storeId:scope.storeId,shopId:scope.shopId,from:scope.from,to:scope.to});
 let running=false;
 return {async run({signal,maxPages=100}={}) {
  if(running)throw new Error('Shopify connection collection already running');
  running=true;
  try {
   signal?.throwIfAborted();
   const credential=await resolveCredential(expected);
   const read=createShopifyReader({domain:expected.domain,accessToken:credential,fetchImpl,...(sleep?{sleep}:{})});
   const extracted=await collectShopifyOrders(read,expected,{signal,maxPages});
   const detailed=await loadShopifyDetails(read,extracted,{signal});
   signal?.throwIfAborted();
   const result=await recordShopifyCandidate(db,detailed,period);
   return {...result,coverageCertified:false,reviewRequired:true};
  } catch {
   // A failed or uncertain write must be inspected/retried through existing
   // idempotent candidate protocol, never reported as definitely unwritten.
   throw new Error('Shopify collection outcome unconfirmed; inspect candidate state before retrying');
  } finally {running=false;}
 }};
}
