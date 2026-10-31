import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {readProfitEvidence,profitEvidenceDigest} from './profit-evidence-reader.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const id=n=>`93000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('private evidence proposal compiles against saved staging objects and enforces bounded constraints',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;`);
 await db.exec(read('../../db-migrations/staging/20260909_bootstrap.sql'));
 await db.exec('CREATE SCHEMA finance_v1');
 await db.exec(read('../../db-migrations/proposals/20260913_profit_evidence.sql'));
 await db.query(`INSERT INTO public.stores(id,shopify_domain,shopify_store_id) VALUES($1,'a.invalid','a'),($2,'b.invalid','b')`,[id(1),id(2)]);
 await db.query(`INSERT INTO public.orders(id,store_id,shopify_order_id) VALUES($1,$2,'synthetic')`,[id(3),id(1)]);
 await db.query(`INSERT INTO public.order_line_items(id,order_id,store_id,quantity) VALUES($1,$2,$3,2)`,[id(4),id(3),id(1)]);
 await db.query(`INSERT INTO finance_v1.profit_evidence_versions(id,store_id,date_from,date_to,currency,source_manifest,evidence_ref,verified_by) VALUES($1,$2,'2026-04-01','2026-04-30','GBP','{}','fixture','test')`,[id(5),id(1)]);
 await assert.rejects(db.query(`INSERT INTO finance_v1.profit_evidence_versions(id,store_id,date_from,date_to,currency,source_manifest,evidence_ref,verified_by) VALUES($1,$2,'2026-04-02','2026-04-30','GBP','{}','fixture','test')`,[id(6),id(1)]),e=>e.code==='23514');
 const line=async(store,currency='GBP')=>db.query(`INSERT INTO finance_v1.line_cost_evidence SELECT $1,$2,id,order_id,'2026-02-01',$3,to_jsonb(l),quantity,4000,'cost doc' FROM public.order_line_items l WHERE id=$4`,[id(5),store,currency,id(4)]);
 await assert.rejects(line(id(2)),/store mismatch/); await assert.rejects(line(id(1),'USD'),/scope\/snapshot/); await line(id(1));
 await db.query(`INSERT INTO finance_v1.stock_return_evidence VALUES($1,$2,'stock1',$3,'2026-04-10',1,'warehouse')`,[id(5),id(1),id(4)]);
 await assert.rejects(db.query(`INSERT INTO finance_v1.stock_return_evidence VALUES($1,$2,'stock2',$3,'2026-04-11',2,'warehouse')`,[id(5),id(1),id(4)]),/excessive/);
 await db.query(`INSERT INTO public.overhead_categories(id,store_id,name) VALUES($1,$2,'D&A evidence')`,[id(7),id(1)]);
 await db.query(`INSERT INTO public.overhead_entries(id,store_id,category_id,period_start,period_end,amount) VALUES($1,$2,$3,'2026-04-01','2026-04-30',100)`,[id(8),id(1),id(7)]);
 const expense=()=>db.query(`INSERT INTO finance_v1.expense_evidence SELECT $1,$2,'overhead_entry',o.id,'depreciation_amortisation','GBP',jsonb_build_object('entry',to_jsonb(o),'category',to_jsonb(c)),'doc','depreciation-april' FROM public.overhead_entries o JOIN public.overhead_categories c ON c.id=o.category_id WHERE o.id=$3`,[id(5),id(1),id(8)]);
 await expense(); await assert.rejects(expense(),e=>e.code==='23505');
 await assert.rejects(db.query(`UPDATE finance_v1.line_cost_evidence SET historic_unit_cost_pence=1`),/append-only/);
 await db.query(`INSERT INTO finance_v1.profit_component_coverage(version_id,source_manifest,evidence_ref) VALUES($1,'{}','manifest')`,[id(5)]);
 await assert.rejects(db.query(`INSERT INTO finance_v1.stock_return_evidence VALUES($1,$2,'stock3',$3,'2026-04-12',1,'warehouse')`,[id(5),id(1),id(4)]),/sealed/);
 // Exact actual expense proof in a second, empty-sales store/month.
 await db.query(`INSERT INTO public.overhead_categories(id,store_id,name) VALUES($1,$2,'Synthetic D&A')`,[id(10),id(2)]);
 await db.query(`INSERT INTO public.overhead_entries(id,store_id,category_id,period_start,period_end,amount) VALUES($1,$2,$3,'2026-05-01','2026-05-31',100)`,[id(11),id(2),id(10)]);
 const source=(await db.query(`SELECT jsonb_build_object('entry',to_jsonb(o),'category',to_jsonb(c)) snapshot FROM public.overhead_entries o JOIN public.overhead_categories c ON c.id=o.category_id WHERE o.id=$1`,[id(11)])).rows[0].snapshot;
 const key=`overhead_entry:${id(11)}`;
 const manifest={version:1,salesRevision:'synthetic-verified-sales',lineIds:[],returnIds:[],expenseSources:[key],expenseProofs:{[key]:{basis:'actual',taxTreatment:'accounting_amount_supported',currency:'GBP',documentRef:'synthetic depreciation record',observedSourceRevision:profitEvidenceDigest(source)}}};
 await db.query(`INSERT INTO finance_v1.profit_evidence_versions(id,store_id,date_from,date_to,currency,source_manifest,evidence_ref,verified_by) VALUES($1,$2,'2026-05-01','2026-05-31','GBP',$3,'fixture','test')`,[id(9),id(2),JSON.stringify(manifest)]);
 await db.query(`INSERT INTO finance_v1.expense_evidence VALUES($1,$2,'overhead_entry',$3,'depreciation_amortisation','GBP',$4,'synthetic document','da-may')`,[id(9),id(2),id(11),JSON.stringify(source)]);
 await db.query(`INSERT INTO finance_v1.profit_component_coverage VALUES($1,true,true,true,true,true,true,$2,'synthetic complete manifest')`,[id(9),JSON.stringify(manifest)]);
 const scope={storeId:id(2),currency:'GBP',from:'2026-05-01',to:'2026-05-31'};
 // Trusted stand-in for the existing verified-sales adapter; proves invocation
 // inside the transaction. This is synthetic coverage, not raw-orders inference.
 const readSales=async(tx,s)=>{
   assert.equal((await tx.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
   assert.equal((await tx.query('SHOW transaction_isolation')).rows[0].transaction_isolation,'repeatable read');
   return {revision:'synthetic-verified-sales',eligibleOrders:[],value:{netProductSales:0,netShipping:0,originalOrders:0,provenance:{...s,coverageEvidence:'synthetic zero-sales coverage'}}};
 };
 const good=await readProfitEvidence(db,{versionId:id(9),scope,readSales});
 assert.equal(good.readError,null); assert.equal(good.result.operatingProfit.value,-10000); assert.equal(good.result.ebitda.value,0);
 await db.query(`UPDATE public.overhead_entries SET amount=101 WHERE id=$1`,[id(11)]);
 const stale=await readProfitEvidence(db,{versionId:id(9),scope,readSales});
 assert.match(stale.readError.overheads,/Stale expense/);assert.equal(stale.result.grossProfit.value,0);assert.equal(stale.result.operatingProfit.value,null);assert.equal(stale.result.sales.netProductSales,0);
 await db.query(`UPDATE public.overhead_entries SET amount=100 WHERE id=$1`,[id(11)]);
 await db.query(`INSERT INTO public.overhead_categories(id,store_id,name) VALUES($1,$2,'New omitted expense')`,[id(12),id(2)]);
 await db.query(`INSERT INTO public.overhead_entries(id,store_id,category_id,period_start,period_end,amount) VALUES($1,$2,$3,'2026-05-01','2026-05-31',25)`,[id(13),id(2),id(12)]);
 const omitted=await readProfitEvidence(db,{versionId:id(9),scope,readSales});assert.match(omitted.readError.overheads,/Current expense sources manifest/);assert.equal(omitted.result.grossProfit.value,0);
 // April recovery-only reader: historical February line, actual April return.
 const plannedLine=(await db.query(`SELECT $1::uuid version_id,$2::uuid store_id,l.id line_id,l.order_id,'2026-02-01'::date sale_date,'GBP'::text currency,to_jsonb(l) observed_line,l.quantity,4000::bigint historic_unit_cost_pence,'cost doc'::text evidence_ref,to_jsonb(l) current_line FROM public.order_line_items l WHERE l.id=$3`,[id(14),id(1),id(4)])).rows[0];
 const aprilSource=(await db.query(`SELECT jsonb_build_object('entry',to_jsonb(o),'category',to_jsonb(c)) snapshot FROM public.overhead_entries o JOIN public.overhead_categories c ON c.id=o.category_id WHERE o.id=$1`,[id(8)])).rows[0].snapshot;
 const aprilKey=`overhead_entry:${id(8)}`;
 const aprilManifest={version:1,salesRevision:'april-sales',lineIds:[id(4)],returnIds:['april-return'],expenseSources:[aprilKey],
   lineProofs:{[id(4)]:{historicalLandedCostSupported:true,documentRef:'historical landed allocation',observedEvidenceRevision:profitEvidenceDigest(plannedLine)}},
   expenseProofs:{[aprilKey]:{basis:'actual',taxTreatment:'accounting_amount_supported',currency:'GBP',documentRef:'actual april depreciation',observedSourceRevision:profitEvidenceDigest(aprilSource)}}};
 await db.query(`INSERT INTO finance_v1.profit_evidence_versions(id,store_id,date_from,date_to,currency,source_manifest,evidence_ref,verified_by) VALUES($1,$2,'2026-04-01','2026-04-30','GBP',$3,'fixture','test')`,[id(14),id(1),JSON.stringify(aprilManifest)]);
 await db.query(`INSERT INTO finance_v1.line_cost_evidence SELECT $1,$2,id,order_id,'2026-02-01','GBP',to_jsonb(l),quantity,4000,'cost doc' FROM public.order_line_items l WHERE id=$3`,[id(14),id(1),id(4)]);
 await db.query(`INSERT INTO finance_v1.stock_return_evidence VALUES($1,$2,'april-return',$3,'2026-04-10',1,'warehouse')`,[id(14),id(1),id(4)]);
 await db.query(`INSERT INTO finance_v1.expense_evidence VALUES($1,$2,'overhead_entry',$3,'depreciation_amortisation','GBP',$4,'synthetic document','da-april')`,[id(14),id(1),id(8),JSON.stringify(aprilSource)]);
 await db.query(`INSERT INTO finance_v1.profit_component_coverage VALUES($1,true,true,true,true,true,true,$2,'synthetic complete manifest')`,[id(14),JSON.stringify(aprilManifest)]);
 const aprilScope={storeId:id(1),currency:'GBP',from:'2026-04-01',to:'2026-04-30'};
 const aprilSales=async(tx,s)=>{await tx.query('SELECT id FROM public.orders WHERE store_id=$1',[s.storeId]);return {revision:'april-sales',eligibleOrders:[{id:id(3),soldOn:'2026-02-01'}],value:{netProductSales:0,netShipping:0,originalOrders:0,provenance:{...s,coverageEvidence:'synthetic return-only coverage'}}};};
 const recovered=await readProfitEvidence(db,{versionId:id(14),scope:aprilScope,readSales:aprilSales});
 assert.equal(recovered.readError,null);assert.equal(recovered.result.cogs.value,-4000);assert.equal(recovered.result.grossProfit.value,4000);assert.equal(recovered.result.operatingProfit.value,-6000);assert.equal(recovered.result.ebitda.value,4000);
 await db.query('UPDATE public.order_line_items SET quantity=3 WHERE id=$1',[id(4)]);
 const staleLine=await readProfitEvidence(db,{versionId:id(14),scope:aprilScope,readSales:aprilSales});
 assert.match(staleLine.readError.productCosts,/Stale line/);assert.equal(staleLine.result.cogs.value,null);assert.equal(staleLine.result.overheads.value,10000);assert.equal(staleLine.result.sales.netProductSales,0);
 await db.exec('SET ROLE authenticated'); await assert.rejects(db.query('SELECT * FROM finance_v1.expense_evidence'),e=>e.code==='42501'); await db.exec('RESET ROLE');
 assert.equal((await db.query(`SELECT count(*)::int n FROM pg_proc WHERE pronamespace='finance_v1'::regnamespace AND prosecdef`)).rows[0].n,0);
 }finally{await db.close();}
});
