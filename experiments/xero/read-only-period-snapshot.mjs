const base='https://api.xero.com/api.xro/2.0';
const requests=Object.freeze([
 ['Organisation',null,'organisation'],
 ['Reports/ProfitAndLoss','period','profit_and_loss'],
 ['Reports/BalanceSheet','point','balance_sheet'],
 ['Reports/TrialBalance','point','trial_balance'],
 ['Reports/BankSummary','period','bank_summary']
]);
const statusReason=status=>status===401?'unauthorized':status===403?'forbidden':status===429?'rate_limited':status>=500?'upstream_unavailable':'upstream_refused';
function fail(phase,reason,diagnose){diagnose(Object.freeze({event:'xero_source_refresh_failed',phase,reason}));throw Error('Xero period snapshot unavailable');}

function date(value){
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false;
 const parsed=new Date(`${value}T00:00:00.000Z`);
 return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;
}

/** Read one bounded accounting period with a caller-owned access token. */
export async function readFixedXeroPeriodSnapshot({accessToken,tenantId,from,to,fetchImpl=fetch,diagnose=()=>{}}){
 if(typeof accessToken!=='string'||accessToken.length<16||typeof tenantId!=='string'||!tenantId||!date(from)||!date(to)||from>to||to>new Date().toISOString().slice(0,10)||typeof diagnose!=='function')throw Error('Xero period snapshot request is invalid');
 const headers={authorization:`Bearer ${accessToken}`,'xero-tenant-id':tenantId,accept:'application/json'};
 const rows=[];
 for(const [path,kind,phase] of requests){
  const url=new URL(`${base}/${path}`);
  if(kind==='period'){url.searchParams.set('fromDate',from);url.searchParams.set('toDate',to);}
  if(kind==='point')url.searchParams.set('date',to);
  let response;try{response=await fetchImpl(url,{method:'GET',headers,redirect:'error'});}catch{fail(phase,'network_failure',diagnose);}
  if(!response.ok)fail(phase,statusReason(response.status),diagnose);
  let body;try{body=await response.json();}catch{fail(phase,'malformed_response',diagnose);}
  rows.push([path,body]);
 }
 return Object.freeze({date:to,from,to,tenantId,organisation:rows[0][1],profitAndLoss:rows[1][1],balanceSheet:rows[2][1],trialBalance:rows[3][1],bankSummary:rows[4][1]});
}
