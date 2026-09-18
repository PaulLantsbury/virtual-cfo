const base='https://api.xero.com/api.xro/2.0';
const paths=Object.freeze(['Organisation','Reports/ProfitAndLoss','Reports/BalanceSheet','Reports/TrialBalance','Reports/BankSummary']);
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
 const rows=[];for(const path of paths){const url=new URL(`${base}/${path}`);if(path!=='Organisation')url.searchParams.set(path==='Reports/BankSummary'?'toDate':'date',date);const response=await fetchImpl(url,{method:'GET',headers,redirect:'error'});if(!response.ok)throw Error('Xero snapshot unavailable');rows.push([path,await response.json()]);}
 return Object.freeze({date,tenantId,organisation:rows[0][1],profitAndLoss:rows[1][1],balanceSheet:rows[2][1],trialBalance:rows[3][1],bankSummary:rows[4][1]});
}
