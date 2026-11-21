/** PREPARATION ONLY: build SQL from an isolated PostgreSQL fixture. No network,
 * credentials, connection adapter or apply command. Existing schema required.
 * Target assertions are operator attestations, not proof of a connection host.
 */
import {createHash} from 'node:crypto';
import {pence} from './source-adapter.mjs';
import {setup,sql} from '../shopify/finance-fixture.mjs';
import {historicalManifest,historicalInput,PERIODS,CURRENT_PERIODS} from './historical-testing-fixture.mjs';
import {setupHistoricalProfitEvidence,HISTORICAL_PROFIT_IDS} from './historical-profit-fixture.mjs';
export const HISTORICAL_STAGING_TARGET=Object.freeze({project:'bioalckltvkhlczusdvl',host:'db.bioalckltvkhlczusdvl.supabase.co',database:'postgres',storeId:HISTORICAL_PROFIT_IDS.store,domain:'historical-pipeline.invalid'});
// Pin JSON timestamp rendering to UTC before creating source snapshots. This is independent
// of each store's business timezone and restores automatically after execution.
const serializationTimezoneSql="SET LOCAL TIME ZONE 'UTC';";
const stamp='2026-09-17T23:00:00.000Z',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id=n=>`98000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const digest=value=>createHash('sha256').update(value).digest('hex');
export const HISTORICAL_STAGING_TABLES=Object.freeze(['public.stores','public.store_memberships','public.orders','public.refunds','finance_v1.order_evidence','finance_v1.refund_evidence','finance_v1.coverage_evidence','public.order_line_items','public.overhead_categories','public.overhead_entries','finance_v1.profit_evidence_versions','finance_v1.line_cost_evidence','finance_v1.stock_return_evidence','finance_v1.expense_evidence','finance_v1.profit_component_coverage']);
const target=HISTORICAL_STAGING_TARGET;
// Includes row layouts and constraints, so a differing staging schema is a
// preflight stop requiring reconciliation, never automatic DDL adaptation.
export const historicalSchemaQuery=`SELECT jsonb_build_object('columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_schema,table_name,ordinal_position) FROM (SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,character_maximum_length,numeric_precision,numeric_scale,is_generated,generation_expression FROM information_schema.columns WHERE table_schema||'.'||table_name=ANY(ARRAY[${HISTORICAL_STAGING_TABLES.map(literal).join(',')}])) c),'constraints',(SELECT jsonb_agg(jsonb_build_object('table',n.nspname||'.'||r.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY n.nspname,r.relname,c.conname) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname||'.'||r.relname=ANY(ARRAY[${HISTORICAL_STAGING_TABLES.map(literal).join(',')}])), 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',n.nspname||'.'||r.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)) ORDER BY n.nspname,r.relname,t.tgname) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE NOT t.tgisinternal AND n.nspname||'.'||r.relname=ANY(ARRAY[${HISTORICAL_STAGING_TABLES.map(literal).join(',')}])) ) contract`;
// PostgreSQL17 lacks table NOT NULL catalog rows. Compare their enforced
// column attributes exactly; retain unvalidated/nonlocal NOT NULL exceptions.
export const stagingSchemaQuery=historicalSchemaQuery.replace("WHERE n.nspname||'.'||r.relname=ANY", "WHERE (c.contype<>'n' OR NOT(c.convalidated AND c.conislocal AND c.coninhcount=0 AND NOT c.connoinherit AND NOT c.condeferrable AND NOT c.condeferred)) AND n.nspname||'.'||r.relname=ANY").replace("'triggers',(SELECT", "'not_null_attributes',(SELECT jsonb_agg(jsonb_build_object('table',ns.nspname||'.'||r.relname,'column',a.attname,'not_null',a.attnotnull,'local',a.attislocal,'inheritance_count',a.attinhcount) ORDER BY ns.nspname,r.relname,a.attnum) FROM pg_attribute a JOIN pg_class r ON r.oid=a.attrelid JOIN pg_namespace ns ON ns.oid=r.relnamespace WHERE a.attnum>0 AND NOT a.attisdropped AND ns.nspname||'.'||r.relname=ANY(ARRAY["+HISTORICAL_STAGING_TABLES.map(literal).join(',')+"])), 'triggers',(SELECT");
async function sourceFixture(reviewerId,{current=false,intake=false}={}){
 const frozenStamp=current?'2026-10-08T23:00:00.000Z':stamp;
 const {db}=await setup(undefined,{installIntake:false});
 try{
  await db.exec("SET TIME ZONE 'UTC'");
  if(intake)await db.exec(sql('staging/20260910_review_setup.sql'));
  await db.exec(sql('proposals/20260913_profit_evidence.sql'));
  // Freeze defaults only inside this throwaway preparation database. Exported
  // SQL contains explicit values; it never changes defaults or live schemas.
  for(const table of HISTORICAL_STAGING_TABLES){
   const [schema,name]=table.split('.');
   const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND data_type IN ('timestamp with time zone','timestamp without time zone') AND column_default IS NOT NULL",[schema,name])).rows;
   for(const c of columns)await db.exec(`ALTER TABLE ${table} ALTER COLUMN "${c.column_name}" SET DEFAULT '${frozenStamp}'::timestamptz`);
  }
  if(!(await db.query('SELECT id FROM auth.users WHERE id=$1',[reviewerId])).rows.length)await db.query('INSERT INTO auth.users(id) VALUES($1)',[reviewerId]); // throwaway fixture ONLY; never exported
  const manifest=historicalManifest({current}),orderIds=new Map(manifest.orders.map((o,i)=>[o.id,id(i+1)]));
  await db.query("INSERT INTO public.stores(id,shopify_domain,shopify_store_id,name,currency_code,timezone) VALUES($1,$2,'synthetic-historical-v1','Staging Synthetic Historical Store','GBP','Europe/London')",[target.storeId,target.domain]);
  await db.query('INSERT INTO public.store_memberships(user_id,store_id) VALUES($1,$2)',[reviewerId,target.storeId]);
  for(const o of manifest.orders){
   await db.query(`INSERT INTO public.orders(id,store_id,shopify_order_id,order_date,currency,gross_sales,discounts,shipping,tax,financial_status) VALUES($1,$2,$3,$4,'GBP',$5,$6,$7,$8,'paid')`,[orderIds.get(o.id),target.storeId,o.id,o.occurredAt,o.gross,o.discount,o.shipping,((pence(o.gross_vat)-pence(o.discount_vat)+pence(o.shipping_vat))/100).toFixed(2)]);
   await db.query(`INSERT INTO finance_v1.order_evidence(store_id,order_id,observed_raw,event_date,currency,original_eligible,tax_basis,gross_product_vat,discount_vat,shipping_vat,evidence_ref,verified_by) SELECT store_id,id,current_snapshot,$2,'GBP',true,$3,$4,$5,$6,'INVENTED direct historical ledger; no Shopify completeness claim','synthetic fixture' FROM finance_v1.order_mapping WHERE id=$1`,[orderIds.get(o.id),o.day,o.tax_basis,o.gross_vat,o.discount_vat,o.shipping_vat]);
  }
  for(const [i,r]of manifest.refunds.entries()){
   await db.query('INSERT INTO public.refunds(id,store_id,order_id,shopify_refund_id,refund_date,amount) VALUES($1,$2,$3,$4,$5,$6)',[id(1000+i),target.storeId,orderIds.get(r.order_id),r.id,r.occurredAt,r.amount]);
   await db.query(`INSERT INTO finance_v1.refund_evidence(store_id,refund_id,order_id,observed_raw,event_date,currency,product_cash,product_vat,shipping_cash,shipping_vat,evidence_ref,verified_by) SELECT store_id,id,order_id,current_snapshot,$2,'GBP',$3,$4,$5,$6,'INVENTED direct historical refund split','synthetic fixture' FROM finance_v1.refund_mapping WHERE id=$1`,[id(1000+i),r.day,r.product_cash,r.product_vat,r.shipping_cash,r.shipping_vat]);
  }
  const scopes=[...(current?CURRENT_PERIODS:PERIODS).map(([m])=>historicalInput(m,{current}).scope),historicalInput('2025-09',{throughDay:17}).scope];
  for(const s of scopes)await db.query(`INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by) VALUES($1,$2,$3,'GBP',true,'Complete INVENTED direct ledger only; no external-source attestation','synthetic fixture')`,[target.storeId,s.from,s.to]);
  await setupHistoricalProfitEvidence(db,{userId:reviewerId,orderIds,current});
  return {db,orderIds};
 }catch(error){await db.close();throw error;}
}
function validate({project,host,database,reviewerId}={}){
 if(project!==target.project||host!==target.host||database!==target.database)throw Error('Exact staging project, direct host and database required');
 if(typeof reviewerId!=='string'||!uuid.test(reviewerId))throw Error('Explicit existing approved synthetic reviewer UUID required');
}
export async function prepareHistoricalStagingPackage(options){
 validate(options);const {reviewerId,current=false,intake=false,verifyStoreD=false}=options;
 if(typeof verifyStoreD!=='boolean')throw Error('Explicit boolean Store D verification required');
 if(typeof intake!=='boolean')throw Error('Explicit boolean intake fixture mode required');
 const schemaQuery=intake?stagingSchemaQuery:historicalSchemaQuery;
 if(typeof current!=='boolean')throw Error('Explicit boolean current fixture mode required');
 const {db}=await sourceFixture(reviewerId,{current,intake});
 try{
  const contract=(await db.query(schemaQuery)).rows[0].contract,rowsByTable={},fingerprints={},statements=[];
  for(const table of HISTORICAL_STAGING_TABLES){
   const where=table==='public.stores'?'id=$1':table==='finance_v1.profit_component_coverage'?'version_id IN (SELECT id FROM finance_v1.profit_evidence_versions WHERE store_id=$1)':'store_id=$1';
   const rows=(await db.query(`SELECT to_jsonb(t)::text row FROM ${table} t WHERE ${where} ORDER BY to_jsonb(t)::text`,[target.storeId])).rows.map(r=>r.row);rowsByTable[table]=rows;
   fingerprints[table]=digest((await db.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]') snapshot FROM ${table} t WHERE ${where}`,[target.storeId])).rows[0].snapshot);
   const [schema,name]=table.split('.');
   const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND is_generated='NEVER' ORDER BY ordinal_position",[schema,name])).rows.map(r=>`"${r.column_name}"`).join(',');
   for(const row of rows)statements.push(`INSERT INTO ${table} (${columns}) SELECT ${columns} FROM jsonb_populate_record(NULL::${table},${literal(row)}::jsonb);`);
  }
  const guard=`DO $historical_guard$ BEGIN
 IF current_setting('night_scout.approved_project',true) IS DISTINCT FROM ${literal(target.project)} OR current_setting('night_scout.approved_reviewer',true) IS DISTINCT FROM ${literal(reviewerId)} THEN RAISE EXCEPTION 'Exact staging target and reviewer attestation required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=${literal(reviewerId)}::uuid) OR NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE user_id=${literal(reviewerId)}::uuid) THEN RAISE EXCEPTION 'Existing approved reviewer with existing membership required'; END IF;
 IF EXISTS(SELECT 1 FROM public.stores WHERE id=${literal(target.storeId)}::uuid OR shopify_domain=${literal(target.domain)} OR shopify_store_id='synthetic-historical-v1') THEN RAISE EXCEPTION 'Historical target occupied: replay/dirty pre-state refused'; END IF;
 IF (${schemaQuery.replace(/ contract$/,'')}) IS DISTINCT FROM ${literal(JSON.stringify(contract))}::jsonb THEN RAISE EXCEPTION 'Historical schema contract differs; inspect before approval'; END IF;
END $historical_guard$;`;
  const countChecks=Object.entries(rowsByTable).map(([table,rows])=>{
   const where=table==='public.stores'?`id=${literal(target.storeId)}::uuid`:table==='finance_v1.profit_component_coverage'?`version_id IN (SELECT id FROM finance_v1.profit_evidence_versions WHERE store_id=${literal(target.storeId)}::uuid)`:`store_id=${literal(target.storeId)}::uuid`;
   return `IF (SELECT count(*) FROM ${table} WHERE ${where})<>${rows.length} THEN RAISE EXCEPTION 'Historical postflight count mismatch: ${table}'; END IF;
IF (SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]'),'UTF8')),'hex') FROM ${table} t WHERE ${where})<>${literal(fingerprints[table])} THEN RAISE EXCEPTION 'Historical postflight fingerprint mismatch: ${table}'; END IF;`;
  }).join('\n');
  const postflight=`DO $historical_check$ BEGIN\n${countChecks}\nIF EXISTS(SELECT 1 FROM finance_v1.profit_evidence_versions WHERE store_id=${literal(target.storeId)}::uuid AND date_from='${current?'2026-10-01':'2026-09-01'}') THEN RAISE EXCEPTION 'Partial month profit must remain unavailable'; END IF;\nEND $historical_check$;`;
  const compatibilityPreflightSql=`BEGIN READ ONLY;
SELECT jsonb_build_object(
 'expected_table_count',${HISTORICAL_STAGING_TABLES.length},
 'expected_column_count',${contract.columns.length},
 'expected_constraint_count',${contract.constraints?.length??0},
 'visible_constraint_count',(SELECT count(*) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname||'.'||r.relname=ANY(ARRAY[${HISTORICAL_STAGING_TABLES.map(literal).join(',')}])),
 'expected_trigger_count',${contract.triggers?.length??0},
 'visible_trigger_count',(SELECT count(*) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE NOT t.tgisinternal AND n.nspname||'.'||r.relname=ANY(ARRAY[${HISTORICAL_STAGING_TABLES.map(literal).join(',')}])),
 'visible_column_count',(SELECT count(*) FROM information_schema.columns WHERE table_schema||'.'||table_name=ANY(ARRAY[${HISTORICAL_STAGING_TABLES.map(literal).join(',')}])),
 'schema_contract_matches',(${schemaQuery.replace(/ contract$/,'')})=${literal(JSON.stringify(contract))}::jsonb,
 'reserved_target_vacant',NOT EXISTS(SELECT 1 FROM public.stores WHERE id=${literal(target.storeId)}::uuid OR shopify_domain=${literal(target.domain)} OR shopify_store_id='synthetic-historical-v1'),
 'reviewer_verification_still_required',true,
 'auth_identity_verification_still_required',true,
 'connection_identity_verification_still_required',true) readiness;
ROLLBACK;
`;
  const diagnosticParts=(intake?['columns','constraints','triggers','not_null_attributes']:['columns','constraints','triggers']).map(component=>{
   const identity=component==='not_null_attributes'?`jsonb_build_object('table',item->>'table','name',item->>'column')`:component==='columns'?`jsonb_build_object('table',item->>'table_schema'||'.'||(item->>'table_name'),'name',item->>'column_name')`:`jsonb_build_object('table',item->>'table','name',item->>'name')`;
   return `${literal(component)},(SELECT COALESCE(jsonb_agg(${identity}||jsonb_build_object('status',status) ORDER BY item::text,status),'[]'::jsonb) FROM (SELECT item,'expected_record_not_found'::text status FROM jsonb_array_elements(COALESCE(e.contract->${literal(component)},'[]'::jsonb)) item WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(a.contract->${literal(component)},'[]'::jsonb)) actual WHERE actual=item) UNION ALL SELECT item,'unexpected_or_changed_record'::text status FROM jsonb_array_elements(COALESCE(a.contract->${literal(component)},'[]'::jsonb)) item WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(e.contract->${literal(component)},'[]'::jsonb)) expected WHERE expected=item)) differences)`;
  }).join(',\n');
  const schemaDiagnosticsSql=`BEGIN READ ONLY;
WITH expected AS (SELECT ${literal(JSON.stringify(contract))}::jsonb contract), actual AS (${schemaQuery})
SELECT jsonb_build_object('server_major',current_setting('server_version_num')::integer/10000,'expected_catalog_major',${Number((await db.query("SELECT current_setting('server_version_num')::integer/10000 major")).rows[0].major)},
 'schema_contract_matches',e.contract=a.contract,
 'visible_constraint_types',(SELECT COALESCE(jsonb_object_agg(kind,n),'{}'::jsonb) FROM (SELECT c.contype::text kind,count(*) n FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=r.relnamespace WHERE ns.nspname||'.'||r.relname=ANY(ARRAY[${HISTORICAL_STAGING_TABLES.map(literal).join(',')}]) GROUP BY c.contype) kinds),
 'mismatches',jsonb_build_object(${diagnosticParts}),
 'application_authorized',false) diagnostics FROM expected e CROSS JOIN actual a;
ROLLBACK;
`;
  const body=`BEGIN;\n${serializationTimezoneSql}\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='60s';\n${guard}\n${statements.join('\n')}\n${postflight}\n`;
  const preservedStore='90000000-0000-4000-8000-000000000004';
  const baselineTables=[...HISTORICAL_STAGING_TABLES,'public.marketing_channel_daily_metrics'];
  const baselineQuery=`SELECT jsonb_build_object(${baselineTables.flatMap(table=>{
   const where=table==='public.stores'?`id=${literal(preservedStore)}::uuid`:table==='finance_v1.profit_component_coverage'?`version_id IN(SELECT id FROM finance_v1.profit_evidence_versions WHERE store_id=${literal(preservedStore)}::uuid)`:`store_id=${literal(preservedStore)}::uuid`;
   return [literal(table),`(SELECT jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]'),'UTF8')),'hex')) FROM ${table} t WHERE ${where})`];
  }).join(',')})`;
  const storeDGuard=verifyStoreD?`DO $store_d_guard$ BEGIN
 IF (SELECT count(*) FROM public.store_memberships WHERE store_id=${literal(preservedStore)}::uuid)<>1 OR NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE store_id=${literal(preservedStore)}::uuid AND user_id=${literal(reviewerId)}::uuid) THEN RAISE EXCEPTION 'Existing Store D singleton reviewer mismatch'; END IF;
 PERFORM set_config('night_scout.store_d_baseline',(${baselineQuery})::text,true);
END $store_d_guard$;
`:'';
  const storeDPostflight=verifyStoreD?`DO $store_d_preserved$ BEGIN
 IF (${baselineQuery}) IS DISTINCT FROM current_setting('night_scout.store_d_baseline',true)::jsonb THEN RAISE EXCEPTION 'Existing Store D fingerprint changed'; END IF;
END $store_d_preserved$;
`:'';
  const operatorBody=body.replace('DO $historical_guard$',storeDGuard+'DO $historical_guard$')+storeDPostflight+'COMMIT;\n';
  const operatorApplySql=operatorBody.replace('BEGIN;\n',`-- Operator attestation only: independently verify the exact staging TLS connection and approved reviewer before execution.
-- This file performs the reviewed synthetic staging data mutation; schema agreement alone is not application approval.
BEGIN;
SET LOCAL night_scout.approved_project=${literal(target.project)};
SET LOCAL night_scout.approved_reviewer=${literal(reviewerId)};
`);
  return Object.freeze({status:'prepared-only',target:{...target,reviewerId},manifestSha256:digest(JSON.stringify(historicalManifest({current}))),schemaSha256:digest(JSON.stringify(contract)),rows:Object.fromEntries(Object.entries(rowsByTable).map(([k,v])=>[k,v.length])),sqlSha256:digest(body+'COMMIT;\n'),applySql:body+'COMMIT;\n',rehearsalSql:body+'ROLLBACK;\n',preflightSql:'BEGIN READ ONLY;\n'+guard+'\nROLLBACK;\n',postflightSql:'BEGIN READ ONLY;\n'+serializationTimezoneSql+'\n'+postflight+'\nROLLBACK;\n',rollbackSql:'ROLLBACK;\n',compatibilityPreflightSql,schemaDiagnosticsSql,operatorApplySql,operatorSqlSha256:digest(operatorApplySql),storeDVerified:verifyStoreD,intakeAware:intake,fixtureMode:current?'current-2026-10-09':'historical-2026-09-18',versionIds:current?Object.fromEntries(CURRENT_PERIODS.filter(([, ,d])=>d!==8).map(([m],i)=>[m,id(5000+i).replace('98000000','97000000')])):HISTORICAL_PROFIT_IDS.versions});
 }finally{await db.close();}
}
