const endpoint='https://api.xero.com/api.xro/2.0/Accounts';

const identifier=value=>typeof value==='string'&&value.trim()!==''&&value.length<=256;
const text=value=>typeof value==='string'&&value.trim()!==''&&value.length<=256?value.trim():null;
const unavailable=(reason='invalid_request')=>{const error=Error('Xero account discovery unavailable');error.safeReason=reason;throw error;};

/**
 * Retains only the stable account directory needed for an owner-reviewed mapping.
 * It deliberately does not read account balances, transactions, tax settings, or
 * any optional fields returned by Xero.
 */
export function parseXeroAccountDirectory(payload){
 if(!payload||typeof payload!=='object'||!Array.isArray(payload.Accounts))unavailable('malformed_response');
 const seen=new Set();
 const accounts=payload.Accounts.map(row=>{
  if(!row||typeof row!=='object')unavailable('malformed_response');
  const id=text(row.AccountID),name=text(row.Name),type=text(row.Type),status=text(row.Status)??'Unavailable';
  if(!id||!name||!type||seen.has(id))unavailable('malformed_response');
  seen.add(id);
  return Object.freeze({id,name,type,status});
 });
 return Object.freeze(accounts);
}

/** Reads the pinned tenant's Xero chart of accounts through the sole GET endpoint. */
export async function discoverXeroAccounts({accessToken,tenantId,pinnedTenantId,fetchImpl=fetch}={}){
 if(!identifier(accessToken)||accessToken.length<16||!identifier(tenantId)||!identifier(pinnedTenantId)||tenantId!==pinnedTenantId||typeof fetchImpl!=='function')unavailable('invalid_request');
 let response;
 try{response=await fetchImpl(endpoint,{method:'GET',headers:{authorization:`Bearer ${accessToken}`,'xero-tenant-id':tenantId,accept:'application/json'},redirect:'error'});}catch{unavailable('network_failure');}
 if(!response?.ok)unavailable('upstream_refused');
 let payload;
 try{payload=await response.json();}catch{unavailable('malformed_response');}
 return parseXeroAccountDirectory(payload);
}
