import {randomBytes,pbkdf2Sync,createHmac,createHash} from 'node:crypto';
/** Returns credential-bearing SQL; keep it private, never log or commit it. */
export function buildIntakeLoginSql({projectRef,password}){
 if(projectRef!=='bioalckltvkhlczusdvl'||typeof password!=='string'||!/^[A-Za-z0-9_-]{48,128}$/.test(password))throw new Error('Invalid staging intake configuration');
 const salt=randomBytes(16),key=pbkdf2Sync(password,salt,4096,32,'sha256');
 const stored=createHash('sha256').update(createHmac('sha256',key).update('Client Key').digest()).digest('base64');
 const server=createHmac('sha256',key).update('Server Key').digest('base64');
 const verifier=`SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
 return `BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_intake_login') OR
 NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_intake_service' AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) OR
 EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='night_scout_intake_service')) OR
 to_regprocedure('ingest_v1.lock_intake_store(uuid)') IS NULL OR
 NOT EXISTS(SELECT 1 FROM public.stores WHERE id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' AND shopify_domain='pocketlaunchpad1.myshopify.com' AND shopify_store_id='95601983836' AND currency_code='GBP' AND timezone='Europe/London')
 THEN RAISE EXCEPTION 'Unexpected intake baseline'; END IF;
END $guard$;
CREATE ROLE night_scout_intake_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2 PASSWORD '${verifier}';
GRANT night_scout_intake_service TO night_scout_intake_login;
ALTER ROLE night_scout_intake_login SET statement_timeout='30s';
ALTER ROLE night_scout_intake_login SET lock_timeout='5s';
ALTER ROLE night_scout_intake_login SET idle_in_transaction_session_timeout='30s';
COMMIT;
`;
}
