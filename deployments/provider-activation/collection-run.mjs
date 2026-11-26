import {validateHostEnvironment} from './host-boundary.mjs';
import {runGoogleAdsAcceptance} from '../../experiments/marketing/google-ads-acceptance.mjs';
const fail=()=>{throw Error('Provider collection unavailable');};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
export function validateCollectionBinding(b,source,env,now=new Date()){
 if(!b||!['meta','google'].includes(b.provider)||b.targetId!=='bioalckltvkhlczusdvl'||!/^([a-f0-9]{40})$/.test(b.sourceSha??'')||b.sourceSha!==source||!/^.{1,200}$/.test(b.approvalRef??'')||b.retryOrdinal!==0||!uuid.test(b.storeId??'')||!uuid.test(b.connectionId??'')||!/^[A-Z]{3}$/.test(b.currency??'')||typeof b.timeZone!=='string'||b.timeZone.length>128||!day(b.from)||!day(b.to)||b.from>b.to||(Date.parse(b.to)-Date.parse(b.from))/86400000>13)fail();
 const id=b.provider==='google'?b.customerId:b.accountId;if(!(b.provider==='google'?/^\d{10}$/:/^\d{5,32}$/).test(id??''))fail();
 if(b.provider==='google'&&b.loginCustomerId!==null&&!/^\d{10}$/.test(b.loginCustomerId??''))fail();
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:b.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));const today=`${p.year}-${p.month}-${p.day}`;
 if(b.to>=today)fail();
 if(b.provider==='meta'){const d=new Date(today),n=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-37);d.setUTCDate(Math.min(n,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));if(b.from<d.toISOString().slice(0,10))fail();}
 validateHostEnvironment(`${b.provider}-collector`,env);
 const prefix=`NIGHT_SCOUT_${b.provider.toUpperCase()}_ADS_`;
 if(env.NIGHT_SCOUT_RUNTIME_ENV!=='staging')fail();
 const exact={STAGING_PROJECT_REF:b.targetId,STAGING_STORE_ID:b.storeId,ACCEPTANCE_STORE_ID:b.storeId,ACCEPTANCE_FROM:b.from,ACCEPTANCE_TO:b.to,ACCEPTANCE_RETRY_ORDINAL:'0',COLLECTOR_RUNTIME_ENABLED:'true',COLLECTOR_ENABLED:'true',ACCEPTANCE_ENABLED:'true'};
 for(const [k,v]of Object.entries(exact))if(env[prefix+k]!==v)fail();
 return b;
}
export function assertSelected(b,a){
 for(const k of ['storeId','connectionId','currency','timeZone',b.provider==='google'?'customerId':'accountId',...(b.provider==='google'?['loginCustomerId']:[])])if(a?.[k]!==b[k])fail();
}
// Recheck the actual selected-account RPC used inside collect, before credential refresh/provider reads.
export function guardPool(pool,b){return {end:()=>pool.end(),async query(sql,args){const result=await pool.query(sql,args);if(typeof sql==='string'&&sql.includes('.worker_get_selected_account(')){if(result.rows?.length!==1)fail();const r=result.rows[0];assertSelected(b,{storeId:r.store_id,connectionId:r.connection_id,accountId:r.provider_account_id,customerId:r.customer_id,loginCustomerId:r.login_customer_id??null,currency:r.currency,timeZone:r.timezone_name});}return result;}};}
export async function runBoundCollection({binding:b,env,sourceSha,createRuntime,claim,writeReceipt,now=()=>new Date()}){
 validateCollectionBinding(b,sourceSha,env,now());await claim(); // Exclusive durable marker precedes runtime construction.
 let runtime,receiptAttempted=false,closeAttempted=false;
 try{
  runtime=await createRuntime(env,b);if(!runtime)fail();
  const select=async()=>{const all=await runtime.listActiveAccounts();if(!Array.isArray(all)||all.length>5000)fail();const a=all.filter(x=>x.storeId===b.storeId);if(a.length!==1)fail();assertSelected(b,a[0]);return a;};
  let called=false;
  const collect=async input=>{if(called)fail();called=true;await select();const idKey=b.provider==='google'?'customerId':'accountId';for(const k of ['storeId','connectionId',idKey,'from','to'])if(input[k]!==b[k])fail();if(input.idempotencyKey!==`${b.provider}_accept:${b[idKey]}:${b.from}:${b.to}:r0`)fail();return runtime.collector.collect(input);};
  let result;
  if(b.provider==='google')result=await runGoogleAdsAcceptance({env,now,createRuntime:async()=>({listActiveAccounts:select,collector:{collect},close:async()=>{}})});
  else {const [a]=await select();const r=await collect({storeId:b.storeId,connectionId:a.connectionId,accountId:a.accountId,from:b.from,to:b.to,idempotencyKey:`meta_accept:${a.accountId}:${b.from}:${b.to}:r0`});if(!r||!['complete','partial','already_collected','already_running'].includes(r.status)||r.from!==b.from||r.to!==b.to||!uuid.test(r.runId??''))fail();result={state:r.status,runId:r.runId,from:r.from,to:r.to};if(['complete','partial'].includes(r.status)){if(!Array.isArray(r.coverage)||r.coverage.length!==(Date.parse(b.to)-Date.parse(b.from))/86400000+1)fail();result.coverage={provider_row:0,no_row:0};for(const [i,d] of r.coverage.entries()){const expected=new Date(Date.parse(b.from)+i*86400000).toISOString().slice(0,10);if(d?.date!==expected||!Object.hasOwn(result.coverage,d?.state)||(d.state==='provider_row'?!/^(0|[1-9][0-9]*)$/.test(d.spendMinor??''):d.spendMinor!==null))fail();result.coverage[d.state]++;}if((r.status==='complete')!==(result.coverage.no_row===0)||!Number.isFinite(Date.parse(r.observedAt)))fail();}}
  closeAttempted=true;await runtime.close();runtime=undefined;receiptAttempted=true;await writeReceipt({state:'finished',approvalRef:b.approvalRef,sourceSha,binding:b,result});return {state:result.state,coverage:result.coverage??null};
 }catch{let cleanupVerified=!runtime;if(runtime&&!closeAttempted){closeAttempted=true;try{await runtime.close();cleanupVerified=true;}catch{}}if(!receiptAttempted){receiptAttempted=true;try{await writeReceipt({state:'uncertain',cleanupVerified,approvalRef:b.approvalRef,sourceSha});}catch{}}throw Error('Provider collection unavailable');}
}

export function collectorDatabaseUrl(provider,c,connection='direct'){const role=`night_scout_${provider}_ads_collector_login`;if(!['direct','session-pooler'].includes(connection)||!['meta','google'].includes(provider)||c?.version!==1||c.provider!==provider||c.capability!=='collector'||c.username!==role||typeof c.password!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(c.password))fail();const url=new URL(connection==='direct'?'postgresql://db.bioalckltvkhlczusdvl.supabase.co:5432/postgres':'postgresql://aws-1-eu-west-1.pooler.supabase.com:5432/postgres');url.username=connection==='direct'?role:`${role}.bioalckltvkhlczusdvl`;url.password=c.password;return url.href;}
