import {validDemoReaderIdentity} from './demo-database-identity.mjs';
export {validDemoReaderIdentity} from './demo-database-identity.mjs';
const fail=()=>Error('Demo reader database unavailable');
const allowed=new Set([
 'SELECT * FROM xero_demo_v1.worker_get_single_connection_preflight_job()',
 'SELECT * FROM xero_demo_v1.worker_get_single_refresh_job($1,$2,$3,$4)',
 'SELECT * FROM xero_demo_v1.worker_get_refresh_context($1,$2)',
 'SELECT xero_demo_v1.worker_acquire_refresh_lease($1,$2,$3) AS lease_expires_at',
 'SELECT xero_demo_v1.worker_release_refresh_lease($1,$2,$3) AS released',
 'SELECT xero_demo_v1.worker_store_refresh_envelope_leased($1,$2,$3,$4,$5,$6,$7,$8) AS rotated',
 'SELECT xero_demo_v1.worker_record_connection_preflight($1,$2,$3,$4,$5,$6,$7,$8) AS recorded',
 'SELECT xero_demo_v1.worker_record_credential_refresh_failure($1,$2)',
 'SELECT xero_demo_v1.worker_record_accounting_evidence_leased($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) AS evidence_id',
 'SELECT * FROM xero_demo_v1.worker_get_latest_supported_evidence($1,$2,$3,$4,$5,$6)'
]);
const rolesSql="SELECT rolname,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolcanlogin,rolconnlimit,session_user::text AS session_login FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_demo_import_login','night_scout_demo_import_service')";
const membershipsSql="SELECT r.rolname AS role_name,u.rolname AS member_name,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname IN ('night_scout_demo_import_login','night_scout_demo_import_service')";
export function createDemoQueryPort(pool){if(typeof pool?.connect!=='function')throw fail();return async(sql,args=[])=>{
 if(!allowed.has(sql)||!Array.isArray(args))throw fail();let c;try{c=await pool.connect();}catch{throw fail();}
 try{await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='30s'");const roles=(await c.query(rolesSql)).rows,members=(await c.query(membershipsSql)).rows;if(!validDemoReaderIdentity(roles,members))throw fail();await c.query('SET LOCAL ROLE night_scout_demo_import_service');const result=await c.query(sql,args);await c.query('COMMIT');return result;}
 catch{await c.query('ROLLBACK').catch(()=>{});throw fail();}finally{c.release();}
};}
