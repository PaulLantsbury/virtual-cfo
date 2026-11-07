import {readFileSync,writeFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {restoreObservedPublic} from '../migration-baseline/restore.mjs';
const db=new PGlite();
const statements=[];
try{
 await restoreObservedPublic({exec:async sql=>{
  const result=await db.exec(sql);
  // Real Supabase already owns these roles. Record only successful statements,
  // preserving the dependency ordering validated by the disposable restoration.
  if(!sql.startsWith('CREATE ROLE '))statements.push(sql.replace(/;\s*$/,'')+';');
  return result;
 }});
}finally{await db.close();}
const proposal=name=>readFileSync(new URL('../../db-migrations/proposed/'+name,import.meta.url),'utf8').replace(/^BEGIN;\r?\n/m,'').replace(/^COMMIT;\s*$/m,'');
const sql=`-- Night Scout Staging bootstrap, prepared 9 September 2026.
-- Intended target: bioalckltvkhlczusdvl ONLY. Verify the dashboard project first.
-- Recreates observed public structure and hardens access in ONE transaction.
-- No business rows, users, passwords, memberships or old migration ledger copied.
-- Never run on the existing futkktdebdygsdrcknpr project.
BEGIN;
DO $empty$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v','m','S','f','p'))
 OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace) THEN
  RAISE EXCEPTION 'Bootstrap requires an empty public schema; nothing was replaced';
 END IF;
 IF to_regprocedure('auth.uid()') IS NULL OR to_regclass('auth.users') IS NULL THEN
  RAISE EXCEPTION 'Supabase Auth must already exist';
 END IF;
END;
$empty$;
${statements.join('\n\n')}

${proposal('20260908000001_recoverable_contribution_monthly_only.sql')}

${proposal('20260908000002_store_membership_read_access.sql')}

-- An authenticated client must not create objects in the public search path.
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
COMMIT;
`;
writeFileSync(new URL('../../db-migrations/staging/20260909_bootstrap.sql',import.meta.url),sql);
console.log('Generated atomic staging bootstrap without copying records.');
