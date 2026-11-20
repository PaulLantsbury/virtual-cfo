import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const files=['ingest_v1_candidate_batches.sql','ingest_v1_verified_invalidation.sql','ingest_v1_review_restoration.sql','ingest_v1_review_service.sql'];
export function buildReviewSetup(){
 const guard=`-- STAGING ONLY: confirm dashboard project bioalckltvkhlczusdvl before execution.
-- SQL cannot independently identify the selected Supabase project.
-- Additive schema/permission package; no credentials, reviewer grants or row imports.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
BEGIN
 IF to_regnamespace('ingest_v1') IS NOT NULL THEN RAISE EXCEPTION 'Intake schema already exists; do not replay'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('night_scout_review_service','night_scout_review_login')) THEN
  RAISE EXCEPTION 'Review roles already exist; inspect privileges before proceeding';
 END IF;
 IF to_regclass('finance_v1.coverage_evidence') IS NULL OR to_regprocedure('public.verified_sales_source(uuid,date,date)') IS NULL THEN
  RAISE EXCEPTION 'Verified finance baseline missing';
 END IF;
 IF (SELECT count(*) FROM public.stores)<>2 OR
    (SELECT count(*) FROM public.stores WHERE id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002'))<>2 THEN
  RAISE EXCEPTION 'Expected two synthetic staging stores only';
 END IF;
 IF (SELECT count(*) FROM public.orders)<>2 OR
    (SELECT count(*) FROM public.orders WHERE id IN ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002'))<>2 THEN
  RAISE EXCEPTION 'Unexpected order baseline';
 END IF;
END $guard$;
`;
 const body=files.map(name=>{
  const source=readFileSync(new URL('../../db-migrations/proposed/'+name,import.meta.url),'utf8');
  if(!source.includes('\nBEGIN;\n')||!source.trimEnd().endsWith('COMMIT;'))throw new Error('Unexpected transaction wrapper');
  return `\n-- Source: ${name}\n`+source.replace('\nBEGIN;\n','\n').replace(/COMMIT;\s*$/,'');
 }).join('\n');
 return guard+body+`\n-- No login, reviewer assignment or candidate data is created.\nCOMMIT;\n`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))writeFileSync(new URL('../../db-migrations/staging/20260910_review_setup.sql',import.meta.url),buildReviewSetup());
