import {createStagingXeroConnectionPreflight} from './xero-connection-preflight.mjs';
const organisationUrl='https://api.xero.com/api.xro/2.0/Organisation';
const maxBytes=262144;
const currencies=new Set(Intl.supportedValuesOf('currency'));
const reasons=new Set(['ok','invalid_grant','refresh_failed','insufficient_scope','unauthorized','forbidden','reconnect_required','rate_limited','upstream_unavailable','provider_unavailable','network_failure','malformed_response']);
const unavailable=()=>Error('Xero reader organisation check unavailable');

async function organisationFact(response,timeoutMs){
 let reader,timer;
 try{
  if(!response?.ok||response.redirected!==false||response.url&&response.url!==organisationUrl||typeof response.clone!=='function'||Number(response.headers?.get?.('content-length'))>maxBytes)throw unavailable();
  const clone=response.clone();reader=clone.body?.getReader();if(!reader)throw unavailable();
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(unavailable()),timeoutMs);});
  let total=0;const chunks=[];
  for(;;){
   const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;
   total+=value.byteLength;if(total>maxBytes)throw unavailable();chunks.push(Buffer.from(value));
  }
  const body=JSON.parse(Buffer.concat(chunks,total).toString('utf8')),organisation=body?.Organisations?.[0];
  if(!Array.isArray(body?.Organisations)||body.Organisations.length!==1||!organisation||typeof organisation!=='object'||Array.isArray(organisation)||typeof organisation.IsDemoCompany!=='boolean'||typeof organisation.BaseCurrency!=='string'||!currencies.has(organisation.BaseCurrency))throw unavailable();
  return Object.freeze({isDemoCompany:organisation.IsDemoCompany,currency:organisation.BaseCurrency});
 }catch{
  // A Response clone is a tee. Awaiting its cancellation can deadlock while the
  // original body is waiting for this observer to return to the real preflight.
  try{void reader?.cancel().catch(()=>{});}catch{}
  return null;
 }finally{clearTimeout(timer);try{reader?.releaseLock();}catch{}}
}

/** Existing authorised READER host only. Reuses its exact preflight and normal
 * credential rotation/lease/health persistence. Never copies credentials into the
 * writer or selects an accounting job/evidence/retry. Business-data requests remain GET.
 */
export function createStagingXeroReaderOrganisationCheck({env=process.env,query,fetchImpl=fetch,observationTimeoutMs=10000}={}){
 if(typeof query!=='function'||typeof fetchImpl!=='function'||!Number.isInteger(observationTimeoutMs)||observationTimeoutMs<1||observationTimeoutMs>30000)throw unavailable();
 return async()=>{
  let fact=null,organisationReads=0;
  const observingFetch=async(url,options={})=>{
   const response=await fetchImpl(url,{...options,redirect:'error'});
   if(String(url)===organisationUrl){
    organisationReads++;
    if(options.method==='GET'&&organisationReads===1)fact=await organisationFact(response,observationTimeoutMs);
   }
   return response;
  };
  let result;
  try{result=await createStagingXeroConnectionPreflight({env,query,fetchImpl:observingFetch,diagnose:()=>{}})();}catch{throw unavailable();}
  if(result?.event!=='xero_connection_preflight'||!['connected','failed'].includes(result.state)||!['token','connection','organisation'].includes(result.phase)||!reasons.has(result.reason))throw unavailable();
  const verified=result.state==='connected'&&result.phase==='organisation'&&result.reason==='ok'&&organisationReads===1&&fact!==null;
  return Object.freeze({event:'xero_reader_organisation_check',organisationVerified:verified,isDemoCompany:verified?fact.isDemoCompany:null,currency:verified?fact.currency:null,readOnlySourceCheck:true,readerCredentialRotationMayWrite:true,accountingCollectionAttempted:false,
   readerPreflight:Object.freeze({state:result.state,phase:result.phase,reason:result.reason})});
 };
}
