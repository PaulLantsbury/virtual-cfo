/** Generate reviewed private read-access SQL. Never applies it or creates a role. */
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
export const HISTORY_READ_TABLES=Object.freeze(['contracts','events','orders','refunds','lines','returns','coverage','seals','invalidations','runs','correction_proposals','correction_reviews','correction_overlays','correction_versions','correction_selections','version_heads','correction_receipts']);
export function prepareHistoryReadAccess({serviceRole}={}){
 if(typeof serviceRole!=='string'||!/^[a-z][a-z0-9_]{1,62}$/.test(serviceRole)||['postgres','anon','authenticated','service_role','public'].includes(serviceRole))throw Error('Verified restricted existing server role required');
 const role='"'+serviceRole+'"',tables=HISTORY_READ_TABLES.map(t=>'finance_history_v2.'+t).join(',');
 const guard=`DO $history_access_preflight$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='${serviceRole}' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication) THEN RAISE EXCEPTION 'Restricted existing server role required'; END IF; IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='finance_history_v2') THEN RAISE EXCEPTION 'History policy state differs; inspect before application'; END IF; IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='finance_history_v2' AND c.relkind='r' AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'History RLS must be enabled'; END IF; IF has_schema_privilege('anon','finance_history_v2','USAGE') OR has_schema_privilege('authenticated','finance_history_v2','USAGE') THEN RAISE EXCEPTION 'Unexpected browser schema access'; END IF; END $history_access_preflight$;`;
 const policies=HISTORY_READ_TABLES.map(t=>{
  let store=`${t}.store_id`;
  if(t==='invalidations')store='(SELECT s.store_id FROM finance_history_v2.seals s WHERE s.snapshot_id=invalidations.snapshot_id)';
  if(t==='correction_reviews')store='(SELECT p.store_id FROM finance_history_v2.correction_proposals p WHERE p.proposal_id=correction_reviews.proposal_id)';
  return `CREATE POLICY history_member_read ON finance_history_v2.${t} FOR SELECT TO ${role} USING (${store}='${identity.storeId}'::uuid AND EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.store_id=${store} AND m.user_id=NULLIF(current_setting('night_scout.profit_user_id',true),'')::uuid));`;
 }).join('\n');
 const readonlyProof=[`has_schema_privilege('${serviceRole}','finance_history_v2','CREATE')`,...HISTORY_READ_TABLES.map(t=>`has_table_privilege('${serviceRole}','finance_history_v2.${t}','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')`)].join(' OR ');
 const stagedGuard=`DO $history_release_ready$ BEGIN IF to_regclass('finance_history_v2.release_manifest') IS NOT NULL THEN IF (SELECT count(*) FROM finance_history_v2.release_manifest WHERE published)<>1 THEN RAISE EXCEPTION 'Staged history is not published'; END IF; END IF; END $history_release_ready$;`;
 const commitSql=`BEGIN;\n${guard}\n${stagedGuard}\nGRANT USAGE ON SCHEMA finance_history_v2 TO ${role};\nGRANT SELECT ON ${tables} TO ${role};\n${policies}\nDO $history_access_postflight$ BEGIN IF ${readonlyProof} THEN RAISE EXCEPTION 'Server history access must remain read-only'; END IF; END $history_access_postflight$;\nCOMMIT;\n`;
 const rollbackSql=`BEGIN;\n${HISTORY_READ_TABLES.map(t=>`DROP POLICY history_member_read ON finance_history_v2.${t};`).join('\n')}\nREVOKE SELECT ON ${tables} FROM ${role};\nREVOKE USAGE ON SCHEMA finance_history_v2 FROM ${role};\nCOMMIT;\n`;
 return {status:'proposal-only',remoteApplied:false,commitSql,rollbackSql};
}
