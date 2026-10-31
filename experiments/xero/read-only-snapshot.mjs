const base='https://api.xero.com/api.xro/2.0';
const paths=Object.freeze(['Organisation','Reports/ProfitAndLoss','Reports/BalanceSheet','Reports/TrialBalance','Reports/BankSummary']);
const phases=Object.freeze({Organisation:'organisation', 'Reports/ProfitAndLoss':'profit_and_loss','Reports/BalanceSheet':'balance_sheet','Reports/TrialBalance':'trial_balance','Reports/BankSummary':'bank_summary'});
const reasons=Object.freeze({401:'unauthorized',403:'forbidden',429:'rate_limited'});
function unavailable(safePhase,safeReason){
 const error=Error('Xero snapshot unavailable');
 Object.defineProperties(error,{safePhase:{value:safePhase,enumerable:true},safeReason:{value:safeReason,enumerable:true}});
 return error;
}
function responseReason(status){return reasons[status]??(status>=500?'upstream_unavailable':'upstream_refused');}
export function readXeroSnapshotDate(value,{today=new Date().toISOString().slice(0,10)}={}){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||typeof today!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(today))throw Error('Xero snapshot date is invalid');
 const parsed=new Date(`${value}T00:00:00.000Z`);
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value||value>today)throw Error('Xero snapshot date is invalid');
 return value;
}
export async function readFixedXeroSnapshot({accessToken,tenantId,date,fetchImpl=fetch}){
 if(typeof accessToken!=='string'||accessToken.length<16||typeof tenantId!=='string'||!tenantId)throw Error('Xero snapshot request is invalid');
 try{readXeroSnapshotDate(date);}catch{throw Error('Xero snapshot request is invalid');}
 const headers={authorization:`Bearer ${accessToken}`,'xero-tenant-id':tenantId,accept:'application/json'};
 const rows=[];for(const path of paths){const safePhase=phases[path];const url=new URL(`${base}/${path}`);if(path!=='Organisation')url.searchParams.set(path==='Reports/BankSummary'?'toDate':'date',date);let response;try{response=await fetchImpl(url,{method:'GET',headers,redirect:'error'});}catch{throw unavailable(safePhase,'network_failure');}if(!response.ok)throw unavailable(safePhase,responseReason(response.status));let body;try{body=await response.json();}catch{throw unavailable(safePhase,'malformed_response');}rows.push([path,body]);}
 return Object.freeze({date,tenantId,organisation:rows[0][1],profitAndLoss:rows[1][1],balanceSheet:rows[2][1],trialBalance:rows[3][1],bankSummary:rows[4][1]});
}
