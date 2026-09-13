/** Disposable authorised-server reader, not a public RPC or enabled runtime.
 * readSales(tx,scope) MUST validate existing sales evidence inside the supplied
 * transaction and return {value, eligibleOrders:[{id,soldOn}], revision} including
 * ALL eligible historical orders through scope.to (not just this month's).
 * Caller authorises store/version. Cached/client-provided sales are unsupported.
 */
import {createHash} from 'node:crypto';
import {calculateProfitEvidence,PROFIT_EVIDENCE_VERSION} from './profit-evidence.mjs';
import {pence} from './source-adapter.mjs';
const ensure=(ok,message)=>{if(!ok)throw new Error(message);};
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const revision=value=>createHash('sha256').update(canonical(value)).digest('hex');
const same=(a,b)=>canonical(a)===canonical(b);
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v).slice(0,10);
function exact(actual,expected,label){ensure(Array.isArray(expected)&&new Set(expected).size===expected.length&&same([...actual].sort(),[...expected].sort()),`${label} manifest mismatch`);}
export async function readProfitEvidence(db,{versionId,scope,readSales}) {
 ensure(typeof readSales==='function','Transactional verified-sales reader required');
 return db.transaction(async tx=>{
  await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  const sales=await readSales(tx,scope);
  ensure(sales&&typeof sales.revision==='string'&&sales.revision.trim()&&Array.isArray(sales.eligibleOrders),'Verified sales manifest required');
  const snapshotId=revision({versionId,salesRevision:sales.revision,scope});
  const input={version:PROFIT_EVIDENCE_VERSION,snapshotId,scope,sales:{snapshotId,value:sales.value},costEvidence:null};
  try {
   const {rows:[v]}=await tx.query('SELECT * FROM finance_v1.profit_evidence_versions WHERE id=$1',[versionId]);
   ensure(v&&v.store_id===scope.storeId&&v.currency===scope.currency&&day(v.date_from)===scope.from&&day(v.date_to)===scope.to,'Version scope mismatch');
   const {rows:[sealed]}=await tx.query('SELECT * FROM finance_v1.profit_component_coverage WHERE version_id=$1',[versionId]);
   ensure(sealed,'Version is not sealed');
   const manifest=v.source_manifest;
   ensure(manifest.version===1&&manifest.salesRevision===sales.revision&&same(manifest,sealed.source_manifest),'Version source manifest stale');
   const {rows:lines}=await tx.query(`SELECT e.*,to_jsonb(l) current_line FROM finance_v1.line_cost_evidence e JOIN public.order_line_items l ON l.id=e.line_id WHERE e.version_id=$1`,[versionId]);
   const {rows:returns}=await tx.query('SELECT * FROM finance_v1.stock_return_evidence WHERE version_id=$1',[versionId]);
   const {rows:expenses}=await tx.query('SELECT * FROM finance_v1.expense_evidence WHERE version_id=$1',[versionId]);
   const orderMap=new Map(sales.eligibleOrders.map(o=>[o.id,o]));
   ensure(orderMap.size===sales.eligibleOrders.length,'Duplicate eligible order manifest');
   const {rows:sourceLines}=await tx.query('SELECT id,order_id,store_id FROM public.order_line_items WHERE store_id=$1',[scope.storeId]);
   const problems={};
   const problem=(key,error)=>{problems[key]=error.message;};
   try {
    const returnLineIds=new Set(returns.map(r=>r.line_id));
    exact(lines.map(l=>l.line_id),sourceLines.filter(l=>{const o=orderMap.get(l.order_id);return o&&(o.soldOn>=scope.from||returnLineIds.has(l.id));}).map(l=>l.id),'Eligible source lines');
    exact(lines.map(l=>l.line_id),manifest.lineIds,'Line evidence');
   }catch(error){problem('productCosts',error);}
   try{exact(returns.map(r=>r.source_return_id),manifest.returnIds,'Return evidence');}catch(error){problem('recoveries',error);}
   try {
    exact(expenses.map(e=>`${e.source_kind}:${e.source_id}`),manifest.expenseSources,'Expense evidence');
    const {rows:actualOverheads}=await tx.query(`SELECT id FROM public.overhead_entries WHERE store_id=$1 AND entry_type='actual' AND period_start<=$3::date AND period_end>=$2::date`,[scope.storeId,scope.from,scope.to]);
    const {rows:actualMarketing}=await tx.query(`SELECT id FROM public.marketing_channel_daily_metrics WHERE store_id=$1 AND metric_date BETWEEN $2::date AND $3::date`,[scope.storeId,scope.from,scope.to]);
    exact([...actualOverheads.map(o=>`overhead_entry:${o.id}`),...actualMarketing.map(m=>`marketing_daily:${m.id}`)],manifest.expenseSources,'Current expense sources');
   }catch(error){for(const key of ['variableCosts','advertising','overheads','da'])problem(key,error);}
   const common=(row,current)=>({storeId:scope.storeId,currency:scope.currency,basis:'actual',evidenceRef:row.evidence_ref,sourceRevision:revision(current),observedRevision:revision(current)});
   let mappedLines=[];
   try { mappedLines=lines.map(l=>{
    const original=orderMap.get(l.order_id),proof=manifest.lineProofs?.[l.line_id];
    ensure(original&&original.soldOn===day(l.sale_date)&&l.store_id===scope.storeId&&l.currency===scope.currency&&same(l.observed_line,l.current_line),'Stale line or original sale evidence');
    ensure(proof?.historicalLandedCostSupported===true&&typeof proof.documentRef==='string'&&proof.documentRef.trim()&&proof.observedEvidenceRevision===revision(l),'Historical landed-cost proof unavailable');
    const unit=Number(l.historic_unit_cost_pence);ensure(Number.isSafeInteger(unit),'Cost precision unsupported');
    return {...common(l,l.current_line),id:l.line_id,orderId:l.order_id,soldOn:original.soldOn,quantity:l.quantity,unitCostPence:unit,originalEligible:true,landedCostSupported:true};
   });
   }catch(error){problem('productCosts',error);}
   const mappedReturns=returns.map(r=>({...common(r,r),id:r.source_return_id,lineId:r.line_id,recoveryOn:day(r.saleable_date),quantity:r.quantity,status:'saleable'}));
   const mappedExpenses=[];
   for(const e of expenses){
    try {
    let current,amount;
    if(e.source_kind==='overhead_entry'){
     const {rows:[row]}=await tx.query(`SELECT o.amount::text amount_text,jsonb_build_object('entry',to_jsonb(o),'category',to_jsonb(c)) snapshot FROM public.overhead_entries o JOIN public.overhead_categories c ON c.id=o.category_id WHERE o.id=$1`,[e.source_id]);
     current=row?.snapshot;const o=current?.entry,c=current?.category;
     ensure(o&&c&&o.store_id===scope.storeId&&c.store_id===scope.storeId&&o.currency_code===scope.currency&&o.entry_type==='actual'&&o.period_start===scope.from&&o.period_end===scope.to,'Expense scope/period unsupported');amount=row.amount_text;
    }else{
     const {rows:[row]}=await tx.query('SELECT m.spend::text amount_text,to_jsonb(m) snapshot FROM public.marketing_channel_daily_metrics m WHERE id=$1',[e.source_id]);current=row?.snapshot;
     ensure(current&&current.store_id===scope.storeId&&current.metric_date>=scope.from&&current.metric_date<=scope.to&&current.data_source!=='estimated'&&e.classification==='advertising','Marketing source unsupported');amount=row.amount_text;
    }
    ensure(e.currency===scope.currency&&same(current,e.observed_source),'Stale expense source');
    const proof=manifest.expenseProofs?.[`${e.source_kind}:${e.source_id}`];
    ensure(proof?.basis==='actual'&&proof?.taxTreatment==='accounting_amount_supported'&&proof.currency===scope.currency&&typeof proof.documentRef==='string'&&proof.documentRef.trim()&&proof.observedSourceRevision===revision(current),'Actual expense/tax evidence required');
    if(e.classification.startsWith('excluded_'))continue;
    const category={variable:'variableCosts',advertising:'advertising',overhead:'overheads',depreciation_amortisation:'overheads'}[e.classification];
    ensure(category,'Expense classification unsupported');const amountPence=pence(amount);ensure(amountPence>=0,'Credits unsupported');
    mappedExpenses.push({...common(e,current),id:`${e.source_kind}:${e.source_id}`,sourceId:e.canonical_expense_key,category,from:scope.from,to:scope.to,amountPence,daPence:e.classification==='depreciation_amortisation'?amountPence:0});
    }catch(error){
      const key={variable:'variableCosts',advertising:'advertising',overhead:'overheads',depreciation_amortisation:'overheads'}[e.classification];
      for(const affected of key?[key,...(key==='overheads'?['da']:[])]:['variableCosts','advertising','overheads','da'])problem(affected,error);
    }
   }
   const costRevision=revision({v,sealed,lines,returns,expenses});
   const evidence={snapshotId,revision:costRevision,lines:mappedLines,recoveries:mappedReturns,expenses:mappedExpenses,coverage:{}};
   const flags={productCosts:'historic_cost_complete',recoveries:'stock_return_complete',variableCosts:'variable_expense_complete',advertising:'advertising_complete',overheads:'overhead_complete',da:'depreciation_complete'};
   for(const [name,flag] of Object.entries(flags)){
    const rows=name==='productCosts'?mappedLines:name==='recoveries'?mappedReturns:mappedExpenses.filter(e=>e.category===(name==='da'?'overheads':name));
    evidence.coverage[name]={...scope,snapshotId,revision:costRevision,complete:sealed[flag]&&!problems[name],evidenceRef:sealed.evidence_ref,sourceIds:rows.map(r=>r.id)};
   }
   input.costEvidence=evidence;
   return {input,result:calculateProfitEvidence(input),readError:Object.keys(problems).length?problems:null};
  }catch(error){return {input,result:calculateProfitEvidence(input),readError:error.message};}
 });
}
export const profitEvidenceDigest=revision;
