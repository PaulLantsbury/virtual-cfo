import {setTimeout as delay} from 'node:timers/promises';
import {API_VERSION,QUERIES} from './queries.mjs';

/** Server-only building block. No credential storage, logging, OAuth, mutations or browser integration. */
export function createShopifyReader({domain,accessToken,fetchImpl=globalThis.fetch,sleep=(ms,signal)=>delay(ms,undefined,{signal}),maxAttempts=3}) {
 if(typeof domain!=='string'||!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain))throw new Error('Canonical Shopify domain required');
 if(typeof accessToken!=='string'||!accessToken.trim())throw new Error('Shopify access token required');
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw new Error('Invalid retry limit');
 const endpoint=`https://${domain}/admin/api/${API_VERSION}/graphql.json`;
 return async function read(operation,variables={},signal){
  if(!Object.hasOwn(QUERIES,operation))throw new Error('Unsupported read operation');
  for(let attempt=0;attempt<maxAttempts;attempt++){
   signal?.throwIfAborted();
   let response;
   try {response=await fetchImpl(endpoint,{method:'POST',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),
    headers:{'Content-Type':'application/json','X-Shopify-Access-Token':accessToken},body:JSON.stringify({query:QUERIES[operation],variables})});}
   catch {throw new Error(signal?.aborted?'Shopify read cancelled':'Shopify network request failed');}
   if([429,502,503].includes(response.status)){
    if(attempt===maxAttempts-1)throw new Error('Shopify temporarily unavailable; retry limit reached');
    const requested=Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(requested)&&requested>0?Math.min(requested*1000,5000):500*(attempt+1),signal);continue;
   }
   if(!response.ok)throw new Error(response.status===401||response.status===403?'Shopify access denied':'Shopify HTTP request failed');
   if(response.headers.get('x-shopify-api-version')!==API_VERSION)throw new Error('Shopify API version mismatch');
   let payload;try{payload=await response.json();}catch{throw new Error('Invalid Shopify JSON response');}
   if(!payload||typeof payload!=="object")throw new Error("Invalid Shopify response envelope");
   if(payload.errors!==undefined){
    const errors=payload.errors;
    if(Array.isArray(errors)&&errors.length===0){}else if(Array.isArray(errors)&&errors.length&&errors.every(e=>e.extensions?.code==='THROTTLED')&&attempt<maxAttempts-1){await sleep(1000*(attempt+1),signal);continue;}
    else throw new Error('Shopify GraphQL request failed');
   }
   if(!payload.data||typeof payload.data!=='object')throw new Error('Missing Shopify data');
   return payload.data;
  }
 };
}
