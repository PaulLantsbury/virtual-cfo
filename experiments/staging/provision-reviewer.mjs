import {randomBytes,pbkdf2Sync,createHmac,createHash} from 'node:crypto';
/** Admin-only staging helper. Does not connect or save credentials. */
export function buildStagingReviewerSql({projectRef,storeId,reviewerId,password}){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(projectRef!=='bioalckltvkhlczusdvl'||!['90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002'].includes(storeId)||!uuid.test(reviewerId??'')||typeof password!=='string'||!/^[A-Za-z0-9_-]{48,128}$/.test(password))throw new Error('Invalid staging provisioning input');
 const salt=randomBytes(16),salted=pbkdf2Sync(password,salt,4096,32,'sha256');
 const client=createHmac('sha256',salted).update('Client Key').digest();
 const stored=createHash('sha256').update(client).digest('base64');
 const server=createHmac('sha256',salted).update('Server Key').digest('base64');
 const verifier=`SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
 // All interpolated fields have constrained alphabets; SQL contains no plaintext password.
 // Verify the ACTUAL dashboard/connection project separately before executing.
 return `SET LOCAL lock_timeout='5s';
LOCK TABLE public.store_memberships,ingest_v1.review_authorizations IN SHARE ROW EXCLUSIVE MODE;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE store_id='${storeId}' AND user_id='${reviewerId}') THEN RAISE EXCEPTION 'Missing membership'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_review_login') OR
 NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_review_service' AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) OR
 EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='night_scout_review_service'))
 THEN RAISE EXCEPTION 'Unexpected review roles'; END IF;
END $guard$;
CREATE ROLE night_scout_review_login NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3;
GRANT night_scout_review_service TO night_scout_review_login;
INSERT INTO ingest_v1.review_authorizations(store_id,reviewer_id) VALUES('${storeId}','${reviewerId}');
ALTER ROLE night_scout_review_login LOGIN PASSWORD '${verifier}';`;
}
export async function provisionStagingReviewer(database,input){
 const sql=buildStagingReviewerSql(input);
 try{return await database.transaction(async tx=>{await tx.query(sql);return {provisioned:true};});}
 catch{throw new Error('Staging provisioning failed; inspect database state before retrying');}
}
