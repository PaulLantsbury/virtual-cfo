/** Build a rollback-only SQL review artifact from an already validated disposable canonical fixture. */
import {date} from './generator.mjs';
import {createStagingRehearsal,executeStagingRehearsal,STAGING_TABLES,STAGING_SIDE_EFFECT_TABLES} from './staging-rehearsal.mjs';
import {prepareStagingPayload,RESERVED_SYNTHETIC_IDENTITY as TARGET,hash} from './staging-payload.mjs';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const targetFilter=table=>table==='public.stores'?`id=${literal(TARGET.storeId)}::uuid`:table==='finance_v1.profit_component_coverage'?`version_id IN(SELECT id FROM finance_v1.profit_evidence_versions WHERE store_id=${literal(TARGET.storeId)}::uuid)`:`store_id=${literal(TARGET.storeId)}::uuid`;
const tableList=STAGING_TABLES.map(literal).join(',');
const canonicalSchemaContractQuery=`SELECT jsonb_build_object('columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_schema,table_name,ordinal_position) FROM (SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema||'.'||table_name=ANY(ARRAY[${tableList}])) c),'constraints',(SELECT jsonb_agg(jsonb_build_object('table',n.nspname||'.'||r.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY n.nspname,r.relname,c.conname) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE c.contype<>'n' AND n.nspname||'.'||r.relname=ANY(ARRAY[${tableList}])),'triggers',(SELECT jsonb_agg(jsonb_build_object('table',n.nspname||'.'||r.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)) ORDER BY n.nspname,r.relname,t.tgname) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE NOT t.tgisinternal AND n.nspname||'.'||r.relname=ANY(ARRAY[${tableList}])) ) contract`;
const dependencyList=STAGING_SIDE_EFFECT_TABLES.map(literal).join(',');
const dependencyContract=`jsonb_build_object('columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_schema,table_name,ordinal_position) FROM (SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema||'.'||table_name=ANY(ARRAY[${dependencyList}])) c),'constraints',(SELECT jsonb_agg(jsonb_build_object('table',n.nspname||'.'||r.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY n.nspname,r.relname,c.conname) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE c.contype<>'n' AND n.nspname||'.'||r.relname=ANY(ARRAY[${dependencyList}])),'triggers',(SELECT jsonb_agg(jsonb_build_object('table',n.nspname||'.'||r.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)) ORDER BY n.nspname,r.relname,t.tgname) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE NOT t.tgisinternal AND n.nspname||'.'||r.relname=ANY(ARRAY[${dependencyList}])),'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid) ORDER BY p.proname,p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ingest_v1' AND p.proname IN ('invalidate_verified_store','invalidate_source_change','invalidate_head_review','invalidate_store_settings'))) `;
// Preserve the exact canonical contract, then bind every observed invalidation dependency too.
export const stagingSchemaContractQuery=canonicalSchemaContractQuery.replace(/ \) contract$/,`, 'side_effect_dependencies',${dependencyContract}) contract`);
const shaQuery=(table,where)=>`SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]'),'UTF8')),'hex') FROM ${table} t WHERE ${where}`;
export async function prepareStagingSqlProposal(fixture,{reviewerId,from,to}={}) {
 if(!reviewerId)throw Error('Explicit reviewed reviewer UUID required; no live identity inferred');
 date(from);date(to);const last=new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),0)).toISOString().slice(0,10);
 if(from.slice(8)!=='01'||to!==last)throw Error('SQL proposal is bounded to one complete calendar month');
 const handle=await createStagingRehearsal({reviewerId});
 try {
  const payload=prepareStagingPayload(fixture,{reviewerId:handle.reviewerId,from,to,identity:TARGET,reviewed:true});
  await executeStagingRehearsal(handle,payload,{mode:'commit-local'});
  const db=handle.db,contract=(await db.query(stagingSchemaContractQuery)).rows[0].contract;
  const statements=[],counts={},postchecks=[];
  for(const table of STAGING_TABLES){
   const rows=(await db.query(`SELECT to_jsonb(t)::text row FROM ${table} t WHERE ${targetFilter(table)} ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.row);
   counts[table]=rows.length;
   const [schema,name]=table.split('.');
   const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND is_generated='NEVER' ORDER BY ordinal_position",[schema,name])).rows.map(c=>'"'+c.column_name+'"').join(',');
   for(let i=0;i<rows.length;i+=250)statements.push(`INSERT INTO ${table} (${columns}) SELECT ${columns} FROM jsonb_populate_recordset(NULL::${table},${literal('['+rows.slice(i,i+250).join(',')+']')}::jsonb);`);
   const expected=(await db.query(shaQuery(table,targetFilter(table)))).rows[0].encode;
   postchecks.push(`IF (SELECT count(*) FROM ${table} WHERE ${targetFilter(table)})<>${rows.length} OR (${shaQuery(table,targetFilter(table))})<>${literal(expected)} THEN RAISE EXCEPTION 'Synthetic postflight mismatch ${table}'; END IF;`);
  }
  for(const table of STAGING_SIDE_EFFECT_TABLES){counts[table]=0;postchecks.push(`IF EXISTS(SELECT 1 FROM ${table} WHERE store_id=${literal(TARGET.storeId)}::uuid) THEN RAISE EXCEPTION 'Unexpected synthetic intake side effect ${table}'; END IF;`);}
  const schemaExpression=stagingSchemaContractQuery.replace(/ contract$/,'');
  const targetGuard=`IF EXISTS(SELECT 1 FROM public.stores WHERE id=${literal(TARGET.storeId)}::uuid OR shopify_domain=${literal(TARGET.domain)} OR shopify_store_id=${literal(TARGET.externalId)}) THEN RAISE EXCEPTION 'Reserved new synthetic identity occupied; replay/dirty state refused'; END IF;`;
  const reviewerGuard=`IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=${literal(handle.reviewerId)}::uuid) OR NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE user_id=${literal(handle.reviewerId)}::uuid) THEN RAISE EXCEPTION 'Existing approved reviewer and prior membership required'; END IF;`;
  const schemaGuard=`IF (${schemaExpression}) IS DISTINCT FROM ${literal(JSON.stringify(contract))}::jsonb THEN RAISE EXCEPTION 'Canonical schema contract differs; inspect before approval'; END IF;`;
  const guard=`DO $synthetic_preflight$ BEGIN
IF current_setting('night_scout.synthetic_target_verified',true) IS DISTINCT FROM 'v2-isolated-staging-reviewed' THEN RAISE EXCEPTION 'Independent staging connection/operator review required; attestation is not authentication'; END IF;
${targetGuard}\n${reviewerGuard}\n${schemaGuard}\nEND $synthetic_preflight$;`;
  const unrelatedExpression=`jsonb_build_object(${[...STAGING_TABLES,...STAGING_SIDE_EFFECT_TABLES].flatMap(table=>[literal(table),`(${shaQuery(table,`NOT (${targetFilter(table)})`)})`]).join(',')})`;
  const checks=`DO $synthetic_postflight$ BEGIN\n${postchecks.join('\n')}\nIF (${unrelatedExpression}) IS DISTINCT FROM current_setting('night_scout.synthetic_unrelated_before',true)::jsonb THEN RAISE EXCEPTION 'Unrelated store state changed'; END IF;\nEND $synthetic_postflight$;`;
  const rollbackSql=`-- REVIEW ARTIFACT ONLY: no connection binding or live application approval.
-- Ends with ROLLBACK. Does not create users, roles, schemas, policies, grants or provider transactions.
BEGIN;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
LOCK TABLE public.stores IN SHARE ROW EXCLUSIVE MODE;
${guard}
SELECT set_config('night_scout.synthetic_unrelated_before',(${unrelatedExpression})::text,true);
${statements.join('\n')}
${checks}
ROLLBACK;
`;
  return {status:'rollback-only-review-proposal',identity:TARGET,reviewerId:handle.reviewerId,window:payload.window,counts,payloadHash:payload.payloadHash,schemaHash:hash(contract),sqlHash:hash(rollbackSql),rollbackSql,
   readOnlyPreflightSql:`BEGIN READ ONLY;\nDO $synthetic_readonly$ BEGIN\n${targetGuard}\n${reviewerGuard}\n${schemaGuard}\nEND $synthetic_readonly$;\nROLLBACK;\n`,
   approvalGates:['Private exact staging connection/TLS identity and existing approved reviewer binding.','Live schema/constraints/triggers and effective role/RLS review; no implicit grants.','Read-only reserved-identity vacancy and unrelated fingerprints.','Explicit approval for new company/membership and exact bounded rows; no remote script is applied here.','Canonical source-as-of/coverage API contract remains unavailable; created_at is authoring time.','Append-only daily operation and concurrent replay receipts require separate reviewed implementation.'],remoteApplied:false};
 }finally{await handle.db.close();}
}
