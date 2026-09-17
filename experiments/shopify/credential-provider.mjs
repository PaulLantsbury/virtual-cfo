/** Server-only client-credentials flow for an installed app/store in the same
 * Shopify organisation. Not merchant OAuth, an endpoint or an authority check.
 * loadCredentials must read approved private configuration; never log its value.
 * Official flow: https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
 */
export function createShopifyCredentialProvider({domain,loadCredentials,fetchImpl=globalThis.fetch,now=Date.now,timeoutMs=15000}={}) {
 const validDomain=typeof domain==='string'&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(domain);
 if(!validDomain||typeof loadCredentials!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)throw new Error('Invalid Shopify credential provider configuration');
 const endpoint=`https://${domain}/admin/oauth/access_token`;
 let cached=null,pending=null,generation=0;
 const failure=()=>new Error('Shopify authentication unavailable; check private credentials and app installation');
 const validSecret=value=>typeof value==='string'&&value.length>0&&value.length<=4096&&!/[\s\x00-\x1f\x7f]/.test(value);
 const time=()=>{const value=now();if(!Number.isFinite(value)||value<0)throw failure();return value;};

 // The timeout covers private loading, network headers and body parsing. Caller
 // cancellation stops that caller's wait without cancelling another caller.
 async function exchange(version) {
  const controller=new AbortController();
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(failure());},timeoutMs);});
  try {
   return await Promise.race([timeout,(async()=>{
    const credentials=await loadCredentials();
    if(controller.signal.aborted||!validSecret(credentials?.clientId)||!validSecret(credentials?.clientSecret))throw failure();
    const started=time();
    const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',signal:controller.signal,
     headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},
     body:new URLSearchParams({grant_type:'client_credentials',client_id:credentials.clientId,client_secret:credentials.clientSecret}).toString()});
    if(!response.ok||response.redirected)throw failure();
    const payload=await response.json();
    if(controller.signal.aborted||version!==generation||!validSecret(payload?.access_token)||!Number.isInteger(payload.expires_in)||payload.expires_in<=60||payload.expires_in>86400)throw failure();
    const expiresAt=started+payload.expires_in*1000;
    if(time()>=expiresAt-60000)throw failure();
    cached={token:payload.access_token,expiresAt};
    return cached.token;
   })()]);
  } catch {throw failure();} finally {clearTimeout(timer);}
 }
 async function waitFor(promise,signal) {
  if(!signal)return promise;
  if(signal.aborted)throw new Error('Shopify authentication cancelled');
  let onAbort;
  const cancelled=new Promise((_,reject)=>{onAbort=()=>reject(new Error('Shopify authentication cancelled'));signal.addEventListener('abort',onAbort,{once:true});});
  try{return await Promise.race([promise,cancelled]);}finally{signal.removeEventListener('abort',onAbort);}
 }
 return Object.freeze({
  async resolveCredential(expected={domain},{signal}={}) {
   if(expected?.domain!==domain)throw new Error('Shopify credential store mismatch');
   if(signal?.aborted)throw new Error('Shopify authentication cancelled');
   if(cached&&time()<cached.expiresAt-60000)return cached.token;
   cached=null;
   if(!pending){
    const request=exchange(generation);
    pending=request;
    // An old exchange must not clear a newer exchange after invalidation.
    void request.then(()=>{if(pending===request)pending=null;},()=>{if(pending===request)pending=null;});
   }
   return waitFor(pending,signal);
  },
  // Call on access rejection/revocation or after private credential rotation.
  // Never silently retry a financial operation with a refreshed credential.
  invalidate(){generation++;cached=null;pending=null;},
 });
}
