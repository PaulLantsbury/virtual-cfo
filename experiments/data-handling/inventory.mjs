/** Read-only staging inventory. No connection/credential loading, provider calls,
 * writes, deletion planning SQL or retention deadline is supplied by this module.
 */
export const INVENTORY_TARGET=Object.freeze({projectRef:'bioalckltvkhlczusdvl',storeId:'56d92f8a-746e-4b4f-b408-81fc98c4aa17'});
const failure=()=>Error('Data-handling inventory unavailable; no write, deletion or provider operation was attempted.');
const spec=(table,category,columns,sql,dependencies=[])=>Object.freeze({table,category,columns,sql,dependencies});
const direct=(table,category)=>spec(table,category,['store_id'],`SELECT count(*)::text row_count FROM ${table} WHERE store_id=$1`);
const connection=(table,category)=>spec(table,category,['connection_id'],`SELECT count(*)::text row_count FROM ${table} t JOIN xero_v1.connections c ON c.id=t.connection_id WHERE c.store_id=$1`,['xero_v1.connections']);
const mapping=(table,versionTable,category)=>spec(table,category,['mapping_version_id'],`SELECT count(*)::text row_count FROM ${table} t JOIN ${versionTable} v ON v.id=t.mapping_version_id JOIN xero_v1.connections c ON c.id=v.connection_id WHERE c.store_id=$1`,[versionTable,'xero_v1.connections']);
export const inventorySpecs=Object.freeze([
 spec('public.stores','store_scope',['id','shopify_domain','shopify_store_id','currency_code','timezone'],'SELECT count(*)::text row_count FROM public.stores WHERE id=$1'),
 ...['store_memberships','customers','orders','refunds','order_line_items','refund_line_items','products','product_variants','discounts','discount_codes','overhead_categories','overhead_entries','store_cost_assumptions','store_settings','cash_balance_snapshots','cfo_alerts','opportunities','channel_opportunity_scores','cac_trend_snapshots','marketing_blended_monthly','marketing_channel_daily_metrics','marketing_channel_monthly_snapshots'].map(t=>direct(`public.${t}`,t==='customers'?'legacy_contact_fields':t==='store_memberships'?'account_membership':'normalised_or_derived')),
 ...['batches','heads','source_versions','import_receipts','review_authorizations','review_audit','sync_attempts','nightly_claims'].map(t=>direct(`ingest_v1.${t}`,t==='review_audit'?'source_copy_in_review_audit':t==='batches'?'selected_source_and_versions':'intake_history_or_authorisation')),
 direct('shopify_identity_v1.order_observations','linkable_customer_identifier'),
 ...['order_evidence','refund_evidence','coverage_evidence','profit_evidence_versions','line_cost_evidence','stock_return_evidence','expense_evidence'].map(t=>direct(`finance_v1.${t}`,'financial_evidence_or_snapshot')),
 spec('finance_v1.profit_component_coverage','financial_evidence_or_snapshot',['version_id'],'SELECT count(*)::text row_count FROM finance_v1.profit_component_coverage t JOIN finance_v1.profit_evidence_versions v ON v.id=t.version_id WHERE v.store_id=$1',['finance_v1.profit_evidence_versions']),
 direct('xero_v1.connections','provider_connection'),
 ...['account_directories','mapping_versions','mapping_audit','credential_envelopes','credential_audit','accounting_evidence','connection_preflight_evidence','xero_reauthorization_authorizations','xero_second_reauthorization_authorizations','xero_third_reauthorization_authorizations','xero_fourth_reauthorization_authorizations','xero_fifth_reauthorization_authorizations','xero_sixth_reauthorization_authorizations','pnl_mapping_versions','pnl_suggestion_runs'].map(t=>connection(`xero_v1.${t}`,t==='credential_envelopes'?'encrypted_reader_credentials':t==='accounting_evidence'?'bounded_accounting_totals':'accounting_mapping_or_audit')),
 mapping('xero_v1.mapping_selections','xero_v1.mapping_versions','accounting_mapping_or_audit'),
 mapping('xero_v1.pnl_mapping_selections','xero_v1.pnl_mapping_versions','accounting_mapping_or_audit'),
 mapping('xero_v1.pnl_line_dispositions','xero_v1.pnl_mapping_versions','accounting_mapping_or_audit'),
 spec('xero_v1.pnl_mapping_suggestions','accounting_mapping_or_audit',['suggestion_run_id'],'SELECT count(*)::text row_count FROM xero_v1.pnl_mapping_suggestions t JOIN xero_v1.pnl_suggestion_runs v ON v.id=t.suggestion_run_id JOIN xero_v1.connections c ON c.id=v.connection_id WHERE c.store_id=$1',['xero_v1.pnl_suggestion_runs','xero_v1.connections']),
 spec('xero_v1.accounting_evidence_audit','accounting_audit',['evidence_id'],'SELECT count(*)::text row_count FROM xero_v1.accounting_evidence_audit t JOIN xero_v1.accounting_evidence e ON e.id=t.evidence_id JOIN xero_v1.connections c ON c.id=e.connection_id WHERE c.store_id=$1',['xero_v1.accounting_evidence','xero_v1.connections']),
 spec('xero_v1.accounting_evidence_retry_authorizations','accounting_retry_authorisation',['evidence_id'],'SELECT count(*)::text row_count FROM xero_v1.accounting_evidence_retry_authorizations t JOIN xero_v1.accounting_evidence e ON e.id=t.evidence_id JOIN xero_v1.connections c ON c.id=e.connection_id WHERE c.store_id=$1',['xero_v1.accounting_evidence','xero_v1.connections']),
 direct('xero_v1.customer_reconnect_attempts','proposed_reconnect_context'),
 spec('auth.users','shared_sign_in_account',['id'],'SELECT count(*)::text row_count FROM auth.users t WHERE EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.store_id=$1 AND m.user_id=t.id)',['public.store_memberships']),
 spec('auth.sessions','shared_sign_in_sessions',['user_id'],'SELECT count(*)::text row_count FROM auth.sessions t WHERE EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.store_id=$1 AND m.user_id=t.user_id)',['public.store_memberships']),
]);
const schemas=Object.freeze(['public','ingest_v1','finance_v1','shopify_identity_v1','xero_v1','auth','staging_test_programme']);
export const catalogQuery=`SELECT n.nspname::text schema_name,c.relname::text table_name,c.relrowsecurity AS rls,
 has_schema_privilege(n.oid,'USAGE') AND has_table_privilege(c.oid,'SELECT') AS readable,
 ARRAY(SELECT a.attname::text FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT count(*)::integer FROM pg_catalog.pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal AND ((t.tgtype::integer & 8)=8 OR (t.tgtype::integer & 32)=32)) AS delete_guard_count
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p')`;
const count=value=>{
 if(typeof value==='string'&&/^\d+$/.test(value))value=Number(value);
 if(!Number.isSafeInteger(value)||value<0)throw failure();return value;
};
/** Caller supplies an already authorised client in the independently verified staging
 * project. Never reuse writer credentials, elevate a role or bypass RLS for this check.
 * Counts are CURRENT-ROLE-VISIBLE ONLY, even when all expected relations are present.
 */
export async function inventoryDataHandling(client,{projectRef,storeId}={}){
 let started=false;
 try{
  if(typeof client?.query!=='function'||projectRef!==INVENTORY_TARGET.projectRef||storeId!==INVENTORY_TARGET.storeId)throw failure();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');started=true;
  await client.query("SET LOCAL statement_timeout='10s'");
  const rows=(await client.query(catalogQuery,[schemas])).rows;
  if(!Array.isArray(rows))throw failure();
  const catalog=new Map();
  for(const r of rows){
   if(!schemas.includes(r.schema_name)||typeof r.table_name!=='string'||!Array.isArray(r.columns)||typeof r.readable!=='boolean'||typeof r.rls!=='boolean')throw failure();
   const name=`${r.schema_name}.${r.table_name}`;if(catalog.has(name))throw failure();catalog.set(name,r);
  }
  const store=catalog.get('public.stores');
  if(!store?.readable||!inventorySpecs[0].columns.every(c=>store.columns.includes(c)))throw failure();
  const target=(await client.query("SELECT count(*)::text row_count FROM public.stores WHERE id=$1 AND shopify_domain='pocketlaunchpad1.myshopify.com' AND shopify_store_id='95601983836' AND currency_code='GBP' AND timezone='Europe/London'",[storeId])).rows;
  if(target?.length!==1||count(target[0].row_count)!==1)throw failure();
  const relations=[];
  for(const item of inventorySpecs){
   const metadata=catalog.get(item.table);
   const base={relation:item.table,category:item.category,visibleRowCount:null,visibility:'current_role_visible_only',deleteGuardTriggerCount:metadata?count(metadata.delete_guard_count):null};
   if(!metadata){relations.push({...base,state:'relation_absent'});continue;}
   if(!metadata.readable){relations.push({...base,state:'unreadable'});continue;}
   if(!item.columns.every(c=>metadata.columns.includes(c))){relations.push({...base,state:'unsupported_shape'});continue;}
   if(item.dependencies.some(name=>!catalog.get(name)?.readable)){relations.push({...base,state:'dependency_unavailable'});continue;}
   await client.query('SAVEPOINT inventory_relation');
   try{
    const result=(await client.query(item.sql,[storeId])).rows;
    if(result?.length!==1)throw failure();
    relations.push({...base,state:'counted',visibleRowCount:count(result[0].row_count)});
    await client.query('RELEASE SAVEPOINT inventory_relation');
   }catch{
    await client.query('ROLLBACK TO SAVEPOINT inventory_relation');await client.query('RELEASE SAVEPOINT inventory_relation');
    relations.push({...base,state:'count_unavailable'});
   }
  }
  const known=new Set(inventorySpecs.map(i=>i.table)),unclassifiedRelationCount=[...catalog.keys()].filter(name=>!known.has(name)).length;
  await client.query('ROLLBACK');started=false;
  return Object.freeze({event:'data_handling_inventory',projectRef,state:'read_only_inventory_with_coverage_gaps',relations,unclassifiedRelationCount,
   retentionPeriods:'not_decided_by_this_tool',deletionImplementedByThisTool:false,disconnectVerified:false,providerRevocationVerified:false,backupsVerified:false,
   writeAttempted:false,providerCalled:false,coverage:'visible_rows_only_not_a_complete_erasure_manifest',
   requiredReviews:['unclassified_relations_and_unattributable_audit_rows','append_only_and_foreign_key_dependencies','provider_credentials_schedulers_and_active_work','browser_storage_auth_and_shared_accounts','operator_files_logs_exports_and_host_secrets','backups_restoration_and_deletion_reapplication','approved_purpose_retention_and_erasure_policy']});
 }catch{if(started)try{await client.query('ROLLBACK');}catch{}throw failure();}
}
