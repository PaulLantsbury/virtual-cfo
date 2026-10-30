// Pure source primitives copied from the existing reader contract; no old worker/config imports.
const unavailable=()=>Error('Demo reader source unavailable');
const failure=(reason,status)=>Object.assign(unavailable(),{safeReason:reason,...(status===undefined?{}:{safeStatus:status})});
const requiredScopes=Object.freeze(['accounting.settings.read','accounting.reports.profitandloss.read','accounting.reports.balancesheet.read','accounting.reports.trialbalance.read','accounting.reports.banksummary.read','offline_access']);
const allowedScopes=new Set(['openid','profile','email',...requiredScopes]);
const classifyStatus=status=>status===401?'unauthorized':status===403?'forbidden':status===429?'rate_limited':status>=500&&status<=599?'upstream_unavailable':'provider_unavailable';
async function boundedJson(response,maxBytes){if(!response?.body||typeof response.body.getReader!=='function')return response.json();const declared=Number(response.headers?.get?.('content-length'));if(Number.isFinite(declared)&&declared>maxBytes)throw failure('malformed_response');const reader=response.body.getReader(),chunks=[];let total=0;try{for(;;){const {done,value}=await reader.read();if(done)break;if(value){total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw failure('malformed_response');}chunks.push(Buffer.from(value));}}return JSON.parse(Buffer.concat(chunks,total).toString('utf8'));}catch(error){if(error?.safeReason)throw error;throw failure('malformed_response');}}
export async function refreshXeroCredential({refreshToken,clientId,clientSecret,fetchImpl}){try{const response=await fetchImpl('https://identity.xero.com/connect/token',{method:'POST',redirect:'error',headers:{authorization:`Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:refreshToken.toString('utf8')}).toString()});if(!response.ok)throw failure(response.status===400?'invalid_grant':classifyStatus(response.status),response.status);const token=await boundedJson(response,32_768);if(typeof token?.access_token!=='string'||token.access_token.length<16||typeof token?.refresh_token!=='string'||token.refresh_token.length<16||token?.scope!==undefined&&(typeof token.scope!=='string'||token.scope.length>4096))throw failure('refresh_failed');return {accessToken:token.access_token,refreshToken:token.refresh_token,scope:token.scope??''};}catch(error){if(['invalid_grant','unauthorized','forbidden','rate_limited','upstream_unavailable','provider_unavailable','malformed_response','refresh_failed'].includes(error?.safeReason))throw error;throw failure('provider_unavailable');}}
export function hasRequiredXeroScopes(raw){if(typeof raw!=='string'||raw.length>4096)return false;const scopes=raw.split(' '),granted=new Set(scopes);return scopes.length===granted.size&&scopes.every(scope=>scope.length>0&&allowedScopes.has(scope))&&requiredScopes.every(scope=>granted.has(scope));}
export async function assertPinnedXeroConnection({accessToken,tenantId,fetchImpl}){
 let response;try{response=await fetchImpl('https://api.xero.com/connections',{method:'GET',redirect:'error',headers:{authorization:`Bearer ${accessToken}`,accept:'application/json'}});}catch{throw failure('network_failure');}
 if(!response.ok)throw failure(classifyStatus(response.status),response.status);
 let rows;try{rows=await boundedJson(response,65_536);}catch(error){throw error?.safeReason?error:failure('malformed_response');}
 if(!Array.isArray(rows)||rows.length>100||rows.some(row=>!row||typeof row!=='object'||typeof row.tenantId!=='string'))throw failure('malformed_response');
 if(!rows.some(row=>row.tenantId===tenantId))throw Object.assign(failure('reconnect_required'),{connectionCount:rows.length});
 return Object.freeze({connectionCount:rows.length});
}

export async function assertGbpDemoOrganisation({accessToken,tenantId,fetchImpl}){
 let response;try{response=await fetchImpl('https://api.xero.com/api.xro/2.0/Organisation',{method:'GET',redirect:'error',headers:{authorization:`Bearer ${accessToken}`,'xero-tenant-id':tenantId,accept:'application/json'}});}catch{throw failure('network_failure');}
 if(!response.ok)throw failure(classifyStatus(response.status),response.status);
 const body=await readGbpDemoOrganisationResponse(response);return true;
}
export async function readGbpDemoOrganisationResponse(response){
 if(!response?.ok||response.redirected)throw failure(response?.ok?'malformed_response':classifyStatus(response?.status));
 let body;try{body=await boundedJson(response,262144);}catch(error){throw error?.safeReason?error:failure('malformed_response');}
 if(!Array.isArray(body?.Organisations)||body.Organisations.length!==1||!body.Organisations[0]||typeof body.Organisations[0]!=='object')throw failure('malformed_response');
 if(body.Organisations[0].IsDemoCompany!==true)throw failure('non_demo_organisation');
 if(body.Organisations[0].BaseCurrency!=='GBP')throw failure('unsupported_currency');
 return body;
}
