/** Offline preparation only. Outputs reviewer-bound private SQL; never connects or applies remotely. */
import {readFile} from 'node:fs/promises';
import {generate} from './generator.mjs';
import {prepareStagingSqlProposal} from './staging-sql-proposal.mjs';
import {createStagingRehearsal,executeStagingRehearsal} from './staging-rehearsal.mjs';
import {prepareStagingPayload,RESERVED_SYNTHETIC_IDENTITY as identity,stableId,hash} from './staging-payload.mjs';
import {profitEvidenceDigest} from '../financial-v1/profit-evidence-reader.mjs';
import {createProfitSalesReader} from '../financial-v1/profit-sales-reader.mjs';
const lit=value=>"'"+String(value).replaceAll("'","''")+"'";
const snapshotTables="ARRAY['reporting_snapshots','reporting_snapshot_invalidations']";
export const initialSnapshotSchemaQuery=`SELECT jsonb_build_object(
 'columns',(SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name,ordinal_position) FROM (SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='finance_v1' AND table_name=ANY(${snapshotTables})) c),
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'rls',r.relrowsecurity,'forced',r.relforcerowsecurity) ORDER BY r.relname) FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='finance_v1' AND r.relname=ANY(${snapshotTables})),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY r.relname,c.conname) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='finance_v1' AND r.relname=ANY(${snapshotTables}) AND c.contype<>'n'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)) ORDER BY r.relname,t.tgname) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='finance_v1' AND r.relname=ANY(${snapshotTables}) AND NOT t.tgisinternal),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='finance_v1' AND tablename=ANY(${snapshotTables})),
 'grants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY table_name,grantee,privilege_type) FROM (SELECT table_name,grantee,privilege_type,is_grantable FROM information_schema.table_privileges WHERE table_schema='finance_v1' AND table_name=ANY(${snapshotTables})) g)
 ) contract`;
export async function prepareInitialSeedCandidate({reviewerId,observedAt}={}) {
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reviewerId||''))throw Error('Privately verified existing reviewer UUID required');
 if(typeof observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(observedAt)||!Number.isFinite(Date.parse(observedAt))||new Date(observedAt).toISOString().slice(0,19)!==observedAt.slice(0,19)||Date.parse(observedAt)<Date.parse('2025-02-01T00:00:00Z'))throw Error('Explicit truthful inspection timestamp required');
 const from='2025-01-01',to='2025-01-31';
 const fixture=generate({asOf:'2025-02-01',from});
 const proposal=await prepareStagingSqlProposal(fixture,{reviewerId,from,to});
 const h=await createStagingRehearsal({reviewerId});
 try {
  await h.db.exec(await readFile(new URL('./staging-snapshot-schema.sql',import.meta.url),'utf8'));
  const snapshotContract=(await h.db.query(initialSnapshotSchemaQuery)).rows[0].contract;
  const snapshotGuard=`DO $snapshot_preflight$ BEGIN IF (${initialSnapshotSchemaQuery.replace(/ contract$/,'')}) IS DISTINCT FROM ${lit(JSON.stringify(snapshotContract))}::jsonb THEN RAISE EXCEPTION 'Reporting snapshot schema/security contract differs'; END IF; END $snapshot_preflight$;\n`;
  const payload=prepareStagingPayload(fixture,{reviewerId,from,to,identity,reviewed:true});
  await executeStagingRehearsal(h,payload,{mode:'commit-local'});
  const source=await h.db.transaction(tx=>createProfitSalesReader({userId:reviewerId})(tx,{storeId:identity.storeId,currency:'GBP',from,to}));
  const version=(await h.db.query('SELECT source_manifest FROM finance_v1.profit_evidence_versions WHERE id=$1',[payload.scopes[0].versionId])).rows[0];
  const row={snapshot_id:stableId('reporting-snapshot',`${from}:initial-seed`),store_id:identity.storeId,date_from:from,date_to:to,currency:'GBP',timezone:'Europe/London',source_basis:'synthetic-local',formula_version:'night-scout-v11-2026-10-30',contract_version:1,sales_revision:source.revision,profit_version_id:payload.scopes[0].versionId,source_as_of:'2025-02-01T00:00:00Z',observed_at:observedAt,manifest_digest:profitEvidenceDigest(version.source_manifest),profile_version:payload.profile,coverage:{sales:'complete',costs:'complete'}};
  const keys=Object.keys(row),snapshotSql=`INSERT INTO finance_v1.reporting_snapshots (${keys.join(',')}) SELECT ${keys.join(',')} FROM jsonb_populate_record(NULL::finance_v1.reporting_snapshots,${lit(JSON.stringify(row))}::jsonb);\n`;
  const sourceHorizonNote='source_as_of is the exclusive end of the verified fictional completed-day horizon, not authoring time or provider observation; observed_at is the explicitly supplied truthful package inspection time.';
  const body=proposal.rollbackSql.replace("SET LOCAL TIME ZONE 'UTC';",()=>"SET LOCAL TIME ZONE 'UTC';\n"+snapshotGuard).replace(/ROLLBACK;\s*$/,snapshotSql);
  const rehearsalSql=body+'ROLLBACK;\n',commitCandidateSql=body+'COMMIT;\n';
  return {status:'private-binding-required-prepared-only',remoteApplied:false,reviewerBindingVerified:false,window:{from,to},counts:{...proposal.counts,'finance_v1.reporting_snapshots':1},payloadHash:payload.payloadHash,sourceSnapshot:row,sourceHorizonNote,schemaHash:proposal.schemaHash,snapshotSchemaHash:hash(snapshotContract),rehearsalHash:hash(rehearsalSql),commitHash:hash(commitCandidateSql),rehearsalSql,commitCandidateSql,readOnlyPreflightSql:proposal.readOnlyPreflightSql.replace(/ROLLBACK;\s*$/,()=>snapshotGuard+'ROLLBACK;\n'),limitations:['Reviewer identity and live target/role/schema must be independently verified before approval.','Snapshot schema and trusted reader/grants must match the approved deployed contract.','Commit candidate requires explicit exact-artifact approval; no execution helper is provided.','Fixed January2025 seed only; no daily append, provider, scheduler or hosted deployment.']};
 }finally{await h.db.close();}
}
