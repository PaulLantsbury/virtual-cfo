import {validWriterScopes} from './writer-oauth-scopes.mjs';
import {isXeroReaderContextProofSource,isXeroOwnerSessionBindingReceipt} from './xero-reader-context-proof.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable=()=>Error('Xero writer source proof unavailable');
export const validXeroSourceSelection=selection=>!!selection&&Object.keys(selection).sort().join(',')==='accountId,confirmedNonStockAccountId,confirmedSyntheticContactId,contactId,separateWriterAppConfirmed'&&UUID.test(selection.contactId??'')&&UUID.test(selection.accountId??'')&&selection.confirmedSyntheticContactId===selection.contactId&&selection.confirmedNonStockAccountId===selection.accountId&&selection.separateWriterAppConfirmed===true;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
/** Server-only source verification using the fresh OAuth callback access token.
 * Only three fixed GETs; no token refresh, writes, DB access or retained source body.
 * Synthetic/non-stock intent comes from bound owner confirmations, not Xero names.
 */
export async function verifyXeroWriterSourceProof({accessToken,tenantId,grantedScopes,selection,ownerId,storeId,readerContextSource,readerBindingReceipt,fetchImpl=fetch,now=()=>new Date()}={}){
 try{
  if(typeof accessToken!=='string'||accessToken.length<16||accessToken.length>8192||!UUID.test(tenantId??'')||!UUID.test(ownerId??'')||!UUID.test(storeId??'')||!validWriterScopes(grantedScopes)||!grantedScopes.split(' ').includes('accounting.contacts.read')||!validXeroSourceSelection(selection)||typeof fetchImpl!=='function'||typeof now!=='function')throw unavailable();
  const headers={Authorization:`Bearer ${accessToken}`,'Xero-tenant-id':tenantId,Accept:'application/json'};
  async function get(path){
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);let reader;
   try{
    const r=await fetchImpl(`https://api.xero.com/api.xro/2.0/${path}`,{method:'GET',headers,redirect:'error',signal:controller.signal});
    if(!r?.ok||r.redirected||Number(r.headers?.get?.('content-length'))>65536)throw unavailable();
    reader=r.body?.getReader();if(!reader)throw unavailable();let size=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw unavailable();}chunks.push(Buffer.from(value));}
    return JSON.parse(Buffer.concat(chunks,size).toString('utf8'));
   }finally{clearTimeout(timeout);reader?.releaseLock();}
  }
  // Sequence stops before contact retrieval if this is not the actual GBP demo.
  const org=await get('Organisation');
  if(org.Organisations?.length!==1||org.Organisations[0].BaseCurrency!=='GBP'||org.Organisations[0].IsDemoCompany!==true)throw unavailable();
  const contact=await get(`Contacts/${selection.contactId}`);
  if(contact.Contacts?.length!==1||contact.Contacts[0].ContactID!==selection.contactId||contact.Contacts[0].ContactStatus!=='ACTIVE')throw unavailable();
  const account=await get(`Accounts/${selection.accountId}`),a=account.Accounts?.[0];
  if(account.Accounts?.length!==1||a.AccountID!==selection.accountId||a.Status!=='ACTIVE'||!['REVENUE','SALES'].includes(a.Type)||typeof a.Code!=='string'||!/^[A-Za-z0-9_-]{1,20}$/.test(a.Code))throw unavailable();
  const clock=now();if(!(clock instanceof Date)||!Number.isFinite(clock.valueOf()))throw unavailable();
  const observedAt=clock.toISOString();
  const providerReceipt={tenantId,baseCurrency:'GBP',isDemoCompany:true,separateWriterApp:true,grantedScopes,contactId:selection.contactId,contactIsExistingSynthetic:true,accountCode:a.Code,accountIsActiveNonStockRevenue:true,observedAt};
  let readerReceipt=null,readerState='unavailable';
  if(isXeroReaderContextProofSource(readerContextSource)){
   try{readerReceipt=await readerContextSource.read({ownerId,storeId});readerState=readerReceipt.target===tenantId?'matched':'mismatched';}catch{}
  }
  const binding=isXeroOwnerSessionBindingReceipt(readerBindingReceipt)&&readerBindingReceipt.storeId===storeId&&readerBindingReceipt.ownerId===ownerId&&Date.parse(readerBindingReceipt.observedAt)<=clock.valueOf()&&Date.parse(readerBindingReceipt.expiresAt)>clock.valueOf()?readerBindingReceipt:null;
  const conflicting=!!(readerReceipt&&binding&&readerReceipt.target!==binding.target);
  const readerHealthVerified=!conflicting&&readerState==='matched';
  const tenantBindingVerified=!conflicting&&(readerHealthVerified||readerState!=='mismatched'&&binding?.target===tenantId);
  if(conflicting)readerState='conflicting_reader_evidence';
  if(!readerReceipt&&binding)readerState=binding.target===tenantId?'binding_matched_health_unverified':'mismatched';
  return freeze({state:tenantBindingVerified?'source_proof_complete':'source_proof_incomplete',providerReceipt,readerReceipt,readerBindingReceipt:binding,readerState,tenantBindingVerified:!!tenantBindingVerified,readerHealthVerified,limitations:conflicting?['conflicting_reader_bindings','reader_health_not_verified']:readerHealthVerified?[]:['reader_health_not_verified'],observedAt,expiresAt:new Date(Math.min(clock.valueOf()+3600000,readerReceipt?Date.parse(readerReceipt.observedAt)+3600000:Infinity,binding?Date.parse(binding.expiresAt):Infinity)).toISOString(),providerReads:3,providerWrites:0,credentialRefreshes:0,activationAuthorized:false,
   provenance:{provider:'fresh_oauth_access_token_fixed_gets',contactExistenceAndStatus:'xero_api',syntheticContactIntent:'owner_confirmed_exact_contact_id',accountStatusAndRevenueType:'xero_api',nonStockUse:'owner_confirmed_exact_account_id_no_item_invoice',separateWriterApp:'operator_app_boundary_confirmation',reader:readerReceipt?.provenance??binding?.provenance??'not_verified'}});
 }catch{throw unavailable();}
}
