const base='https://api.xero.com/api.xro/2.0';
const paths=Object.freeze(['Organisation','Reports/ProfitAndLoss','Reports/BalanceSheet','Reports/TrialBalance','Reports/BankSummary']);
export async function readFixedXeroSnapshot({accessToken,tenantId,date,fetchImpl=fetch}){
 if(typeof accessToken!=='string'||accessToken.length<16||typeof tenantId!=='string'||!tenantId||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Xero snapshot request is invalid');
 const headers={authorization:`Bearer ${accessToken}`,'xero-tenant-id':tenantId,accept:'application/json'};
 const rows=[];for(const path of paths){const url=new URL(`${base}/${path}`);if(path!=='Organisation')url.searchParams.set(path==='Reports/BankSummary'?'toDate':'date',date);const response=await fetchImpl(url,{method:'GET',headers,redirect:'error'});if(!response.ok)throw Error('Xero snapshot unavailable');rows.push([path,await response.json()]);}
 return Object.freeze({date,tenantId,organisation:rows[0][1],profitAndLoss:rows[1][1],balanceSheet:rows[2][1],trialBalance:rows[3][1],bankSummary:rows[4][1]});
}
