/** Independent READ-ONLY operator check. No credentials, provider request, grants,
 * writer programme mutation or activation is performed. Exact account ID, never code/name.
 */
export const DEMO_READER_ACTIVATION_SQL=`WITH input AS (
 SELECT $1::uuid store_id,$2::uuid tenant_id,$3::uuid account_id,$4::date scope_from,$5::date scope_to
), connection AS (
 SELECT c.* FROM xero_demo_v1.connections c,input i
 WHERE i.store_id='f59e3a44-7106-4df8-9c08-52da30c9de30'::uuid
 AND c.store_id=i.store_id AND c.tenant_id=i.tenant_id::text AND c.retired_at IS NULL
), mapping AS (
 SELECT m.* FROM xero_demo_v1.mapping_versions m JOIN connection c ON c.id=m.connection_id
 WHERE m.effective_from<=current_date ORDER BY m.effective_from DESC,m.version DESC,m.id DESC LIMIT 1
), flags AS (
 SELECT (SELECT count(*) FROM connection)=1 AND (SELECT count(*) FROM xero_demo_v1.connections c,input i WHERE c.store_id=i.store_id AND c.retired_at IS NULL)=1 AS tenant_matches,
 clock_timestamp()>='2026-10-30T00:00:00Z'::timestamptz AND clock_timestamp()<'2026-11-06T03:00:00Z'::timestamptz AS intake_window_open,
 (SELECT i.scope_to=((clock_timestamp() AT TIME ZONE 'Europe/London')::date-1) AND i.scope_from=date_trunc('month',((clock_timestamp() AT TIME ZONE 'Europe/London')::date-1)::timestamp)::date FROM input i) AS scope_current,
 (SELECT m.version FROM mapping m) mapping_version,(SELECT m.effective_from::text FROM mapping m) mapping_effective_from,
 EXISTS(SELECT 1 FROM mapping m CROSS JOIN input i WHERE isfinite(i.scope_from) AND isfinite(i.scope_to) AND i.scope_from<=i.scope_to AND i.scope_to<current_date AND i.scope_to-i.scope_from<31 AND m.effective_from<=i.scope_from) AS mapping_covers_scope,
 EXISTS(SELECT 1 FROM mapping m JOIN connection c ON c.id=m.connection_id JOIN xero_demo_v1.accounting_evidence a ON a.connection_id=c.id AND a.mapping_version_id=m.id CROSS JOIN input i WHERE a.scope_from=i.scope_from AND a.scope_to=i.scope_to AND a.currency='GBP' AND a.closed_period=false AND a.state='supported' AND a.scope_from>=m.effective_from AND isfinite(a.retrieved_at) AND a.retrieved_at<=clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM xero_demo_v1.accounting_evidence newer WHERE newer.connection_id=c.id AND newer.mapping_version_id=m.id AND newer.scope_from=i.scope_from AND newer.scope_to=i.scope_to AND newer.currency='GBP' AND newer.closed_period=false AND (newer.state<>'supported' OR NOT isfinite(newer.retrieved_at) OR newer.retrieved_at>clock_timestamp()) AND newer.created_at>=a.created_at)) AS supported_scope_matches,
 EXISTS(SELECT 1 FROM mapping m JOIN connection c ON c.id=m.connection_id
 WHERE EXISTS(SELECT 1 FROM public.store_memberships sm WHERE sm.store_id=c.store_id AND sm.user_id=m.confirmed_by)
 AND (SELECT count(DISTINCT s.category) FROM xero_demo_v1.mapping_selections s WHERE s.mapping_version_id=m.id)=5
 AND NOT EXISTS(SELECT 1 FROM xero_demo_v1.mapping_audit a WHERE a.connection_id=c.id AND a.action='review_required' AND a.occurred_at>=m.confirmed_at)
 AND NOT EXISTS(SELECT 1 FROM (SELECT e.state,e.reason FROM xero_demo_v1.accounting_evidence e WHERE e.connection_id=c.id AND e.mapping_version_id=m.id ORDER BY e.created_at DESC,e.id DESC LIMIT 1) latest WHERE latest.state='invalidated' OR latest.reason='account_mapping_review_required')
 AND NOT EXISTS(SELECT 1 FROM xero_demo_v1.mapping_selections s LEFT JOIN xero_demo_v1.account_directories d ON d.connection_id=c.id AND d.retrieved_at=m.directory_retrieved_at AND d.account_id=s.account_id AND d.account_status='ACTIVE' WHERE s.mapping_version_id=m.id AND d.account_id IS NULL)) AS mapping_current,
 EXISTS(SELECT 1 FROM mapping m JOIN connection c ON c.id=m.connection_id JOIN xero_demo_v1.mapping_selections s ON s.mapping_version_id=m.id AND s.category='revenue' JOIN xero_demo_v1.account_directories d ON d.connection_id=c.id AND d.retrieved_at=m.directory_retrieved_at AND d.account_id=s.account_id CROSS JOIN input i WHERE s.account_id=i.account_id::text AND d.account_status='ACTIVE' AND d.account_type IN ('REVENUE','SALES')) AS account_in_revenue_mapping,
 EXISTS(SELECT 1 FROM connection c JOIN xero_demo_v1.credential_envelopes e ON e.connection_id=c.id WHERE e.lease_expires_at IS NULL OR e.lease_expires_at<=clock_timestamp()) AS reader_lease_idle,
 EXISTS(SELECT 1 FROM connection c JOIN xero_demo_v1.credential_envelopes e ON e.connection_id=c.id
 JOIN LATERAL(SELECT p.* FROM xero_demo_v1.connection_preflight_evidence p WHERE p.connection_id=c.id ORDER BY p.checked_at DESC,p.id DESC LIMIT 1) p ON true
 WHERE p.credential_version=e.version AND p.outcome='connected' AND p.phase='organisation' AND p.reason='ok' AND p.tenant_visible IS TRUE
 AND p.checked_at<=clock_timestamp() AND p.checked_at>=clock_timestamp()-interval '1 hour'
 AND NOT EXISTS(SELECT 1 FROM xero_demo_v1.connection_preflight_evidence tied WHERE tied.connection_id=c.id AND tied.checked_at=p.checked_at AND (tied.outcome<>'connected' OR tied.phase<>'organisation' OR tied.reason<>'ok' OR tied.tenant_visible IS DISTINCT FROM true))) AS reader_health_current
)
SELECT tenant_matches,intake_window_open,scope_current,mapping_version,mapping_effective_from,mapping_current,mapping_covers_scope,supported_scope_matches,account_in_revenue_mapping,reader_lease_idle,reader_health_current,
 tenant_matches AND intake_window_open AND scope_current AND mapping_current AND mapping_covers_scope AND supported_scope_matches AND account_in_revenue_mapping AND reader_lease_idle AND reader_health_current AS reader_gate_passed
FROM flags`;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const unavailable=()=>Error('Demo reader activation check unavailable; no activation or write was attempted.');
export async function checkDemoReaderForWriter(client,{storeId,tenantId,accountId,scopeFrom,scopeTo}={}){
 let started=false;
 try{
  const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  if(typeof client?.query!=='function'||storeId!=='f59e3a44-7106-4df8-9c08-52da30c9de30'||!uuid(tenantId)||!uuid(accountId)||!day(scopeFrom)||!day(scopeTo))throw unavailable();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');started=true;await client.query("SET LOCAL statement_timeout='5s'");
  const rows=(await client.query(DEMO_READER_ACTIVATION_SQL,[storeId,tenantId,accountId,scopeFrom,scopeTo])).rows;
  if(rows?.length!==1)throw unavailable();const r=rows[0];
  for(const field of ['tenant_matches','intake_window_open','scope_current','mapping_current','mapping_covers_scope','supported_scope_matches','account_in_revenue_mapping','reader_lease_idle','reader_health_current','reader_gate_passed'])if(typeof r[field]!=='boolean')throw unavailable();
  if(r.mapping_version!==null&&(!Number.isSafeInteger(r.mapping_version)||r.mapping_version<1))throw unavailable();
  await client.query('ROLLBACK');started=false;
  return Object.freeze({event:'demo_reader_activation_check',...r,readOnlyCheck:true,activationAuthorized:false,exactInvoiceLinkageVerified:false});
 }catch{if(started)try{await client.query('ROLLBACK');}catch{}throw unavailable();}
}
