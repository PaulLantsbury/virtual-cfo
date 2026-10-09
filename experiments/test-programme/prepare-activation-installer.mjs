import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Self-contained atomic operator SQL. No passwords, credentials or live tenant IDs.
export function activationInstallerSql(){
 const ledger=readFileSync(new URL('./provider-ledger-proposal.sql',import.meta.url),'utf8');
 const access=readFileSync(new URL('./provider-access-proposal.sql',import.meta.url),'utf8');
 const bootstrap=readFileSync(new URL('./provider-oauth-bootstrap-proposal.sql',import.meta.url),'utf8');
 return `-- NIGHT SCOUT STAGING ONLY. Creates an isolated disabled writer capability.
-- No programme rows, provider credentials or source writes are installed here.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL night_scout.approved_project='bioalckltvkhlczusdvl';
DO $guard$ BEGIN
 IF current_setting('night_scout.approved_project',true)<>'bioalckltvkhlczusdvl' THEN RAISE EXCEPTION 'Wrong staging project'; END IF;
 IF current_setting('server_version_num')::integer<170000 THEN RAISE EXCEPTION 'PostgreSQL17 or newer required'; END IF;
 IF to_regnamespace('staging_test_programme') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service')) THEN RAISE EXCEPTION 'Writer installation target occupied; inspect before retry'; END IF;
 IF current_user IN ('night_scout_test_writer','night_scout_test_writer_service') THEN RAISE EXCEPTION 'Operator installation required'; END IF;
 IF to_regclass('public.store_memberships') IS NULL OR (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.store_memberships') AND attname IN ('user_id','store_id') AND atttypid='uuid'::regtype AND NOT attisdropped)<>2 THEN RAISE EXCEPTION 'Existing membership boundary required'; END IF;
END $guard$;
${ledger}
${access}
${bootstrap}
CREATE ROLE night_scout_test_writer LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3;
GRANT night_scout_test_writer_service TO night_scout_test_writer WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
REVOKE ALL ON SCHEMA staging_test_programme FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM PUBLIC,night_scout_test_writer,night_scout_test_writer_service;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA staging_test_programme FROM PUBLIC,night_scout_test_writer;
DO $browser$ DECLARE r text; BEGIN
 FOR r IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated') LOOP
 EXECUTE format('REVOKE ALL ON SCHEMA staging_test_programme FROM %I',r);
 EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM %I',r);
 EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA staging_test_programme FROM %I',r);
 END LOOP;
END $browser$;
DO $check$ BEGIN
 IF (SELECT count(*) FROM staging_test_programme.programmes)<>0 OR (SELECT count(*) FROM staging_test_programme.actions)<>0 OR (SELECT count(*) FROM staging_test_programme.writer_envelopes)<>0 OR (SELECT count(*) FROM staging_test_programme.writer_oauth_states)<>0 THEN RAISE EXCEPTION 'Unexpected writer data'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service') AND (rolsuper OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'Unsafe writer role'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='night_scout_test_writer' AND rolcanlogin AND rolconnlimit=3) OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='night_scout_test_writer_service' AND NOT rolcanlogin) THEN RAISE EXCEPTION 'Unsafe writer login capability'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname IN ('night_scout_test_writer','night_scout_test_writer_service'))<>1 THEN RAISE EXCEPTION 'Unexpected writer membership'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname='night_scout_test_writer' AND (m.admin_option OR m.inherit_option OR NOT m.set_option)) THEN RAISE EXCEPTION 'Unsafe writer membership'; END IF;
END $check$;
COMMIT;
SELECT 'writer_schema_installed_disabled' AS state, 0 AS enabled_programmes;
`;
}

// Private bindings supplied only after fresh provider evidence, never guessed.
export function disabledProgrammeRowsSql({shopifyVerifiedDevelopment,xeroVerifiedDemo,xeroTenant}){
 if(shopifyVerifiedDevelopment!==true || xeroVerifiedDemo!==true || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(xeroTenant))throw new Error('Verified provider targets required');
 return `BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='15s';
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM staging_test_programme.programmes WHERE programme_key IN ('shopify-staging-20261012','xero-staging-20261012') AND (enabled OR stopped OR action_cap<>6 OR starts_at<>'2026-10-12T00:00:00Z'::timestamptz OR ends_at<>'2026-10-26T00:00:00Z'::timestamptz OR programme_key='shopify-staging-20261012' AND (provider<>'shopify' OR target<>'pocketlaunchpad1.myshopify.com') OR programme_key='xero-staging-20261012' AND (provider<>'xero' OR target<>'${xeroTenant}'))) OR EXISTS(SELECT 1 FROM staging_test_programme.actions WHERE programme_key IN ('shopify-staging-20261012','xero-staging-20261012')) THEN RAISE EXCEPTION 'Programme target occupied or incompatible'; END IF;
END $guard$;
INSERT INTO staging_test_programme.programmes(programme_key,provider,project_ref,target,starts_at,ends_at,action_cap,enabled,stopped) VALUES
('shopify-staging-20261012','shopify','bioalckltvkhlczusdvl','pocketlaunchpad1.myshopify.com','2026-10-12T00:00:00Z','2026-10-26T00:00:00Z',6,false,false),
('xero-staging-20261012','xero','bioalckltvkhlczusdvl','${xeroTenant}','2026-10-12T00:00:00Z','2026-10-26T00:00:00Z',6,false,false)
ON CONFLICT(programme_key) DO NOTHING;
COMMIT;
SELECT count(*) AS disabled_programmes FROM staging_test_programme.programmes WHERE programme_key IN ('shopify-staging-20261012','xero-staging-20261012') AND NOT enabled;
`;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(activationInstallerSql());
