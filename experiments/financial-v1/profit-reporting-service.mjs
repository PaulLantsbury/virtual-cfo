import {reviewerAuthenticator} from '../shopify/reviewer-auth.mjs';
import {readProfitEvidence} from './profit-evidence-reader.mjs';
import {createProfitSalesReader} from './profit-sales-reader.mjs';
const snapshotMode='SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validProfitScope(scope){
 if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).sort().join(',')!=='currency,from,storeId,to')return false;
 const {storeId,from,to,currency}=scope;
 if(typeof storeId!=='string'||!uuid.test(storeId)||typeof from!=='string'||typeof to!=='string'||!/^\d{4}-\d{2}-01$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from.slice(0,7)!==to.slice(0,7))return false;
 const [y,m]=from.split('-').map(Number),days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 if(y<1||m<1||m>12||Number(to.slice(8))!==days[m-1])return false;
 try {if(typeof currency!=='string'||!Intl.supportedValuesOf('currency').includes(currency))return false;const f=new Intl.NumberFormat('en-GB',{style:'currency',currency}).resolvedOptions();return f.minimumFractionDigits===2&&f.maximumFractionDigits===2;}catch{return false;}
}
/** Server dependencies only. Token verified per request; membership, version
 * selection and source validation share one repeatable-read transaction.
 * No raw evidence, SQL errors or account metadata are returned to the browser.
 */
export function createProfitReportingService(db,supabase){
 return {async read(scope,authorization){
  if(!validProfitScope(scope))throw new Error('Invalid profit reporting scope');
  const user=await reviewerAuthenticator(supabase,authorization)();
  return db.transaction(async tx=>{
   await tx.exec(snapshotMode);
   await tx.query("SELECT set_config('night_scout.profit_user_id',$1,true)",[user.id]);
   const {rows:members}=await tx.query('SELECT store_id FROM public.store_memberships WHERE user_id=$1 AND store_id=$2',[user.id,scope.storeId]);
   if(members.length!==1)throw new Error('Profit store membership required');
   const {rows:versions}=await tx.query(`SELECT v.id FROM finance_v1.profit_evidence_versions v JOIN finance_v1.profit_component_coverage c ON c.version_id=v.id WHERE v.store_id=$1 AND v.date_from=$2::date AND v.date_to=$3::date AND v.currency=$4 ORDER BY v.id LIMIT 2`,[scope.storeId,scope.from,scope.to,scope.currency]);
   if(versions.length!==1)return {state:'unavailable',reason:versions.length?'Several profit evidence versions need an explicit selection':'No sealed profit evidence is available for this month'};
   // The reader normally owns its transaction. Here the outer service already
   // established that identical mode BEFORE membership/version queries. Reuse
   // it; never open a second transaction or reset isolation after a read.
   const bound={query:(...args)=>tx.query(...args),exec:sql=>sql===snapshotMode?Promise.resolve():tx.exec(sql)};
   const {result}=await readProfitEvidence({transaction:fn=>fn(bound)},{versionId:versions[0].id,scope,readSales:createProfitSalesReader({userId:user.id})});
   // Reader diagnostics can contain internal database errors. Metric states
   // survive, while diagnostic text and sales evidence references stay private.
   const report={...result,reason:result.reason?'Some profit evidence is unavailable':null};
   if(report.sales){const {provenance,...sales}=report.sales;report.sales={...sales,provenance:{storeId:scope.storeId,from:scope.from,to:scope.to,currency:scope.currency}};}
   for(const [key,value] of Object.entries(report))if(value&&typeof value==='object'&&value.state==='unavailable')report[key]={...value,reason:value.reason==='Non-positive margin denominator policy unresolved'?'Margin unavailable when net sales plus shipping is zero or negative':'Supporting evidence is missing or needs checking'};
   return {state:'ready',versionId:versions[0].id,report};
  });
 }};
}
