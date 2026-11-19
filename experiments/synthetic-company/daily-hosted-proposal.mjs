/** Generate an unapplied staging adaptation; no database client or execution path. */
import {createHash} from 'node:crypto';
import {date} from './generator.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
import {GAP_CAPABILITY_SOURCE_SHA256} from './daily-gap-proposal.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const managementKeys=['name','login','superuser','bypassRls','replication','createRole','createDb','inherit'];
const coreRoles=['daily_capability_owner','daily_capability_invoker','daily_capability_reviewer'];
const literal=value=>"'"+value.replaceAll("'","''")+"'";
function managementPin(role){
 if(role===undefined)return null;
 if(!role||typeof role!=='object'||Array.isArray(role)||Reflect.ownKeys(role).length!==managementKeys.length||!managementKeys.every(key=>Object.hasOwn(role,key)))throw Error('Exact independently reviewed management role required');
 if(typeof role.name!=='string'||!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(role.name)||coreRoles.includes(role.name)||managementKeys.filter(k=>k!=='name').some(k=>typeof role[k]!=='boolean')||role.login!==true||role.superuser!==false||role.createRole!==true)throw Error('Explicit non-superuser CREATEROLE management identity required');
 return Object.fromEntries(managementKeys.map(key=>[key,role[key]]));
}
function replaceOnce(sql,old,value,label){if(sql.split(old).length!==2)throw Error('Exact '+label+' boundary required');return sql.replace(old,()=>value);}
/** managementRole is an independently reviewed private pin, never a normal reporting/runtime identity. */
export function prepareHostedDailyProposal({capabilitySql,expectedThrough,expectedSeals=24,managementRole}={}){
 if(typeof capabilitySql!=='string'||sha(capabilitySql)!==GAP_CAPABILITY_SOURCE_SHA256)throw Error('Exact independently reviewed capability source required');
 date(expectedThrough);
 if(expectedThrough<'2024-11-01'||!Number.isSafeInteger(expectedSeals)||expectedSeals<0||expectedSeals>120)throw Error('Exact bounded baseline expectation required');
 const managed=managementPin(managementRole);
 const marker='BEGIN;\nDO $$BEGIN';
 if(capabilitySql.split(marker).length!==2)throw Error('Exact installation boundary required');
 const guard=`BEGIN;
DO $hosted_preflight$ BEGIN
 IF current_setting('server_version_num')::int<170000 OR current_setting('server_version_num')::int>=180000 THEN RAISE EXCEPTION 'Reviewed PostgreSQL 17 target required';END IF;
 IF NOT EXISTS(SELECT 1 FROM finance_history_v2.contracts WHERE store_id='${identity.storeId}'::uuid AND profile='uk-gifts-v2' AND edition='synthetic-history-v2-2026-11' AND date_from='2024-11-01'::date AND through_day='${expectedThrough}'::date AND currency='GBP' AND timezone='Europe/London') THEN RAISE EXCEPTION 'Exact isolated staging contract/horizon required';END IF;
 IF (SELECT count(*) FROM finance_history_v2.seals WHERE store_id='${identity.storeId}'::uuid)<>${expectedSeals} THEN RAISE EXCEPTION 'Reviewed closed-month seal count differs';END IF;
 IF EXISTS(SELECT 1 FROM finance_history_v2.invalidations i JOIN finance_history_v2.seals s USING(snapshot_id) WHERE s.store_id='${identity.storeId}'::uuid) THEN RAISE EXCEPTION 'Invalidated prior evidence requires separate review';END IF;
END $hosted_preflight$;
DO $$BEGIN`;
 let sql=capabilitySql.slice(capabilitySql.indexOf('BEGIN;')).replace(marker,()=>guard);
 if(managed){
  const pin=literal(JSON.stringify(managed));
  const managedGuard=`DO $managed_installer$ DECLARE actual jsonb; BEGIN
 SELECT jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypassRls',rolbypassrls,'replication',rolreplication,'createRole',rolcreaterole,'createDb',rolcreatedb,'inherit',rolinherit) INTO actual FROM pg_roles WHERE rolname=current_user;
 IF current_user IS DISTINCT FROM ${literal(managed.name)} OR actual IS DISTINCT FROM ${pin}::jsonb THEN RAISE EXCEPTION 'Exact reviewed managed installer identity and attributes required';END IF;
END $managed_installer$;
SET LOCAL createrole_self_grant='set';`;
  sql=replaceOnce(sql,'END $hosted_preflight$;','END $hosted_preflight$;\n'+managedGuard,'managed installer guard');
  sql=replaceOnce(sql,'GRANT USAGE ON SCHEMA finance_daily_v1 TO daily_capability_owner,daily_capability_invoker;','GRANT USAGE ON SCHEMA finance_daily_v1 TO daily_capability_owner,daily_capability_invoker;\nGRANT CREATE ON SCHEMA finance_daily_v1 TO daily_capability_owner,daily_capability_reviewer;','temporary ownership transfer CREATE');
  const revoke='REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance_daily_v1 FROM PUBLIC;';
  const execute='GRANT EXECUTE ON FUNCTION finance_daily_v1.append_completed_day(date,date),finance_daily_v1.inspect_daily_receipt(date) TO daily_capability_invoker;';
  sql=replaceOnce(sql,revoke,'','original public function ACL');
  sql=replaceOnce(sql,execute,'','original invoker function ACL');
  const transfer='ALTER FUNCTION finance_daily_v1.validate_reviewed_day(date,jsonb) OWNER TO daily_capability_owner;';
  sql=replaceOnce(sql,transfer,revoke+'\n'+execute+'\n'+transfer,'pre-transfer function ACL');
  const schemaTransfer='ALTER SCHEMA finance_daily_v1 OWNER TO daily_capability_reviewer;';
  sql=replaceOnce(sql,schemaTransfer,'REVOKE CREATE ON SCHEMA finance_daily_v1 FROM daily_capability_owner;\n'+schemaTransfer,'temporary CREATE cleanup');
  const cleanup=`DO $managed_cleanup$ DECLARE role_name text; BEGIN
 -- Only the discretionary self-grants belong to this installer. PostgreSQL's separate
 -- bootstrap ADMIN-only grants are retained and must be explicitly pinned by preflight.
 EXECUTE format('REVOKE daily_capability_owner,daily_capability_invoker,daily_capability_reviewer FROM %I GRANTED BY %I',current_user,current_user);
 IF (SELECT count(*) FROM pg_auth_members a JOIN pg_roles p ON p.oid=a.roleid WHERE p.rolname=ANY(ARRAY['daily_capability_owner','daily_capability_invoker','daily_capability_reviewer']))<>3 OR EXISTS(SELECT 1 FROM pg_auth_members a JOIN pg_roles p ON p.oid=a.roleid JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor WHERE p.rolname=ANY(ARRAY['daily_capability_owner','daily_capability_invoker','daily_capability_reviewer']) AND (m.rolname<>current_user OR a.grantor<>10 OR NOT g.rolsuper OR NOT a.admin_option OR a.inherit_option OR a.set_option)) THEN RAISE EXCEPTION 'Exact bootstrap ADMIN-only management memberships required';END IF;
 FOREACH role_name IN ARRAY ARRAY['daily_capability_owner','daily_capability_invoker','daily_capability_reviewer'] LOOP
  IF pg_has_role(current_user,role_name,'SET') OR pg_has_role(current_user,role_name,'USAGE') THEN RAISE EXCEPTION 'Managed installer selectable or inherited authority remains';END IF;
 END LOOP;
 IF has_schema_privilege('daily_capability_owner','finance_daily_v1','CREATE') THEN RAISE EXCEPTION 'Temporary function-owner CREATE authority remains';END IF;
END $managed_cleanup$;`;
  sql=replaceOnce(sql,'COMMIT;',cleanup+'\nCOMMIT;','transactional management cleanup');
 }
 sql='-- UNAPPLIED STAGING INSTALLATION PROPOSAL. Explicit target/access approval required.\n-- Baseline fingerprints and all independently pinned metadata must also pass the private review.\n'+sql;
 return {status:'staging-installation-proposal-only',activationAllowed:false,remoteApplied:false,expectedThrough,expectedSeals,...(managed?{managementRole:managed}:{}),sourceSha256:GAP_CAPABILITY_SOURCE_SHA256,sql,sqlSha256:sha(sql)};
}
