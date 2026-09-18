// Disposable preparation only. No credentials, network, grants or live runner.
import {historicalReportingFixture,HISTORICAL_REPORTING_STORE as STORE} from '../shopify/historical-reporting-fixture.mjs';
import {sql,U} from '../shopify/finance-fixture.mjs';
import {historicalManifest,PERIODS} from './historical-testing-fixture.mjs';
import {readProfitEvidence,profitEvidenceDigest} from './profit-evidence-reader.mjs';
import {createProfitSalesReader} from './profit-sales-reader.mjs';
const id=n=>`97000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const HISTORICAL_PROFIT_IDS=Object.freeze({store:STORE,versions:Object.freeze(Object.fromEntries(PERIODS.map(([m],i)=>[m,id(5000+i)]))),lineIds:Object.freeze(Object.fromEntries(historicalManifest().lines.map((l,i)=>[l.id,id(1+i)])))});
const evidence='INVENTED disposable historical fixture only; no live completeness attestation';
export async function setupHistoricalProfitEvidence(db,{userId,orderIds,failAt=null}={}){
 if(!userId||!(orderIds instanceof Map))throw Error('Explicit synthetic identity and imported order map required');
 const manifest=historicalManifest(),ids=HISTORICAL_PROFIT_IDS,readSales=createProfitSalesReader({userId});
 return db.transaction(async tx=>{
  const existing=await tx.query('SELECT id FROM finance_v1.profit_evidence_versions WHERE store_id=$1',[STORE]);
  const lines=await tx.query('SELECT id FROM public.order_line_items WHERE store_id=$1',[STORE]);
  if(existing.rows.length||lines.rows.length)throw Error('Historical profit fixture replay refused; inspect exact state');
  const stores=await tx.query('SELECT shopify_domain FROM public.stores WHERE id=$1',[STORE]);
  if(stores.rows[0]?.shopify_domain!=='historical-pipeline.invalid')throw Error('Exact disposable synthetic store required');
  const sourceOrders=(await tx.query('SELECT id FROM public.orders WHERE store_id=$1',[STORE])).rows;
  if(orderIds.size!==132||sourceOrders.length!==132||new Set(orderIds.values()).size!==132||manifest.orders.some(o=>!sourceOrders.some(s=>s.id===orderIds.get(o.id))))throw Error('Exact imported historical order manifest required');
  for(const [i,l]of manifest.lines.entries()){
   const o=manifest.orders[i];
   // Import path currently stores order-level financial evidence only. These
   // explicitly invented line source records are a separate prepared supplement.
   await tx.query(`INSERT INTO public.order_line_items(id,store_id,order_id,shopify_line_item_id,quantity,price,discount,total) SELECT $1,$2,id,$4,$5::integer,gross_sales/($5::integer),discounts,gross_sales-discounts FROM public.orders WHERE id=$3`,[ids.lineIds[l.id],STORE,orderIds.get(o.id),`invented-historical-line-${i+1}`,l.quantity]);
  }
  const expenses=[];let nextExpense=2000;
  for(const e of manifest.expenses){
   const parts=e.category==='overheads'?[['overhead',e.amountPence-e.daPence],['depreciation_amortisation',e.daPence]]:[[e.category==='advertising'?'advertising':'variable',e.amountPence]];
   for(const [classification,amount]of parts){
    const eid=id(nextExpense++),categoryId=id(nextExpense+10000);
    await tx.query('INSERT INTO public.overhead_categories(id,store_id,name) VALUES($1,$2,$3)',[categoryId,STORE,`Invented ${e.id} ${classification}`]);
    await tx.query(`INSERT INTO public.overhead_entries(id,store_id,category_id,period_start,period_end,amount,currency_code,entry_type,is_recurring,source,external_ref) VALUES($1,$2,$3,$4,$5,$6,'GBP','actual',false,'manual',$7)`,[eid,STORE,categoryId,e.from,e.to,(amount/100).toFixed(2),`invented-historical:${e.id}:${classification}`]);
    expenses.push({id:eid,classification,from:e.from,to:e.to});
   }
  }
  if(failAt==='after-sources')throw Error('Injected historical profit failure after sources');
  for(const [month,,day]of PERIODS){
   if(day===17)continue; // Schema and agreed actual-profit contract require complete months.
   const scope={storeId:STORE,currency:'GBP',from:`${month}-01`,to:`${month}-${day}`},versionId=ids.versions[month];
   const sales=await readSales(tx,scope),returns=manifest.recoveries.filter(r=>r.recoveryOn>=scope.from&&r.recoveryOn<=scope.to);
   const selected=manifest.lines.filter(l=>(l.soldOn>=scope.from&&l.soldOn<=scope.to)||returns.some(r=>r.lineId===l.id));
   const plans=[];
   for(const l of selected){
    plans.push((await tx.query(`SELECT $1::uuid version_id,$2::uuid store_id,l.id line_id,l.order_id,$4::date sale_date,'GBP'::text currency,to_jsonb(l) observed_line,l.quantity,$5::bigint historic_unit_cost_pence,$6::text evidence_ref,to_jsonb(l) current_line FROM public.order_line_items l WHERE id=$3`,[versionId,STORE,ids.lineIds[l.id],l.soldOn,l.unitCostPence,evidence])).rows[0]);
   }
   const selectedExpenses=[];
   for(const e of expenses.filter(e=>e.from===scope.from&&e.to===scope.to))selectedExpenses.push({...e,kind:'overhead_entry',snapshot:(await tx.query(`SELECT jsonb_build_object('entry',to_jsonb(o),'category',to_jsonb(c)) snapshot FROM public.overhead_entries o JOIN public.overhead_categories c ON c.id=o.category_id WHERE o.id=$1`,[e.id])).rows[0].snapshot});
   const sealed={version:1,salesRevision:sales.revision,lineIds:plans.map(l=>l.line_id),returnIds:returns.map(r=>r.id),expenseSources:selectedExpenses.map(e=>`${e.kind}:${e.id}`),lineProofs:Object.fromEntries(plans.map(l=>[l.line_id,{historicalLandedCostSupported:true,documentRef:evidence,observedEvidenceRevision:profitEvidenceDigest(l)}])),expenseProofs:Object.fromEntries(selectedExpenses.map(e=>[`${e.kind}:${e.id}`,{basis:'actual',taxTreatment:'accounting_amount_supported',currency:'GBP',documentRef:evidence,observedSourceRevision:profitEvidenceDigest(e.snapshot)}]))};
   await tx.query(`INSERT INTO finance_v1.profit_evidence_versions(id,store_id,date_from,date_to,currency,source_manifest,evidence_ref,verified_by) VALUES($1,$2,$3,$4,'GBP',$5,$6,'disposable fixture')`,[versionId,STORE,scope.from,scope.to,JSON.stringify(sealed),evidence]);
   for(const l of plans)await tx.query(`INSERT INTO finance_v1.line_cost_evidence VALUES($1,$2,$3,$4,$5,'GBP',$6,$7,$8,$9)`,[versionId,STORE,l.line_id,l.order_id,l.sale_date,JSON.stringify(l.observed_line),l.quantity,l.historic_unit_cost_pence,evidence]);
   for(const r of returns)await tx.query('INSERT INTO finance_v1.stock_return_evidence VALUES($1,$2,$3,$4,$5,$6,$7)',[versionId,STORE,r.id,ids.lineIds[r.lineId],r.recoveryOn,r.quantity,evidence]);
   for(const e of selectedExpenses)await tx.query(`INSERT INTO finance_v1.expense_evidence VALUES($1,$2,$3,$4,$5,'GBP',$6,$7,$8)`,[versionId,STORE,e.kind,e.id,e.classification,JSON.stringify(e.snapshot),evidence,`invented-historical:${e.id}`]);
   await tx.query('INSERT INTO finance_v1.profit_component_coverage VALUES($1,true,true,true,true,true,true,$2,$3)',[versionId,JSON.stringify(sealed),evidence]);
  }
  if(failAt==='before-commit')throw Error('Injected historical profit failure before commit');
  return {storeId:STORE,versionIds:ids.versions};
 });
}
export async function historicalProfitFixture({prepareProfit=true}={}){
 const fixture=await historicalReportingFixture();
 try{
  await fixture.importEvidence();for(const key of Object.keys(fixture.scopes))await fixture.review(key);
  await fixture.db.exec(sql('proposals/20260913_profit_evidence.sql'));
  const orderIds=await fixture.orderIds(),options={userId:U,orderIds};
  if(prepareProfit)await setupHistoricalProfitEvidence(fixture.db,options);
  const readProfit=key=>{
   if(!fixture.scopes[key])throw Error('Unknown exact historical scope');
   return readProfitEvidence(fixture.db,{versionId:HISTORICAL_PROFIT_IDS.versions[key]??id(5999),scope:fixture.scopes[key],readSales:createProfitSalesReader({userId:U})});
  };
  return {...fixture,storeId:STORE,userId:U,versionIds:HISTORICAL_PROFIT_IDS.versions,readProfit,profitOptions:options};
 }catch(error){await fixture.db.close();throw error;}
}
