/** Temporary source-controlled read-only diagnostic. No new connection, writes,
 * role grants, environment flags or request-selected revision/operator. */
import {reviewerAuthenticator} from '../shopify/reviewer-auth.mjs';
import {inspectCustomerRuntimeTransaction} from './customer-runtime-attestation.mjs';
export const CUSTOMER_ATTESTATION_POLICY=Object.freeze({enabled:false,opensAt:'2026-11-21T16:00:00Z',expiresAt:'2026-11-21T18:00:00Z',removeAfter:'2026-11-21T18:00:00Z',maxProcessMs:300000});
const validScope=(s,today)=>s&&Object.getPrototypeOf(s)===Object.prototype&&Object.keys(s).sort().join(',')==='from,storeId,to'&&typeof s.storeId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s.storeId)&&typeof s.from==='string'&&/^\d{4}-\d{2}-01$/.test(s.from)&&Number.isFinite(Date.parse(s.from+'T12:00:00Z'))&&new Date(s.from+'T12:00:00Z').toISOString().slice(0,10)===s.from&&s.to===new Date(Date.UTC(+s.from.slice(0,4),+s.from.slice(5,7),0)).toISOString().slice(0,10)&&s.to<today;
const londonDate=clock=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(clock);return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');};
const unavailable=()=>Error('Runtime attestation unavailable');
export function createCustomerRuntimeAttestationService(database,supabase,{trustedRevision,runtimeProjectRef,policy=CUSTOMER_ATTESTATION_POLICY,now=()=>new Date()}={}){
 const config=Object.freeze({...policy}),createdAt=+now();let used=false;
 const windowValid=()=>{const time=+now();return config.enabled===true&&Number.isFinite(time)&&Number.isFinite(createdAt)&&time>=createdAt&&time-createdAt<CUSTOMER_ATTESTATION_POLICY.maxProcessMs&&config.maxProcessMs===CUSTOMER_ATTESTATION_POLICY.maxProcessMs&&time>=Date.parse(config.opensAt)&&time<Date.parse(config.expiresAt)&&config.opensAt===CUSTOMER_ATTESTATION_POLICY.opensAt&&config.expiresAt===CUSTOMER_ATTESTATION_POLICY.expiresAt;};
 const allowed=()=>windowValid()&&!used;
 return Object.freeze({async inspect(scope,authorization){
  if(!allowed()||!validScope(scope,londonDate(now()))||typeof trustedRevision!=='string'||!(/^[a-f0-9]{40}$/.test(trustedRevision)))throw unavailable();
  scope=structuredClone(scope);
  const reviewer=await reviewerAuthenticator(supabase,authorization)();
  if(!allowed())throw unavailable();
  try{const result=await database.transaction(async tx=>{
   await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
   await tx.exec("SET LOCAL statement_timeout='2000ms'");
   await tx.exec("SET LOCAL idle_in_transaction_session_timeout='3000ms'");
   const result=await tx.query('SELECT 1 FROM ingest_v1.review_authorizations a JOIN public.store_memberships m ON m.store_id=a.store_id AND m.user_id=a.reviewer_id WHERE a.store_id=$1 AND a.reviewer_id=$2 LIMIT 2',[scope.storeId,reviewer.id]);
   if(result.rows.length!==1)throw Error('Reviewer is not authorised for this store');
   if(!allowed())throw unavailable();used=true;
   // Reuse the already authorised transaction, never a second post-auth connection.
   const observed=await inspectCustomerRuntimeTransaction(tx,{trustedRevision});if(!windowValid())throw unavailable();return Object.freeze({...observed,targetProjectAttested:runtimeProjectRef==='bioalckltvkhlczusdvl'});
  });if(!windowValid())throw unavailable();return result;}catch(error){if(error?.message==='Reviewer is not authorised for this store')throw error;throw unavailable();}
 }});
}
