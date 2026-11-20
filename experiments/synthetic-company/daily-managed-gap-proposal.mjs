/** Offline managed-administrator adaptation of the independently pinned finite gap proposal.
 * No connection, execution, financial-model change, grant application or clock override.
 */
import {createHash} from 'node:crypto';
import {prepareDailyGapProposal} from './daily-gap-proposal.mjs';
import {prepareHostedDailyProposal} from './daily-hosted-proposal.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const lit=value=>"'"+value.replaceAll("'","''")+"'";
const ident=value=>'"'+value.replaceAll('"','""')+'"';
const ensure=(value,message)=>{if(!value)throw Error(message);};
function once(sql,old,next,label){ensure(sql.split(old).length===2,'Exact managed gap '+label+' boundary required');return sql.replace(old,()=>next);}

function managerGuard(management){return `DO $managed_gap_installer$ DECLARE actual jsonb;BEGIN
 SELECT jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypassRls',rolbypassrls,'replication',rolreplication,'createRole',rolcreaterole,'createDb',rolcreatedb,'inherit',rolinherit) INTO actual FROM pg_roles WHERE rolname=current_user;
 IF current_user IS DISTINCT FROM ${lit(management.name)} OR session_user IS DISTINCT FROM current_user OR actual IS DISTINCT FROM ${lit(JSON.stringify(management))}::jsonb THEN RAISE EXCEPTION 'Exact reviewed managed bridge installer/session required';END IF;
 IF (SELECT count(*) FROM pg_auth_members a JOIN pg_roles p ON p.oid=a.roleid JOIN pg_roles m ON m.oid=a.member WHERE p.rolname=ANY(ARRAY['daily_capability_owner','daily_capability_invoker','daily_capability_reviewer']) AND m.rolname=current_user)<>3 OR EXISTS(SELECT 1 FROM pg_auth_members a JOIN pg_roles p ON p.oid=a.roleid JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor WHERE p.rolname=ANY(ARRAY['daily_capability_owner','daily_capability_invoker','daily_capability_reviewer']) AND m.rolname=current_user AND (a.grantor<>10 OR NOT g.rolsuper OR NOT a.admin_option OR a.inherit_option OR a.set_option)) THEN RAISE EXCEPTION 'Exact existing bootstrap-only administration required';END IF;
 IF pg_has_role(current_user,'daily_capability_owner','SET') OR pg_has_role(current_user,'daily_capability_owner','USAGE') OR pg_has_role(current_user,'daily_capability_reviewer','SET') OR pg_has_role(current_user,'daily_capability_reviewer','USAGE') THEN RAISE EXCEPTION 'Preexisting selectable/inherited owner authority differs';END IF;
END $managed_gap_installer$;`;}
const temporaryOwners=`GRANT daily_capability_owner,daily_capability_reviewer TO CURRENT_USER WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY CURRENT_USER;`;
function cleanupOwners(extra=''){return `DO $managed_gap_cleanup$ BEGIN
 EXECUTE format('REVOKE daily_capability_owner,daily_capability_reviewer${extra} FROM %I GRANTED BY %I',current_user,current_user);
 IF pg_has_role(current_user,'daily_capability_owner','SET') OR pg_has_role(current_user,'daily_capability_owner','USAGE') OR pg_has_role(current_user,'daily_capability_reviewer','SET') OR pg_has_role(current_user,'daily_capability_reviewer','USAGE') THEN RAISE EXCEPTION 'Temporary managed owner authority remains';END IF;
END $managed_gap_cleanup$;`;}
function gapBootstrapOnly(manager){return `(SELECT count(*) FROM pg_auth_members WHERE roleid=(SELECT oid FROM pg_roles WHERE rolname='daily_gap_invoker'))<>1 OR EXISTS(SELECT 1 FROM pg_auth_members a JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor WHERE a.roleid=(SELECT oid FROM pg_roles WHERE rolname='daily_gap_invoker') AND (m.rolname<>${lit(manager)} OR a.grantor<>10 OR NOT g.rolsuper OR NOT a.admin_option OR a.inherit_option OR a.set_option))`;}

export function prepareManagedDailyGapProposal({capabilitySql,approval,managementRole}={}){
 const base=prepareDailyGapProposal({capabilitySql,approval});
 const management=prepareHostedDailyProposal({capabilitySql,expectedThrough:base.approval.initialThrough,expectedSeals:0,managementRole}).managementRole;
 ensure(management,'Explicit reviewed managed bridge installer required');
 let sql=base.sql;
 sql=once(sql,'CREATE ROLE daily_gap_invoker',managerGuard(management)+`\nDO $managed_gap_database$ BEGIN IF has_database_privilege('daily_capability_reviewer',current_database(),'CREATE') OR has_schema_privilege(current_user,'finance_daily_v1','USAGE') OR COALESCE(has_function_privilege(current_user,(SELECT f.oid FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace WHERE n.nspname='finance_daily_v1' AND f.proname='guard_reviewed_material' AND f.pronargs=0),'EXECUTE'),true) THEN RAISE EXCEPTION 'Unexpected existing managed bridge installation access';END IF; EXECUTE format('GRANT CREATE ON DATABASE %I TO daily_capability_reviewer',current_database()); END $managed_gap_database$;\nSET LOCAL createrole_self_grant='set';\n`+temporaryOwners+`\nSET LOCAL ROLE daily_capability_reviewer;\nGRANT USAGE ON SCHEMA finance_daily_v1 TO ${ident(management.name)};\nGRANT EXECUTE ON FUNCTION finance_daily_v1.guard_reviewed_material() TO ${ident(management.name)};\nRESET ROLE;\nCREATE ROLE daily_gap_invoker`,'role creation');
 const usage='GRANT USAGE ON SCHEMA finance_daily_gap_v1 TO daily_capability_owner,daily_gap_invoker;';
 sql=once(sql,usage,usage+'\nGRANT CREATE ON SCHEMA finance_daily_gap_v1 TO daily_capability_owner,daily_capability_reviewer;','temporary schema creation');
 const revoke='REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance_daily_gap_v1 FROM PUBLIC,daily_gap_invoker;';
 const execute='GRANT EXECUTE ON FUNCTION finance_daily_gap_v1.publish_approved_gap() TO daily_gap_invoker;';
 sql=once(sql,revoke,'','public function ACL');sql=once(sql,execute,'','invoker function ACL');
 const firstTransfer='ALTER FUNCTION finance_daily_gap_v1.guard_approval() OWNER TO daily_capability_reviewer;';
 sql=once(sql,firstTransfer,revoke+'\n'+execute+'\n'+firstTransfer,'pre-transfer function ACL');
 const schemaTransfer='ALTER SCHEMA finance_daily_gap_v1 OWNER TO daily_capability_reviewer;';
 sql=once(sql,schemaTransfer,'REVOKE CREATE ON SCHEMA finance_daily_gap_v1 FROM daily_capability_owner;\n'+schemaTransfer+`\nDO $managed_gap_database_cleanup$ BEGIN EXECUTE format('REVOKE CREATE ON DATABASE %I FROM daily_capability_reviewer',current_database());END $managed_gap_database_cleanup$;`,'temporary CREATE retirement');
 const installedCleanup=`SET LOCAL ROLE daily_capability_reviewer;\nREVOKE EXECUTE ON FUNCTION finance_daily_v1.guard_reviewed_material() FROM ${ident(management.name)};\nREVOKE USAGE ON SCHEMA finance_daily_v1 FROM ${ident(management.name)};\nRESET ROLE;\n`+cleanupOwners(',daily_gap_invoker')+`\nDO $managed_gap_final$ BEGIN
 IF ${gapBootstrapOnly(management.name)} THEN RAISE EXCEPTION 'Only exact bootstrap gap administration may remain';END IF;
 IF pg_has_role(current_user,'daily_gap_invoker','SET') OR pg_has_role(current_user,'daily_gap_invoker','USAGE') OR has_schema_privilege('daily_capability_owner','finance_daily_gap_v1','CREATE') OR has_database_privilege('daily_capability_reviewer',current_database(),'CREATE') OR has_schema_privilege(current_user,'finance_daily_v1','USAGE') OR COALESCE(has_function_privilege(current_user,(SELECT f.oid FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace WHERE n.nspname='finance_daily_v1' AND f.proname='guard_reviewed_material' AND f.pronargs=0),'EXECUTE'),true) THEN RAISE EXCEPTION 'Temporary bridge installation access remains';END IF;
END $managed_gap_final$;`;
 sql=once(sql,'COMMIT;',installedCleanup+'\nCOMMIT;','installation commit');

 let retirementSql=base.retirementSql;
 retirementSql=once(retirementSql,'BEGIN;','BEGIN;\n'+managerGuard(management)+'\n'+temporaryOwners+'\nSET LOCAL ROLE daily_capability_owner;','retirement authority');
 const membershipGuard="IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=(SELECT oid FROM pg_roles WHERE rolname='daily_gap_invoker')) THEN RAISE EXCEPTION 'Revoke separately approved gap login membership before retirement';END IF;";
 retirementSql=once(retirementSql,membershipGuard,`IF ${gapBootstrapOnly(management.name)} THEN RAISE EXCEPTION 'Retirement requires only exact bootstrap gap administration; revoke separate runtime membership first';END IF;`,'bootstrap membership retirement');
 retirementSql=once(retirementSql,'DROP TRIGGER gap_fixed ON finance_daily_gap_v1.approval;','SET LOCAL ROLE daily_capability_reviewer;\nDROP TRIGGER gap_fixed ON finance_daily_gap_v1.approval;','reviewer-owned retirement');
 retirementSql=once(retirementSql,'DROP ROLE daily_gap_invoker;','RESET ROLE;\n'+cleanupOwners()+'\nDROP ROLE daily_gap_invoker;','role retirement');
 return {...base,status:'private-managed-fixed-gap-proposal-only',managementRole:management,sql,sqlSha256:sha(sql),retirementSql,retirementSha256:sha(retirementSql),unadaptedSqlSha256:base.sqlSha256,unadaptedRetirementSha256:base.retirementSha256,
  limitations:[...base.limitations,'Managed adaptation changes installation/retirement choreography only; the ordinary capability source and derived finite financial functions remain unchanged.','Only the pinned trusted non-superuser management session may install/retire. Temporary SET/CREATE are removed; no INHERIT grant is added.','The unremovable bootstrap ADMIN-only gap-role membership is permitted solely for its declared installer, then removed by DROP ROLE; any separate runtime membership blocks retirement.','All generated authority remains disabled/unapplied and requires a new exact financial milestone approval.']};
}
