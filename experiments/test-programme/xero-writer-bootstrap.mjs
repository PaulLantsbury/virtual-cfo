import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {encryptStagingEnvelope} from './writer-envelope-crypto.mjs';
import {validWriterScopes} from './writer-oauth-scopes.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex'),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createXeroWriterBootstrap({enabled=false,projectRef,ownerId,storeId,expectedTenant,clientId,clientSecret,redirectUri,masterKey,keyVersion,pool,authenticate,fetchImpl=fetch}){
 if(!enabled)return undefined;
 if(projectRef!=='bioalckltvkhlczusdvl' || !uuid.test(ownerId) || !uuid.test(storeId) || expectedTenant!==undefined && !uuid.test(expectedTenant) || !clientId || !clientSecret || redirectUri!=='https://night-scout-xero-staging.onrender.com/api/xero/test-writer/callback' || typeof masterKey!=='string' || masterKey.length<32 || !keyVersion || !pool || typeof authenticate!=='function')throw new Error('Xero writer setup unavailable');
 const rpc=async(sql,args)=>(await pool.query(sql,args)).rows;
 async function request(url,options){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const r=await fetchImpl(url,{...options,redirect:'error',signal:controller.signal});if(!r.ok || r.redirected)throw new Error('Unavailable');
   const reader=r.body?.getReader();if(!reader)throw new Error('Unavailable');let size=0;const chunks=[];
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new Error('Unavailable');}chunks.push(Buffer.from(value));}
   return JSON.parse(Buffer.concat(chunks,size).toString());
  }finally{clearTimeout(timer);}
 }
 return Object.freeze({
  async start(authorization){
   try{
    if(typeof authorization!=='string' || authorization.length>8192 || !/^Bearer [^\s,]+$/i.test(authorization))throw new Error('Unavailable');
    const principal=await authenticate(authorization);if(principal?.userId!==ownerId || principal.isOwner!==true)throw new Error('Unavailable');
    const state=randomBytes(32).toString('base64url');const r=await rpc('SELECT staging_test_programme.start_writer_consent($1,$2,$3) AS ok',[hash(state),ownerId,storeId]);if(r.length!==1 || r[0].ok!==true)throw new Error('Unavailable');
    const url=new URL('https://login.xero.com/identity/connect/authorize');url.searchParams.set('response_type','code');url.searchParams.set('client_id',clientId);url.searchParams.set('redirect_uri',redirectUri);url.searchParams.set('scope','offline_access accounting.invoices accounting.settings.read accounting.contacts.read');url.searchParams.set('state',state);return Object.freeze({url:url.toString()});
   }catch{throw new Error('Xero writer setup unavailable');}
  },
  async complete({state,code}){
   try{
    if(typeof state!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(state) || typeof code!=='string' || code.length<8 || code.length>4096 || !/^[A-Za-z0-9._~-]+$/.test(code))throw new Error('Unavailable');
    const digest=hash(state);const claimed=await rpc('SELECT staging_test_programme.consume_writer_consent($1,$2,$3) AS ok',[digest,ownerId,storeId]);if(claimed.length!==1 || claimed[0].ok!==true)throw new Error('Unavailable');
    const tokens=await request('https://identity.xero.com/connect/token',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri}).toString()});
    if(!validWriterScopes(tokens.scope) || typeof tokens.refresh_token!=='string' || tokens.refresh_token.length<16 || tokens.refresh_token.length>8192 || typeof tokens.access_token!=='string' || tokens.access_token.length<16 || tokens.access_token.length>8192)throw new Error('Unavailable');
    const headers={Authorization:`Bearer ${tokens.access_token}`,Accept:'application/json'};
    const connections=await request('https://api.xero.com/connections',{method:'GET',headers});
    if(!Array.isArray(connections) || connections.length>100)throw new Error('Unavailable');
    const candidates=connections.filter(c=>c.tenantType==='ORGANISATION' && uuid.test(c.tenantId) && (expectedTenant===undefined || c.tenantId===expectedTenant));if(candidates.length!==1)throw new Error('Unavailable');
    const tenant=candidates[0].tenantId;
    const org=await request('https://api.xero.com/api.xro/2.0/Organisation',{method:'GET',headers:{...headers,'Xero-tenant-id':tenant}});
    if(org.Organisations?.length!==1 || org.Organisations[0].IsDemoCompany!==true || org.Organisations[0].BaseCurrency!=='GBP')throw new Error('Unavailable');
    const connectionId=randomUUID();const e=encryptStagingEnvelope(masterKey,{connectionId,tenantId:tenant,keyVersion},tokens.refresh_token);
    const result=await rpc('SELECT staging_test_programme.seed_writer_consent($1,$2,$3,$4,$5,$6,$7,$8) AS ok',[digest,ownerId,storeId,tenant,connectionId,e.ciphertext,e.encryptedDek,keyVersion]);
    if(result.length!==1 || result[0].ok!==true)throw new Error('Unavailable');
    return Object.freeze({state:'writer_connected_programme_disabled'});
   }catch{throw new Error('Xero writer setup unavailable');}
  },
 });
}
