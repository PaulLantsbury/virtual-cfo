export async function mintShopifyWriterToken({target,clientId,clientSecret,fetchImpl=fetch}) {
 if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(target) || typeof clientId!=='string' || !clientId || typeof clientSecret!=='string' || !clientSecret)throw new Error('SHOPIFY_TEST_WRITER_UNAVAILABLE');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 async function request(url,options){
  const response=await fetchImpl(url,{...options,redirect:'error',signal:controller.signal});
  if(!response.ok || response.redirected)throw new Error('Unavailable');
  const reader=response.body?.getReader();if(!reader)throw new Error('Unavailable');
  const chunks=[];let n=0;while(true){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>32768){await reader.cancel();throw new Error('Unavailable');}chunks.push(Buffer.from(value));}
  return JSON.parse(Buffer.concat(chunks,n).toString());
 }
 try {
  const token=await request(`https://${target}/admin/oauth/access_token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret}).toString()});
  if(typeof token.access_token!=='string' || token.access_token.length<16 || token.access_token.length>4096 || !Number.isInteger(token.expires_in) || token.expires_in<=60 || token.expires_in>86400)throw new Error('Unavailable');
  const r=await request(`https://${target}/admin/oauth/access_scopes.json`,{method:'GET',headers:{'X-Shopify-Access-Token':token.access_token,Accept:'application/json'}});
  const allowed=new Set(['read_orders','read_all_orders','write_orders']);
  if(!Array.isArray(r.access_scopes) || r.access_scopes.length>3 || !r.access_scopes.some(s=>s.handle==='write_orders') || !r.access_scopes.some(s=>s.handle==='read_orders') || !r.access_scopes.every(s=>allowed.has(s.handle)) || new Set(r.access_scopes.map(s=>s.handle)).size!==r.access_scopes.length)throw new Error('Unavailable');
  return token.access_token;
 }catch{throw new Error('SHOPIFY_TEST_WRITER_UNAVAILABLE');}finally{clearTimeout(timer);}
}
