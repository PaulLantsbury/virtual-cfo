/** PREPARATION ONLY. Explicit disposable/exact staging fixture; never autoruns.
 * Caller supplies a pre-existing synthetic reviewer user ID and real mapped
 * sales reader. New Store D membership is an explicit prepared mutation, not a
 * grant performed by this module's import. Separate staging approval required.
 */
import {profitEvidenceDigest} from './profit-evidence-reader.mjs';
const id=n=>`94000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const PROFIT_STAGING_IDS=Object.freeze({store:'90000000-0000-4000-8000-000000000004',orders:[id(1),id(2)],lines:[id(3),id(4)],refund:id(5),categories:[id(6),id(7),id(8)],expenses:[id(9),id(10),id(11)],marketing:id(12),versions:[id(20),id(21),id(22)]});
export const PROFIT_STAGING_EXPECTED=Object.freeze({
 '2026-02':{netProductSales:14000,netShipping:500,originalOrders:2,cogs:6000,grossProfit:8000,variableCosts:1500,advertising:1000,overheads:2500,da:500,operatingProfit:3500,ebitda:4000},
 '2026-03':{netProductSales:-7000,netShipping:-500,originalOrders:0,cogs:0,grossProfit:-7000,variableCosts:0,advertising:0,overheads:0,da:0,operatingProfit:-7500,ebitda:-7500},
 '2026-04':{netProductSales:0,netShipping:0,originalOrders:0,cogs:-4000,grossProfit:4000,variableCosts:0,advertising:0,overheads:0,da:0,operatingProfit:4000,ebitda:4000},
});
export async function setupProfitStagingFixture(db,{userId,readSales,failAt=null}){
 if(typeof readSales!=='function'||!userId)throw new Error('Explicit authorised synthetic reader required');
 const ids=PROFIT_STAGING_IDS;
 return db.transaction(async tx=>{
  const existing=await tx.query('SELECT id FROM public.stores WHERE id=$1 OR shopify_domain=$2',[ids.store,'night-scout-profit-fixture-d.invalid']);
  if(existing.rows.length)throw new Error('Store D already exists: fixture replay refused; inspect exact state');
  if(!(await tx.query('SELECT id FROM auth.users WHERE id=$1',[userId])).rows.length)throw new Error('Synthetic fixture user must already exist');
  await tx.query(`INSERT INTO public.stores(id,shopify_domain,shopify_store_id,name,currency_code,timezone) VALUES($1,'night-scout-profit-fixture-d.invalid','synthetic-profit-d','Staging Synthetic Profit Store D','GBP','Europe/London')`,[ids.store]);
  await tx.query('INSERT INTO public.store_memberships(user_id,store_id) VALUES($1,$2)',[userId,ids.store]);
  for(let i=0;i<2;i++){
   await tx.query(`INSERT INTO public.orders(id,store_id,shopify_order_id,order_date,currency,gross_sales,discounts,shipping,tax,refunds,financial_status) VALUES($1,$2,$3,'2026-02-15T12:00:00Z','GBP',$4,$5,$6,$7,$8,'paid')`,[ids.orders[i],ids.store,`synthetic-profit-d-order-${i+1}`,i===0?100:50,i===0?10:0,i===0?5:0,i===0?19:10,i===0?90:0]);
   await tx.query(`INSERT INTO public.order_line_items(id,store_id,order_id,shopify_line_item_id,quantity,price,discount,total) VALUES($1,$2,$3,$4,1,$5,$6,$7)`,[ids.lines[i],ids.store,ids.orders[i],`synthetic-profit-line-${i+1}`,i===0?100:50,i===0?10:0,i===0?90:50]);
  }
  await tx.query(`INSERT INTO public.refunds(id,store_id,order_id,shopify_refund_id,refund_date,amount,reason) VALUES($1,$2,$3,'synthetic-profit-d-refund','2026-03-05T12:00:00Z',90,'SYNTHETIC acceptance: product84 inclVAT14; shipping6 inclVAT1')`,[ids.refund,ids.store,ids.orders[0]]);
  for(let i=0;i<2;i++)await tx.query(`INSERT INTO finance_v1.order_evidence(store_id,order_id,observed_raw,event_date,currency,original_eligible,tax_basis,gross_product_vat,discount_vat,shipping_vat,evidence_ref,verified_by) SELECT store_id,id,current_snapshot,'2026-02-15','GBP',true,'exclusive',$2,$3,$4,'SYNTHETIC explicit original paid sale, actual recorded VAT','synthetic fixture' FROM finance_v1.order_mapping WHERE id=$1`,[ids.orders[i],i===0?20:10,i===0?2:0,i===0?1:0]);
  await tx.query(`INSERT INTO finance_v1.refund_evidence(store_id,refund_id,order_id,observed_raw,event_date,currency,product_cash,product_vat,shipping_cash,shipping_vat,evidence_ref,verified_by) SELECT store_id,id,order_id,current_snapshot,'2026-03-05','GBP',84,14,6,1,'SYNTHETIC actual refund split','synthetic fixture' FROM finance_v1.refund_mapping WHERE id=$1`,[ids.refund]);
  const periods=[['2026-02-01','2026-02-28'],['2026-03-01','2026-03-31'],['2026-04-01','2026-04-30']];
  for(const [from,to]of periods)await tx.query(`INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by) VALUES($1,$2,$3,'GBP',true,'SYNTHETIC explicitly complete fixture, never real-store certification','synthetic fixture')`,[ids.store,from,to]);
  for(let i=0;i<3;i++){
   await tx.query('INSERT INTO public.overhead_categories(id,store_id,name) VALUES($1,$2,$3)',[ids.categories[i],ids.store,['Synthetic variable expenses','Synthetic overhead excluding D&A','Synthetic D&A'][i]]);
   await tx.query(`INSERT INTO public.overhead_entries(id,store_id,category_id,period_start,period_end,amount,currency_code,entry_type,is_recurring,source,external_ref) VALUES($1,$2,$3,'2026-02-01','2026-02-28',$4,'GBP','actual',false,'manual',$5)`,[ids.expenses[i],ids.store,ids.categories[i],[15,20,5][i],`synthetic-profit-expense-${i+1}`]);
  }
  await tx.query(`INSERT INTO public.marketing_channel_daily_metrics(id,store_id,channel,metric_date,spend,data_source) VALUES($1,$2,'other','2026-02-15',10,'manual')`,[ids.marketing,ids.store]);
  if(failAt==='after-sources')throw new Error('Injected fixture failure after sources');
  for(let month=0;month<3;month++){
   const [from,to]=periods[month],versionId=ids.versions[month],scope={storeId:ids.store,currency:'GBP',from,to};
   const sales=await readSales(tx,scope);
   const selectedLines=month===0?ids.lines:month===2?[ids.lines[0]]:[];
   const plans=[];
   for(const lineId of selectedLines){
    const idx=ids.lines.indexOf(lineId);
    const row=(await tx.query(`SELECT $1::uuid version_id,$2::uuid store_id,l.id line_id,l.order_id,'2026-02-15'::date sale_date,'GBP'::text currency,to_jsonb(l) observed_line,l.quantity,$4::bigint historic_unit_cost_pence,'SYNTHETIC historical landed cost, existing supported allocation'::text evidence_ref,to_jsonb(l) current_line FROM public.order_line_items l WHERE id=$3`,[versionId,ids.store,lineId,idx===0?4000:2000])).rows[0];plans.push(row);
   }
   const expenses=[];
   if(month===0){
    for(let i=0;i<3;i++){
     const row=(await tx.query(`SELECT jsonb_build_object('entry',to_jsonb(o),'category',to_jsonb(c)) snapshot FROM public.overhead_entries o JOIN public.overhead_categories c ON c.id=o.category_id WHERE o.id=$1`,[ids.expenses[i]])).rows[0];
     expenses.push({kind:'overhead_entry',id:ids.expenses[i],classification:['variable','overhead','depreciation_amortisation'][i],snapshot:row.snapshot});
    }
    expenses.push({kind:'marketing_daily',id:ids.marketing,classification:'advertising',snapshot:(await tx.query('SELECT to_jsonb(m) snapshot FROM public.marketing_channel_daily_metrics m WHERE id=$1',[ids.marketing])).rows[0].snapshot});
   }
   const manifest={version:1,salesRevision:sales.revision,lineIds:selectedLines,returnIds:month===2?['synthetic-d-saleable-return-april']:[],expenseSources:expenses.map(e=>`${e.kind}:${e.id}`),lineProofs:Object.fromEntries(plans.map(l=>[l.line_id,{historicalLandedCostSupported:true,documentRef:'SYNTHETIC landed-cost evidence; no estimated allocation',observedEvidenceRevision:profitEvidenceDigest(l)}])),expenseProofs:Object.fromEntries(expenses.map(e=>[`${e.kind}:${e.id}`,{basis:'actual',taxTreatment:'accounting_amount_supported',currency:'GBP',documentRef:'SYNTHETIC tax-exclusive accounting amount, full fixture source coverage',observedSourceRevision:profitEvidenceDigest(e.snapshot)}]))};
   await tx.query(`INSERT INTO finance_v1.profit_evidence_versions(id,store_id,date_from,date_to,currency,source_manifest,evidence_ref,verified_by) VALUES($1,$2,$3,$4,'GBP',$5,'SYNTHETIC exact fixture manifest','synthetic fixture')`,[versionId,ids.store,from,to,JSON.stringify(manifest)]);
   for(const l of plans)await tx.query(`INSERT INTO finance_v1.line_cost_evidence(version_id,store_id,line_id,order_id,sale_date,currency,observed_line,quantity,historic_unit_cost_pence,evidence_ref) VALUES($1,$2,$3,$4,'2026-02-15','GBP',$5,$6,$7,$8)`,[versionId,ids.store,l.line_id,l.order_id,JSON.stringify(l.observed_line),l.quantity,l.historic_unit_cost_pence,l.evidence_ref]);
   if(month===2)await tx.query(`INSERT INTO finance_v1.stock_return_evidence VALUES($1,$2,'synthetic-d-saleable-return-april',$3,'2026-04-05',1,'SYNTHETIC independent saleable warehouse event, known complete history')`,[versionId,ids.store,ids.lines[0]]);
   for(const e of expenses)await tx.query(`INSERT INTO finance_v1.expense_evidence VALUES($1,$2,$3,$4,$5,'GBP',$6,'SYNTHETIC actual expense evidence',$7)`,[versionId,ids.store,e.kind,e.id,e.classification,JSON.stringify(e.snapshot),`synthetic-canonical:${e.kind}:${e.id}`]);
   await tx.query(`INSERT INTO finance_v1.profit_component_coverage VALUES($1,true,true,true,true,true,true,$2,'SYNTHETIC complete fixture-only component manifests')`,[versionId,JSON.stringify(manifest)]);
  }
  if(failAt==='before-commit')throw new Error('Injected fixture failure before commit');
  return {storeId:ids.store,versionIds:ids.versions,expected:PROFIT_STAGING_EXPECTED};
 });
}
