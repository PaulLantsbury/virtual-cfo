// Standalone writer-only OAuth token primitive. Never imports the read worker.
// Encryption is the existing purpose-separated AES-256-GCM envelope wire format.
export {decryptStagingEnvelope,encryptStagingEnvelope} from './writer-envelope-crypto.mjs';
const failure=(reason,status)=>Object.assign(Error('Xero staging worker unavailable'),{safeReason:reason,...(status===undefined?{}:{safeStatus:status})});
const classify=status=>status===401?'unauthorized':status===403?'forbidden':status===429?'rate_limited':status>=500&&status<=599?'upstream_unavailable':'provider_unavailable';
async function boundedJson(response,maxBytes){
 if(!response?.body||typeof response.body.getReader!=='function')return response.json();
 const declared=Number(response.headers?.get?.('content-length'));if(Number.isFinite(declared)&&declared>maxBytes)throw failure('malformed_response');
 const reader=response.body.getReader(),chunks=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(value){total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw failure('malformed_response');}chunks.push(Buffer.from(value));}}return JSON.parse(Buffer.concat(chunks,total).toString('utf8'));}
 catch(error){if(error?.safeReason)throw error;throw failure('malformed_response');}
}
/** Same pure token contract as the existing refresh primitive; caller retains the
 * 10-second request fence, encrypted durable rotation-before-use and stop policy.
 */
export async function refreshXeroCredential({refreshToken,clientId,clientSecret,fetchImpl}){
 try{
  const response=await fetchImpl('https://identity.xero.com/connect/token',{method:'POST',redirect:'error',headers:{authorization:`Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:refreshToken.toString('utf8')}).toString()});
  if(!response.ok)throw failure(response.status===400?'invalid_grant':classify(response.status),response.status);
  const token=await boundedJson(response,32768);
  if(typeof token?.access_token!=='string'||token.access_token.length<16||typeof token?.refresh_token!=='string'||token.refresh_token.length<16||token?.scope!==undefined&&(typeof token.scope!=='string'||token.scope.length>4096))throw failure('refresh_failed');
  return {accessToken:token.access_token,refreshToken:token.refresh_token,scope:token.scope??''};
 }catch(error){if(['invalid_grant','unauthorized','forbidden','rate_limited','upstream_unavailable','provider_unavailable','malformed_response','refresh_failed'].includes(error?.safeReason))throw error;throw failure('provider_unavailable');}
}
