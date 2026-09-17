import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {INTAKE_TARGET as target,intakeConnectionOptions} from './intake-runtime.mjs';
const failure='Candidate inspection unavailable; no write or retry was attempted. The previous intake outcome remains unconfirmed.';
export function parseInspectionArguments(args){
 if(args.length!==2||args[0]!=='--config'||!args[1]||args[1].startsWith('--'))throw Error('Usage: node experiments/shopify/inspect-development-intake.mjs --config <private-file>');
 return {configPath:args[1]};
}
export const inspectionQuery=`SELECT h.needs_recheck,b.id,b.fingerprint,b.mapping_state,b.superseded_at,
 b.payload->'source'->'settings' AS settings,
 b.payload->'mapped'->'coverageCertified' AS candidate_coverage,
 jsonb_array_length(b.payload->'source'->'orders') AS order_count,
 (SELECT COALESCE(sum(jsonb_array_length(o->'refunds')),0)::int FROM jsonb_array_elements(b.payload->'source'->'orders') o) AS refund_count,
 CASE WHEN b.payload->'mapped' ? 'events' THEN jsonb_array_length(b.payload->'mapped'->'events') ELSE NULL END AS event_count,
 (SELECT COALESCE(jsonb_agg(jsonb_build_object('reason',reason,'count',n)),'[]'::jsonb) FROM
 (SELECT CASE WHEN e->>'reason' IN ('TEST_ORDER','UNPAID_ORDER') THEN e->>'reason' ELSE 'OTHER' END reason,count(*)::int n
 FROM jsonb_array_elements(COALESCE(b.payload->'mapped'->'excluded','[]'::jsonb)) e GROUP BY 1) reasons) AS exclusions
 FROM ingest_v1.heads h JOIN ingest_v1.batches b ON b.id=h.batch_id AND b.store_id=h.store_id AND b.date_from=h.date_from AND b.date_to=h.date_to
 WHERE h.store_id=$1 AND h.date_from=$2 AND h.date_to=$3`;
const ensure=ok=>{if(!ok)throw Error(failure);};
/** Operator evidence only. A current candidate is never a verified financial result. */
export async function inspectDevelopmentIntake({configPath},{createPool}={}){
 let pool,client,discard=false;
 try{
 const file=await open(configPath,constants.O_RDONLY|constants.O_NOFOLLOW);let config;
 try{const stat=await file.stat();ensure(stat.isFile()&&(stat.mode&0o077)===0&&stat.uid===process.getuid()&&stat.size<=16384);config=JSON.parse(await file.readFile('utf8'));}finally{await file.close();}
 const options=intakeConnectionOptions(config),scope=options.scope;
 ensure((Date.parse(scope.to)-Date.parse(scope.from))/86400000<31);
 if(!createPool){const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));const {Pool}=require('pg');createPool=o=>new Pool(o);}
 pool=createPool(options.pool);client=await pool.connect();
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 await client.query('SET LOCAL ROLE night_scout_intake_service');
 const role=(await client.query(`SELECT current_user AS role,transaction_timestamp() AS observed_at,
 (SELECT rolname='night_scout_intake_login' AND rolcanlogin AND NOT (rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) FROM pg_roles WHERE rolname=session_user) AS safe_login,
 (SELECT NOT (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) FROM pg_roles WHERE rolname=current_user) AS safe_role`)).rows;
 ensure(role.length===1&&role[0].role==='night_scout_intake_service'&&role[0].safe_login===true&&role[0].safe_role===true);
 const observedAt=new Date(role[0].observed_at).toISOString();
 const stores=(await client.query('SELECT shopify_domain,shopify_store_id,currency_code,timezone FROM public.stores WHERE id=$1',[scope.storeId])).rows;
 ensure(stores.length===1&&stores[0].shopify_domain===target.domain&&stores[0].shopify_store_id==='95601983836'&&stores[0].currency_code.trim()===target.currency&&stores[0].timezone===target.timezone);
 const params=[scope.storeId,scope.from,scope.to];
 const counts=(await client.query('SELECT (SELECT count(*)::int FROM ingest_v1.batches WHERE store_id=$1 AND date_from=$2 AND date_to=$3) AS batches,(SELECT count(*)::int FROM ingest_v1.heads WHERE store_id=$1 AND date_from=$2 AND date_to=$3) AS heads',params)).rows[0];
 ensure(Number.isSafeInteger(counts?.batches)&&counts.batches>=0&&Number.isSafeInteger(counts?.heads)&&counts.heads>=0&&counts.heads<=1);
 const rows=(await client.query(inspectionQuery,params)).rows;
 ensure(rows.length===counts.heads);
 let details={status:'unavailable'};
 if(rows.length){
 const r=rows[0],s=r.settings;
 ensure(counts.batches>0&&/^[a-f0-9-]{36}$/i.test(r.id)&&/^[a-f0-9]{64}$/.test(r.fingerprint)&&['mapped_for_review','blocked'].includes(r.mapping_state)&&typeof r.needs_recheck==='boolean'&&r.superseded_at===null&&r.candidate_coverage===false);
 ensure([r.order_count,r.refund_count].every(n=>Number.isSafeInteger(n)&&n>=0)&&(r.event_count===null||(Number.isSafeInteger(r.event_count)&&r.event_count>=0))&&Array.isArray(r.exclusions));
 const exclusions=r.exclusions.map(e=>{ensure(['TEST_ORDER','UNPAID_ORDER','OTHER'].includes(e.reason)&&Number.isSafeInteger(e.count)&&e.count>=0);return {reason:e.reason,count:e.count};}).sort((a,b)=>a.reason.localeCompare(b.reason));
 const changed=!s||s.domain!==target.domain||s.shopId!==target.shopId||s.currency!==target.currency||s.timezone!==target.timezone;
 details={status:r.needs_recheck||changed?'needs_recheck':'current_unverified',batchId:r.id,fingerprint:r.fingerprint,mappingState:r.mapping_state,orderCount:r.order_count,refundCount:r.refund_count,mappedEventCount:r.event_count,exclusions};
 }
 await client.query('ROLLBACK');
 return {...details,observedAt,projectRef:target.projectRef,storeId:scope.storeId,from:scope.from,to:scope.to,retainedBatchCount:counts.batches,candidateWriteAttempted:false,coverageCertified:false,financialImportStatus:'not_assessed',reviewRequired:true};
 }catch{discard=true;try{await client?.query('ROLLBACK');}catch{}throw Error(failure);}
 finally{let cleanupFailed=false;try{client?.release(discard);}catch{cleanupFailed=true;}try{await pool?.end();}catch{cleanupFailed=true;}if(cleanupFailed)throw Error(failure);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{process.stdout.write(JSON.stringify(await inspectDevelopmentIntake(parseInspectionArguments(process.argv.slice(2))),null,2)+'\n');}
 catch{process.stderr.write(failure+'\n');process.exitCode=1;}
}
