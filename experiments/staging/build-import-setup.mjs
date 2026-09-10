import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export function buildImportSetup(){
 const guard=`-- STAGING ONLY: manually confirm project bioalckltvkhlczusdvl.
-- Installs a non-login role and empty receipt table; no importer is enabled.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF to_regclass('ingest_v1.review_audit') IS NULL OR to_regprocedure('ingest_v1.lock_review_dependencies()') IS NULL THEN RAISE EXCEPTION 'Review baseline missing'; END IF;
 IF to_regclass('ingest_v1.import_receipts') IS NOT NULL OR to_regprocedure('ingest_v1.lock_import_dependencies()') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('night_scout_import_service','night_scout_import_login')) THEN RAISE EXCEPTION 'Importer objects already exist'; END IF;
 IF (SELECT count(*) FROM public.stores)<>2 OR (SELECT count(*) FROM public.stores WHERE id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002'))<>2 THEN RAISE EXCEPTION 'Unexpected staging stores'; END IF;
END $guard$;
`;
 return guard+['ingest_v1_import_service.sql','ingest_v1_import_receipts.sql'].map(name=>{
 const s=readFileSync(new URL('../../db-migrations/proposed/'+name,import.meta.url),'utf8');
 if(!s.includes('\nBEGIN;\n')||!s.trimEnd().endsWith('COMMIT;'))throw new Error('Unexpected SQL wrapper');
 return '\n-- Source: '+name+'\n'+s.replace('\nBEGIN;\n','\n').replace(/COMMIT;\s*$/,'');
 }).join('\n')+'\nCOMMIT;\n';
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))writeFileSync(new URL('../../db-migrations/staging/20260910_import_setup.sql',import.meta.url),buildImportSetup());
