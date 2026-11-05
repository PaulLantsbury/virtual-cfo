/** In-memory PostgreSQL rehearsal only. No remote driver, connection URL or apply command. */
import {setup,sql,U,A} from '../shopify/finance-fixture.mjs';
import {createProfitSalesReader} from '../financial-v1/profit-sales-reader.mjs';
import {readProfitEvidence,profitEvidenceDigest} from '../financial-v1/profit-evidence-reader.mjs';
import {generate} from './generator.mjs';
import {prepareStagingPayload,RESERVED_SYNTHETIC_IDENTITY as TARGET,hash,stableId} from './staging-payload.mjs';
const handles=new WeakSet();
const evidence='FICTIONAL uk-gifts-v2 local source-model review; no provider completeness claim';
export const STAGING_TABLES=Object.freeze(['public.stores','public.store_memberships','public.orders','public.refunds','public.order_line_items','public.overhead_categories','public.overhead_entries','finance_v1.order_evidence','finance_v1.refund_evidence','finance_v1.coverage_evidence','finance_v1.profit_evidence_versions','finance_v1.line_cost_evidence','finance_v1.stock_return_evidence','finance_v1.expense_evidence','finance_v1.profit_component_coverage']);
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
async function bulk(tx,table,rows,columns) {
 for(let start=0;start<rows.length;start+=250) {
  const selected=rows.slice(start,start+250);
  await tx.query(`INSERT INTO ${table} (${columns.join(',')}) SELECT ${columns.join(',')} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`,[JSON.stringify(selected)]);
 }
}
export async function stagingFingerprints(db,{excludeTarget=false}={}) {
 const result={};
 for(const table of STAGING_TABLES){
  const where=!excludeTarget?'true':table==='public.stores'?'id<>$1':table==='finance_v1.profit_component_coverage'?'version_id IN(SELECT id FROM finance_v1.profit_evidence_versions WHERE store_id<>$1)':'store_id<>$1';
  result[table]=(await db.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) rows FROM ${table} t WHERE ${where}`,excludeTarget?[TARGET.storeId]:[])).rows[0].rows;
 }
 return hash(result);
}
export async function createStagingRehearsal({reviewerId=U}={}) {
 ensure(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reviewerId),'Existing reviewer UUID shape required for disposable binding');
 const {db}=await setup(undefined,{installIntake:false});
 try {
  await db.exec(sql('proposals/20260913_profit_evidence.sql'));
  if(reviewerId!==U){await db.query('INSERT INTO auth.users(id) VALUES($1)',[reviewerId]);await db.query('INSERT INTO public.store_memberships(user_id,store_id) VALUES($1,$2)',[reviewerId,A]);}
  // Fix default authoring timestamps only in this new in-memory database. They are not source-as-of dates.
  for(const table of STAGING_TABLES){const [schema,name]=table.split('.');const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND data_type IN ('timestamp with time zone','timestamp without time zone') AND column_default IS NOT NULL",[schema,name])).rows;for(const c of columns)await db.exec(`ALTER TABLE ${table} ALTER COLUMN ${c.column_name} SET DEFAULT '2026-11-05T12:00:00Z'::timestamptz`);}
  await db.exec('CREATE SCHEMA synthetic_rehearsal; CREATE TABLE synthetic_rehearsal.receipts(store_id uuid PRIMARY KEY,payload_hash text NOT NULL,source_hash text NOT NULL);');
  const handle=Object.freeze({db,reviewerId,environment:'disposable-pglite-only'});handles.add(handle);return handle;
 }catch(error){await db.close();throw error;}
}
export async function inspectStagingPreflight(handle,payload) {
 ensure(handles.has(handle),'Only newly created disposable rehearsal databases accepted');
 const {db}=handle;
 ensure(payload.status==='local-staging-proposal-only'&&JSON.stringify(payload.identity)===JSON.stringify(TARGET),'Exact reserved new company identity required');
 ensure(payload.reviewerId===handle.reviewerId,'Exact reviewer binding required');
 const {payloadHash,...body}=payload;ensure(hash(body)===payloadHash,'Payload checksum mismatch');
 ensure(payload.profile==='uk-gifts-v2','Current immutable v2 profile required');
 const expected=prepareStagingPayload(generate({...payload.sourceLedger,profile:'uk-gifts-v2'}),{reviewerId:payload.reviewerId,...payload.window,identity:TARGET,reviewed:true});
 ensure(expected.payloadHash===payload.payloadHash,'Canonical payload differs from reviewed deterministic source');
 const reviewer=(await db.query('SELECT id FROM auth.users WHERE id=$1',[payload.reviewerId])).rows;
 const memberships=(await db.query('SELECT store_id FROM public.store_memberships WHERE user_id=$1',[payload.reviewerId])).rows;
 ensure(reviewer.length===1&&memberships.length>0,'Existing approved reviewer and prior membership required');
 const receipt=(await db.query('SELECT * FROM synthetic_rehearsal.receipts WHERE store_id=$1',[TARGET.storeId])).rows[0];
 const occupied=(await db.query('SELECT id FROM public.stores WHERE id=$1 OR shopify_domain=$2 OR shopify_store_id=$3',[TARGET.storeId,TARGET.domain,TARGET.externalId])).rows;
 ensure(receipt||occupied.length===0,'Reserved identity already occupied; never reuse an existing store');
 if(receipt) {ensure(receipt.payload_hash===payloadHash,'Existing company has a different immutable payload');ensure(receipt.source_hash===await stagingFingerprints(db),'Existing receipt/source state changed; replay refused');}
 return {status:'local-preflight-only',newCompanyVacant:!occupied.length,replay:Boolean(receipt),reviewerExists:true,existingMembership:true,
  remoteProjectVerified:false,liveSchemaVerified:false,remoteWriteApproved:false,snapshotMetadataVerified:false};
}
async function populate(tx,payload,{failAt}={}) {
 const store=TARGET.storeId;
 await tx.query("INSERT INTO public.stores(id,shopify_domain,shopify_store_id,name,currency_code,timezone) VALUES($1,$2,$3,$4,'GBP','Europe/London')",[store,TARGET.domain,TARGET.externalId,TARGET.name]);
 await tx.query('INSERT INTO public.store_memberships(user_id,store_id) VALUES($1,$2)',[payload.reviewerId,store]);
 const cols=['id','store_id','shopify_order_id','order_date','currency','gross_sales','discounts','net_sales','shipping','tax','total_sales','financial_status'];
 await bulk(tx,'public.orders',payload.orders,cols);
 await bulk(tx,'public.refunds',payload.refunds,['id','store_id','order_id','shopify_refund_id','refund_date','amount']);
 await bulk(tx,'public.order_line_items',payload.lines,['id','store_id','order_id','shopify_line_item_id','quantity','price','discount','total']);
 // Bind immutable evidence to the actual database-generated snapshots, never caller-supplied raw JSON.
 for(const o of payload.orders)await tx.query(`INSERT INTO finance_v1.order_evidence(store_id,order_id,observed_raw,event_date,currency,original_eligible,tax_basis,gross_product_vat,discount_vat,shipping_vat,evidence_ref,verified_by) SELECT store_id,id,current_snapshot,$2,'GBP',true,'exclusive',$3,$4,$5,$6,'local synthetic reviewer' FROM finance_v1.order_mapping WHERE id=$1`,[o.id,o.event_date,o.gross_product_vat,o.discount_vat,o.shipping_vat,evidence]);
 for(const r of payload.refunds)await tx.query(`INSERT INTO finance_v1.refund_evidence(store_id,refund_id,order_id,observed_raw,event_date,currency,product_cash,product_vat,shipping_cash,shipping_vat,evidence_ref,verified_by) SELECT store_id,id,order_id,current_snapshot,$2,'GBP',$3,$4,$5,$6,$7,'local synthetic reviewer' FROM finance_v1.refund_mapping WHERE id=$1`,[r.id,r.event_date,r.product_cash,r.product_vat,r.shipping_cash,r.shipping_vat,evidence]);
 for(const c of payload.coverage)await tx.query(`INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by) VALUES($1,$2,$3,'GBP',true,$4,'local synthetic reviewer')`,[store,c.date_from,c.date_to,evidence]);
 for(const classification of [...new Set(payload.expenses.map(e=>e.classification))])await tx.query('INSERT INTO public.overhead_categories(id,store_id,name) VALUES($1,$2,$3)',[stableId('expense-category',classification),store,`Fictional ${classification}`]);
 for(const e of payload.expenses)await tx.query(`INSERT INTO public.overhead_entries(id,store_id,category_id,period_start,period_end,amount,currency_code,entry_type,is_recurring,source,external_ref) VALUES($1,$2,$3,$4,$5,$6,'GBP','actual',false,'manual',$7)`,[e.id,store,e.categoryId,e.from,e.to,e.amount,`synthetic:${payload.profile}:${e.id}`]);
 if(failAt==='after-sources')throw Error('Injected staging failure after sources');
 const readSales=createProfitSalesReader({userId:payload.reviewerId});
 for(const scope of payload.scopes) {
  const sales=await readSales(tx,{storeId:store,currency:'GBP',from:scope.from,to:scope.to});
  const returns=payload.returns.filter(r=>r.saleable_date>=scope.from&&r.saleable_date<=scope.to);
  const lines=payload.lines.filter(l=>(l.sale_date>=scope.from&&l.sale_date<=scope.to)||returns.some(r=>r.line_id===l.id));
  const costs=[];
  for(const l of lines)costs.push((await tx.query(`SELECT $1::uuid version_id,$2::uuid store_id,l.id line_id,l.order_id,$4::date sale_date,'GBP'::text currency,to_jsonb(l) observed_line,l.quantity,$5::bigint historic_unit_cost_pence,$6::text evidence_ref,to_jsonb(l) current_line FROM public.order_line_items l WHERE id=$3`,[scope.versionId,store,l.id,l.sale_date,l.historic_unit_cost_pence,evidence])).rows[0]);
  const expenses=[];
  for(const e of payload.expenses.filter(e=>e.from===scope.from&&e.to===scope.to))expenses.push({...e,snapshot:(await tx.query(`SELECT jsonb_build_object('entry',to_jsonb(o),'category',to_jsonb(c)) snapshot FROM public.overhead_entries o JOIN public.overhead_categories c ON c.id=o.category_id WHERE o.id=$1`,[e.id])).rows[0].snapshot});
  const manifest={version:1,salesRevision:sales.revision,lineIds:costs.map(l=>l.line_id),returnIds:returns.map(r=>r.source_return_id),expenseSources:expenses.map(e=>`overhead_entry:${e.id}`),lineProofs:Object.fromEntries(costs.map(l=>[l.line_id,{historicalLandedCostSupported:true,documentRef:evidence,observedEvidenceRevision:profitEvidenceDigest(l)}])),expenseProofs:Object.fromEntries(expenses.map(e=>[`overhead_entry:${e.id}`,{basis:'actual',taxTreatment:'accounting_amount_supported',currency:'GBP',documentRef:evidence,observedSourceRevision:profitEvidenceDigest(e.snapshot)}]))};
  await tx.query(`INSERT INTO finance_v1.profit_evidence_versions(id,store_id,date_from,date_to,currency,source_manifest,evidence_ref,verified_by) VALUES($1,$2,$3,$4,'GBP',$5,$6,'local synthetic reviewer')`,[scope.versionId,store,scope.from,scope.to,JSON.stringify(manifest),evidence]);
  await bulk(tx,'finance_v1.line_cost_evidence',costs,['version_id','store_id','line_id','order_id','sale_date','currency','observed_line','quantity','historic_unit_cost_pence','evidence_ref']);
  for(const r of returns)await tx.query('INSERT INTO finance_v1.stock_return_evidence VALUES($1,$2,$3,$4,$5,$6,$7)',[scope.versionId,store,r.source_return_id,r.line_id,r.saleable_date,r.quantity,evidence]);
  for(const e of expenses)await tx.query("INSERT INTO finance_v1.expense_evidence VALUES($1,$2,'overhead_entry',$3,$4,'GBP',$5,$6,$7)",[scope.versionId,store,e.id,e.classification,JSON.stringify(e.snapshot),evidence,`synthetic:${e.id}`]);
  await tx.query('INSERT INTO finance_v1.profit_component_coverage VALUES($1,true,true,true,true,true,true,$2,$3)',[scope.versionId,JSON.stringify(manifest),evidence]);
 }
 if(failAt==='before-commit')throw Error('Injected staging failure before commit');
}
export async function readStagingProfit(handle,scope,{userId=handle.reviewerId}={}) {
 ensure(handles.has(handle),'Disposable rehearsal handle required');
 const bare={storeId:scope.storeId,currency:scope.currency,from:scope.from,to:scope.to};
 return readProfitEvidence(handle.db,{versionId:scope.versionId,scope:bare,readSales:createProfitSalesReader({userId})});
}
export async function executeStagingRehearsal(handle,payload,{mode='rollback',failAt=null}={}) {
 ensure(['rollback','commit-local'].includes(mode),'Only rollback or explicitly local disposable commit accepted');
 ensure(failAt===null||['after-sources','before-commit'].includes(failAt),'Unknown failure injection');
 const preflight=await inspectStagingPreflight(handle,payload),before=await stagingFingerprints(handle.db),unrelated=await stagingFingerprints(handle.db,{excludeTarget:true});
 if(preflight.replay)return {status:'local-exact-replay',inserted:0,before,after:before,remoteApplied:false};
 let result;
 try {
  await handle.db.transaction(async tx=>{
   await tx.exec("SET LOCAL TIME ZONE 'UTC'");
   await populate(tx,payload,{failAt});
   ensure(unrelated===await stagingFingerprints(tx,{excludeTarget:true}),'Unrelated store fingerprint changed');
   const sourceHash=await stagingFingerprints(tx);
   await tx.query('INSERT INTO synthetic_rehearsal.receipts VALUES($1,$2,$3)',[TARGET.storeId,payload.payloadHash,sourceHash]);
   result={status:mode==='rollback'?'local-rehearsal-rolled-back':'local-disposable-commit',inserted:payload.orders.length+payload.refunds.length+payload.lines.length,sourceHash,preflight,remoteApplied:false};
   if(mode==='rollback'){const error=Error('Expected local rollback');error.expectedRollback=true;throw error;}
  });
 }catch(error){if(!error.expectedRollback)throw error;}
 const after=await stagingFingerprints(handle.db);
 if(mode==='rollback')ensure(before===after,'Rollback did not restore every canonical relation');
 return {...result,before,after};
}
