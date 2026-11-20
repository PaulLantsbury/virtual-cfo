/** Proposed member-authorised supplemental snapshot reader. No schema, grants or writes. */
import {reviewerAuthenticator} from '../shopify/reviewer-auth.mjs';
import {validProfitScope} from '../financial-v1/profit-reporting-service.mjs';
import {profitEvidenceDigest} from '../financial-v1/profit-evidence-reader.mjs';
import {readHistoryInTransaction} from './history-reader.mjs';
import {validHistorySelection} from './history-versions.mjs';
import {HISTORY_EDITION,historySourceAsOf} from './history-context.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
const CONTRACT='reviewed-supplement-v1';
const MAX_BYTES=1024*1024;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v,keys)=>object(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const utc=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v.replace('.000Z','Z');
const revision=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
/** Same canonical digest as history evidence, after strict JSON/precision/size checks.
 * Safe integer pence/counts only. Ratios are derived by the presentation layer. */
export function supplementalDigest(body){
 const seen=new Set();let nodes=0;
 function visit(value,depth){
  if(++nodes>100000||depth>32)throw Error('Invalid supplemental JSON');
  if(value===null||typeof value==='boolean')return;
  if(typeof value==='string'){if(Buffer.byteLength(value)>MAX_BYTES)throw Error('Invalid supplemental JSON');return;}
  if(typeof value==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))throw Error('Invalid supplemental numeric precision');return;}
  if(typeof value!=='object'||seen.has(value))throw Error('Invalid supplemental JSON');
  seen.add(value);
  if(Array.isArray(value)){
   if(Object.getPrototypeOf(value)!==Array.prototype)throw Error('Invalid supplemental array prototype');
   if(Object.keys(value).length!==value.length||Reflect.ownKeys(value).length!==value.length+1||Object.keys(value).some((k,i)=>k!==String(i)))throw Error('Invalid supplemental JSON');
   for(let i=0;i<value.length;i++){const descriptor=Object.getOwnPropertyDescriptor(value,String(i));if(!descriptor||!('value'in descriptor))throw Error('Invalid supplemental JSON');visit(descriptor.value,depth+1);}
  }else{
   if(!object(value))throw Error('Invalid supplemental JSON');
   for(const key of Object.keys(value)){
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(['__proto__','prototype','constructor'].includes(key)||!descriptor||!('value'in descriptor))throw Error('Invalid supplemental JSON');
    visit(descriptor.value,depth+1);
   }
   if(Reflect.ownKeys(value).length!==Object.keys(value).length)throw Error('Invalid supplemental JSON');
  }
  seen.delete(value);
 }
 visit(body,0);
 if(Buffer.byteLength(JSON.stringify(body))>MAX_BYTES)throw Error('Supplemental JSON exceeds size bound');
 return profitEvidenceDigest(body);
}
const unavailable=()=>({state:'unavailable',contract:CONTRACT,reason:'Reviewed supplemental evidence is unavailable for this selection'});
function financialMatches(financial,scope,selection){
 return financial?.state==='supported'&&financial.contract==='history-v2-proposal'&&financial.versionId===selection.versionId
  &&financial.metadata?.edition===HISTORY_EDITION&&financial.metadata?.sourceBasis==='synthetic-local'
  &&financial.metadata?.verification==='canonical-source-revision-only'
  &&exact(financial.scope,'storeId,currency,from,to')&&Object.entries(scope).every(([k,v])=>financial.scope[k]===v)
  &&revision(financial.salesRevision)&&revision(financial.costRevision);
}
function rowMatches(row,scope,selection,kind,financial,now){
 const b=row?.body;
 if(!row||!uuid(row.snapshot_id)||row.invalidated!==false||row.store_id!==scope.storeId||row.scope_from!==scope.from||row.scope_to!==scope.to
  ||row.kind!==kind||row.financial_version!==selection.versionId||row.sales_revision!==financial.salesRevision||row.cost_revision!==financial.costRevision
  ||!revision(row.body_hash)||supplementalDigest(b)!==row.body_hash)return false;
 if(!exact(b,'contract,kind,scope,financialVersionId,salesRevision,costRevision,sourceBasis,observedAt,payload')||b.contract!==CONTRACT||b.kind!==kind
  ||!exact(b.scope,'storeId,currency,timezone,from,to')||b.scope.timezone!=='Europe/London'||Object.entries(scope).some(([k,v])=>b.scope[k]!==v)
  ||b.financialVersionId!==selection.versionId||b.salesRevision!==financial.salesRevision||b.costRevision!==financial.costRevision||b.sourceBasis!=='synthetic-local'||!object(b.payload)||!utc(b.observedAt))return false;
 const indexed=row.observed_at instanceof Date?row.observed_at.toISOString():row.observed_at;
 if(typeof indexed!=='string'||!Number.isFinite(Date.parse(indexed))||Date.parse(indexed)!==Date.parse(b.observedAt)
  ||!Number.isFinite(+now)||Date.parse(b.observedAt)>+now||Date.parse(b.observedAt)<Date.parse(historySourceAsOf(scope.to)))return false;
 return true;
}
/** The fixed mature cohort depends on every April–September financial month,
 * not merely the selected page month. Immutable supplemental storage alone does
 * not protect it from a later cost correction in one of those source months. */
async function validateMatureFinancialDependencies(tx,payload,kind,scope,selection,current,clock,readHistory){
 if(kind!=='acquisition'||payload.economics===undefined)return true;
 const economics=payload.economics;
 if(!object(economics)||!Array.isArray(economics.dependencies))return false;
 if(economics.mature===null)return economics.dependencies.length===0;
 if(!object(economics.mature)||scope.storeId!==identity.storeId||scope.currency!=='GBP'||economics.dependencies.length!==6||scope.to<'2026-09-30')return false;
 // Validate the entire bounded list before doing additional canonical reads.
 for(let i=0;i<6;i++){
  const dependency=economics.dependencies[i],month=String(i+4).padStart(2,'0'),from=`2026-${month}-01`,to=new Date(Date.UTC(2026,i+4,0)).toISOString().slice(0,10);
  if(!exact(dependency,'from,to,versionId,salesRevision,costRevision')||dependency.from!==from||dependency.to!==to||!uuid(dependency.versionId)||!revision(dependency.salesRevision)||!revision(dependency.costRevision))return false;
 }
 for(const dependency of economics.dependencies){
  const boundScope={storeId:identity.storeId,currency:'GBP',from:dependency.from,to:dependency.to};
  const boundSelection={edition:HISTORY_EDITION,versionId:dependency.versionId};
  const reuse=scope.from===dependency.from&&scope.to===dependency.to&&selection.versionId===dependency.versionId;
  const report=reuse?current:await readHistory(tx,boundScope,{now:()=>clock,selection:boundSelection});
  if(!financialMatches(report,boundScope,boundSelection)||report.salesRevision!==dependency.salesRevision||report.costRevision!==dependency.costRevision
   ||report.profit?.state!=='complete'||!['cogs','variableCosts','advertising','overheadIncludingDA','depreciationAmortisation'].every(key=>Number.isSafeInteger(report.components?.[key])))return false;
 }
 return true;
}
/** Trusted server-owned dependencies only. Validators inspect complete payloads and
 * return strict boolean true; absent/asynchronous validators never authorise data.
 * readHistory override exists for isolated tests; runtime defaults to canonical read
 * in the SAME member-scoped repeatable-read transaction as the supplemental row. */
export function createSupplementalService(db,supabase,{now=()=>new Date(),validators={},readHistory=readHistoryInTransaction}={}){
 return {async read(scope,authorization,selection,kind){
  if(!validProfitScope(scope)||scope.currency!=='GBP'||!validHistorySelection(selection)||!['cash','acquisition'].includes(kind))throw Error('Exact supplemental month, version and kind required');
  const user=await reviewerAuthenticator(supabase,authorization)();
  return db.transaction(async tx=>{
   await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
   await tx.query("SELECT set_config('night_scout.profit_user_id',$1,true)",[user.id]);
   const members=await tx.query('SELECT store_id FROM public.store_memberships WHERE store_id=$1 AND user_id=$2',[scope.storeId,user.id]);
   if(members.rows.length!==1)throw Error('Supplemental store membership required');
   try{
    const clock=now();
    if(!Number.isFinite(+clock)||typeof validators[kind]!=='function')return unavailable();
    const financial=await readHistory(tx,scope,{now:()=>clock,selection});
    if(!financialMatches(financial,scope,selection))return unavailable();
    const {rows}=await tx.query(`SELECT snapshot_id,store_id,date_from::text scope_from,date_to::text scope_to,kind,financial_version,sales_revision,cost_revision,body,body_hash,observed_at,invalidated FROM finance_review_supplement_v1.snapshots WHERE store_id=$1 AND date_from=$2::date AND date_to=$3::date AND kind=$4 AND financial_version=$5 LIMIT 2`,[scope.storeId,scope.from,scope.to,kind,selection.versionId]);
    if(rows.length!==1||!rowMatches(rows[0],scope,selection,kind,financial,clock))return unavailable();
    // Validator cannot mutate the read snapshot or change the returned payload.
    const payload=structuredClone(rows[0].body.payload),financialCopy=structuredClone(financial);
    if(!await validateMatureFinancialDependencies(tx,payload,kind,scope,selection,financial,clock,readHistory))return unavailable();
    const validation=validators[kind](structuredClone(payload),financialCopy);
    if(validation!==true){if(validation instanceof Promise)void validation.catch(()=>{});return unavailable();}
    return {state:'supported',...structuredClone(rows[0].body),snapshotId:rows[0].snapshot_id};
   }catch{
    // No row bodies, provider/account details, SQL text or low-level errors escape.
    return unavailable();
   }
  });
 }};
}
