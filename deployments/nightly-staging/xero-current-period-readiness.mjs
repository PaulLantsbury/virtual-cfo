import {readStagingXeroWorkerConfig} from './xero-worker.mjs';

const event='xero_current_period_readiness';
const receipt=(state,reason,scope)=>Object.freeze({event,state,reason,...(scope?{scope}:{}),accountingCollected:false,connectionVerified:false});

/** Eligibility only: no OAuth, lease, credential rotation or accounting writes.
 * A retry authorization cannot be consumed inside this read-only transaction.
 * The host must separately prove connection/mapping/duration before collection.
 */
export async function inspectCurrentXeroPeriod({env=process.env,connect,clock=()=>new Date()}={}){
 if(env.NIGHT_SCOUT_XERO_PERIOD_MODE!=='daily_completed_period')return receipt('unavailable','daily_mode_required');
 let config;
 try{config=readStagingXeroWorkerConfig(env,clock);}catch{return receipt('unavailable','configuration_unavailable');}
 if(typeof connect!=='function')return receipt('unavailable','database_unavailable',config.scope);
 let client,result;
 try{
  client=await connect();
  await client.query('BEGIN READ ONLY');
  const identity=await client.query("SELECT session_user::text AS session_user,current_user::text AS current_user,current_setting('transaction_read_only') AS read_only");
  const row=identity.rows?.[0];
  if(identity.rows?.length!==1||row.session_user!=='night_scout_import_login'||row.current_user!=='night_scout_import_login'||row.read_only!=='on'){
   result=receipt('unavailable','restricted_read_only_identity_required',config.scope);
  }else{
   const selected=await client.query('SELECT count(*)::integer AS eligible_jobs FROM xero_v1.worker_get_single_refresh_job($1,$2,$3,$4)',[config.scope.from,config.scope.to,config.scope.currency,false]);
   result=selected.rows?.length===1&&[1,'1'].includes(selected.rows[0].eligible_jobs)?receipt('eligible','fresh_scope_eligible',config.scope):receipt('unavailable','single_job_required',config.scope);
  }
 }catch(error){result=receipt('unavailable',error?.code==='25006'?'retry_requires_review':'database_probe_unavailable',config.scope);}
 finally{
  if(client){
   try{await client.query('ROLLBACK');}catch{result=receipt('unavailable','rollback_unconfirmed',config.scope);}
   try{client.release();}catch{result=receipt('unavailable','database_release_unconfirmed',config.scope);}
  }
 }
 return result;
}
