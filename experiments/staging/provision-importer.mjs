import {randomBytes,pbkdf2Sync,createHmac,createHash} from 'node:crypto';
/** Returns credential-bearing SQL; keep it private, never log or commit it. */
export function buildImporterLoginSql({projectRef,password}){
 if(projectRef!=='bioalckltvkhlczusdvl'||typeof password!=='string'||!/^[A-Za-z0-9_-]{48,128}$/.test(password))throw new Error('Invalid staging importer configuration');
 const salt=randomBytes(16),key=pbkdf2Sync(password,salt,4096,32,'sha256');
 const stored=createHash('sha256').update(createHmac('sha256',key).update('Client Key').digest()).digest('base64');
 const server=createHmac('sha256',key).update('Server Key').digest('base64');
 const verifier=`SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
 return `BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_import_login') OR
 NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_import_service' AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) OR
 EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='night_scout_import_service')) OR
 to_regclass('ingest_v1.import_receipts') IS NULL
 THEN RAISE EXCEPTION 'Unexpected importer baseline'; END IF;
END $guard$;
CREATE ROLE night_scout_import_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 PASSWORD '${verifier}';
GRANT night_scout_import_service TO night_scout_import_login;
COMMIT;
`;
}
