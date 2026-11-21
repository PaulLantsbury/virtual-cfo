/** OFFLINE PREPARATION: not an HTTP route or installed service. Server-owned db/Auth
 * must refer to the same project; dependencies cannot come from request fields.
 * Real token verification is delegated to the existing Auth verifier; injected
 * readHistory is a trusted server/test port, not proof of hosted authentication.
 * Reads only activity: no enriched financial, cost/cohort or raw identity payload. */
import {reviewerAuthenticator} from '../shopify/reviewer-auth.mjs';
import {validProfitScope} from '../financial-v1/profit-reporting-service.mjs';
import {validHistorySelection} from './history-versions.mjs';
import {readHistoryInTransaction} from './history-reader.mjs';
import {HISTORY_EDITION,historySourceAsOf} from './history-context.mjs';
import {supplementalDigest} from './supplemental-reader.mjs';
import {validateAcquisitionPayload} from './supplemental-validators.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
const CONTRACT='reviewed-customer-activity-v1';
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.split(',').length&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const equal=(a,b)=>supplementalDigest(a)===supplementalDigest(b);
const stamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v.replace('.000Z','Z');
const instant=v=>v instanceof Date?v.toISOString():v;
const unavailable=()=>({contract:CONTRACT,state:'unavailable',reason:'Reviewed customer activity is unavailable for this selection'});
function financialMatches(f,scope,selection){
 return f?.state==='supported'&&f.contract==='history-v2-proposal'&&f.versionId===selection.versionId&&exact(f.scope,'storeId,currency,from,to')&&equal(f.scope,scope)
 &&f.metadata?.edition===HISTORY_EDITION&&f.metadata?.sourceBasis==='synthetic-local'&&f.metadata?.verification==='canonical-source-revision-only'&&sha(f.salesRevision)&&sha(f.costRevision);
}
function validBase(row,scope,selection,financial,clock){
 const b=row?.body;
 if(!row||!uuid(row.snapshot_id)||row.store_id!==scope.storeId||row.scope_from!==scope.from||row.scope_to!==scope.to||row.kind!=='acquisition'||row.invalidated!==false||row.financial_version!==selection.versionId||row.sales_revision!==financial.salesRevision||row.cost_revision!==financial.costRevision||!sha(row.body_hash)||supplementalDigest(b)!==row.body_hash)return false;
 if(!exact(b,'contract,kind,scope,financialVersionId,salesRevision,costRevision,sourceBasis,observedAt,payload')||b.contract!=='reviewed-supplement-v1'||b.kind!=='acquisition'||b.sourceBasis!=='synthetic-local'||!equal(b.scope,{...scope,timezone:'Europe/London'})||b.financialVersionId!==selection.versionId||b.salesRevision!==financial.salesRevision||b.costRevision!==financial.costRevision||!stamp(b.observedAt)||Date.parse(b.observedAt)>+clock||Date.parse(b.observedAt)<Date.parse(historySourceAsOf(scope.to))||Date.parse(instant(row.observed_at))!==Date.parse(b.observedAt))return false;
 // Structural and exact selected-month source guards. No mature economics are
 // released or certified here; those require their own six-month reader checks.
 return validateAcquisitionPayload(structuredClone(b.payload),structuredClone(financial))===true;
}
function activityMatches(a,base){
 if(!exact(a,'contract,policy,scope,identifiedCustomers,uniqueReturningCustomers,identifiedOrders,sourceHash,basis')||a.contract!=='synthetic-customer-activity-v1'||a.policy!=='synthetic-identity-and-spend-v1'||a.policy!==base.payload.policy||!equal(a.scope,{from:base.scope.from,to:base.scope.to})||a.sourceHash!==base.payload.source.ordersHash||!sha(a.sourceHash)||typeof a.basis!=='string'||!a.basis.startsWith('Distinct synthetic customer identifiers')||a.basis.length>500)return false;
 const c=base.payload.coverage;
 const count=n=>Number.isSafeInteger(n)&&n>=0;
 if(![a.identifiedCustomers,a.uniqueReturningCustomers,a.identifiedOrders,c.identifiedFirstOrders,c.identifiedRepeatOrders].every(count))return false;
 const first=BigInt(c.identifiedFirstOrders),repeat=BigInt(c.identifiedRepeatOrders),customers=BigInt(a.identifiedCustomers),returners=BigInt(a.uniqueReturningCustomers),orders=BigInt(a.identifiedOrders);
 return orders===first+repeat&&customers>=first&&customers<=first+returners&&customers<=orders&&returners<=customers&&returners<=repeat&&(returners===0n)===(repeat===0n)&&(customers===0n)===(orders===0n);
}
/** Request is only an exact scope+selection, never an identity, source row or verifier. */
export function createCustomerSidecarService(db,supabase,{now=()=>new Date(),readHistory=readHistoryInTransaction}={}){
 return {async read(scope,authorization,request){
  try{supplementalDigest(scope);supplementalDigest(request);}catch{throw Error('Exact customer activity selection required');}
  if(!validProfitScope(scope)||scope.storeId!==identity.storeId||scope.currency!=='GBP'||!exact(request,'financialSelection,baseSnapshotId,sidecarVersionId')||!validHistorySelection(request.financialSelection)||!uuid(request.baseSnapshotId)||!sha(request.sidecarVersionId))throw Error('Exact customer activity selection required');
  // Freeze the validated request values before the first async authentication step.
  scope=structuredClone(scope);request=structuredClone(request);
  const user=await reviewerAuthenticator(supabase,authorization)();
  const denied=new Error('Customer activity membership required');
  try{return await db.transaction(async tx=>{
   await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
   await tx.query("SELECT set_config('night_scout.profit_user_id',$1,true)",[user.id]);
   const member=await tx.query('SELECT store_id FROM public.store_memberships WHERE store_id=$1 AND user_id=$2',[scope.storeId,user.id]);
   if(member.rows.length!==1||member.rows[0].store_id!==scope.storeId)throw denied;
   try{
    const clock=now();if(!(clock instanceof Date)||!Number.isFinite(+clock))return unavailable();
    const financial=await readHistory(tx,scope,{now:()=>clock,selection:request.financialSelection});
    if(!financialMatches(financial,scope,request.financialSelection))return unavailable();
    const {rows:bases}=await tx.query('SELECT snapshot_id,store_id,date_from::text scope_from,date_to::text scope_to,kind,financial_version,sales_revision,cost_revision,body,body_hash,observed_at,invalidated FROM finance_review_supplement_v1.snapshots WHERE snapshot_id=$1 AND store_id=$2 AND date_from=$3::date AND date_to=$4::date AND financial_version=$5 AND kind=$6 LIMIT 2',[request.baseSnapshotId,scope.storeId,scope.from,scope.to,request.financialSelection.versionId,'acquisition']);
    if(bases.length!==1||!validBase(bases[0],scope,request.financialSelection,financial,clock))return unavailable();
    const base=bases[0];
    const {rows}=await tx.query('SELECT v.*,v.date_from::text scope_from,v.date_to::text scope_to,s.selected_by,s.selected_at,s.base_snapshot_id selected_base_snapshot_id,s.version_id selected_version_id FROM finance_customer_sidecar_v1.selections s JOIN finance_customer_sidecar_v1.versions v ON v.version_id=s.version_id WHERE s.base_snapshot_id=$1 AND s.version_id=$2 LIMIT 2',[request.baseSnapshotId,request.sidecarVersionId]);
    if(rows.length!==1)return unavailable();
    // Withdrawal is explicit and append-only. The archived selected row may still
    // exist; never interpret it as permission to restore or choose another version.
    const withdrawal=await tx.query('SELECT base_snapshot_id,version_id FROM finance_customer_sidecar_v1.withdrawals WHERE base_snapshot_id=$1 LIMIT 2',[request.baseSnapshotId]);
    if(withdrawal.rows.length!==0)return unavailable();
    const r=rows[0],b=r.body,selected=instant(r.selected_at);
    if(r.version_id!==request.sidecarVersionId||r.selected_version_id!==request.sidecarVersionId||r.base_snapshot_id!==base.snapshot_id||r.selected_base_snapshot_id!==base.snapshot_id||r.base_body_hash!==base.body_hash||r.store_id!==scope.storeId||r.financial_version!==financial.versionId||r.scope_from!==scope.from||r.scope_to!==scope.to||r.sales_revision!==financial.salesRevision||r.cost_revision!==financial.costRevision||!uuid(r.selected_by)||!stamp(selected)||Date.parse(selected)>+clock||Date.parse(selected)<Date.parse(base.body.observedAt)||supplementalDigest(b)!==r.version_id)return unavailable();
    if(!exact(b,'contract,baseBodyHash,scope,financialVersionId,salesRevision,costRevision,activity')||b.contract!=='synthetic-customer-summary-sidecar-v1'||b.baseBodyHash!==base.body_hash||!equal(b.scope,base.body.scope)||b.financialVersionId!==financial.versionId||b.salesRevision!==financial.salesRevision||b.costRevision!==financial.costRevision||!activityMatches(b.activity,base.body))return unavailable();
    // Whitelist safe output. No private manifests, selector identity, base payload,
    // economics, individual customer IDs, SQL details or auth diagnostics escape.
    return {contract:CONTRACT,state:'supported',sourceBasis:'synthetic-local',scope:structuredClone(base.body.scope),financialVersionId:financial.versionId,baseSnapshotId:base.snapshot_id,sidecarVersionId:r.version_id,activity:structuredClone(b.activity)};
   }catch{return unavailable();}
  });}catch(error){if(error===denied)throw error;return unavailable();}
 }};
}
