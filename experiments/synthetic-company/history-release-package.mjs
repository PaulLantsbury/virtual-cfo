/** Offline private SQL preparation. No network, remote driver, apply command or grants. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createHistoryRehearsal,importHistory,HISTORY_TABLES} from './history-rehearsal.mjs';
import {STAGING_TABLES,STAGING_SIDE_EFFECT_TABLES} from './staging-rehearsal.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
import {HISTORY_EDITION,historyToday} from './history-context.mjs';
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const ensure=(v,m)=>{if(!v)throw Error(m);};
const hash=v=>createHash('sha256').update(v).digest('hex');
export const HISTORY_PROTECTED_TABLES=Object.freeze([...STAGING_TABLES,...STAGING_SIDE_EFFECT_TABLES,'finance_v1.reporting_snapshots','finance_v1.reporting_snapshot_invalidations']);
const protectedExpression=`jsonb_build_object(${HISTORY_PROTECTED_TABLES.map(t=>`${lit(t)},(SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]'),'UTF8')),'hex') FROM ${t} t)`).join(',')})`;
/** Contains aggregate hashes only; callers keep the returned binding private. */
export const historyProtectedQuery=`SELECT ${protectedExpression} AS fingerprints`;
export const historyReleasePreflightQuery=`SELECT jsonb_build_object('historyAbsent',NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='finance_history_v2'),'protected',${protectedExpression},'identity',(SELECT jsonb_build_object('id',id,'name',name,'domain',shopify_domain,'external',shopify_store_id,'currency',currency_code,'timezone',timezone) FROM public.stores WHERE id=${lit(identity.storeId)}::uuid)) AS preflight`;

export function historyReleaseGuards({reviewerId,preflight}){
 ensure(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reviewerId||''),'Private verified reviewer binding required');
 ensure(preflight?.historyAbsent===true&&preflight.identity?.id===identity.storeId&&preflight.identity?.name===identity.name&&preflight.identity?.domain===identity.domain&&preflight.identity?.external===identity.externalId&&preflight.identity?.currency==='GBP'&&preflight.identity?.timezone==='Europe/London','Exact occupied synthetic company and absent history schema required');
 ensure(HISTORY_PROTECTED_TABLES.every(t=>/^[0-9a-f]{64}$/.test(preflight.protected?.[t]||'')),'Complete protected relation fingerprints required');
 const before=`DO $history_preflight$ BEGIN IF (${historyReleasePreflightQuery.replace(/^SELECT /,'').replace(/ AS preflight$/,'')}) IS DISTINCT FROM ${lit(JSON.stringify(preflight))}::jsonb THEN RAISE EXCEPTION 'History target or protected data changed; inspect before retry'; END IF; IF NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE store_id=${lit(identity.storeId)}::uuid AND user_id=${lit(reviewerId)}::uuid) THEN RAISE EXCEPTION 'Existing approved membership required'; END IF; END $history_preflight$;`;
 const after=`DO $history_preservation$ BEGIN IF ${protectedExpression} IS DISTINCT FROM ${lit(JSON.stringify(preflight.protected))}::jsonb THEN RAISE EXCEPTION 'Protected January or unrelated data changed'; END IF; END $history_preservation$;`;
 return {before,after};
}

/** Finite initial history only. Daily operation and correction publication have separate APIs. */
export async function prepareHistoryRelease({reviewerId,preflight,from='2024-11-01',asOf='2026-11-05',observedAt,now=()=>new Date()}={}){
 const guards=historyReleaseGuards({reviewerId,preflight}),clock=now();
 ensure(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt))&&Date.parse(observedAt)<=+clock&&historyToday(new Date(observedAt))>=asOf,'Truthful completed-horizon observation required');
 const handle=await createHistoryRehearsal({reviewerId,now:()=>new Date(observedAt)});
 try{
  await importHistory(handle,{from,asOf});
  const schemas=await Promise.all(['history-schema.sql','history-correction-schema.sql'].map(file=>readFile(new URL(file,import.meta.url),'utf8')));
  const chunks=[`BEGIN;\nSET LOCAL TRANSACTION ISOLATION LEVEL SERIALIZABLE;\nSET LOCAL lock_timeout='5s';\nSELECT pg_advisory_xact_lock(hashtextextended(${lit('history-v2:'+identity.storeId)},0));\n`,guards.before,'\n',...schemas.map(schema=>schema.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'')),'\n'];
  const counts={},tableHashes={};
  const primary={contracts:'store_id',events:'source_id',orders:'source_id',refunds:'source_id',lines:'source_id',returns:'source_id',coverage:'coverage_id',seals:'snapshot_id',invalidations:'snapshot_id',runs:'run_id'};
  // This package exports only the initial, uncorrected history. Review schemas explicitly before adding tables.
  for(const table of HISTORY_TABLES){
   ensure(/^[a-z_]+$/.test(table),'Unexpected history relation');
   counts[table]=Number((await handle.db.query(`SELECT count(*) n FROM finance_history_v2.${table}`)).rows[0].n);
   const key=primary[table];ensure(key,'Unreviewed history export relation');let cursor=null,exported=0;
   for(;;){
    const rows=(await handle.db.query(`SELECT to_jsonb(t) body FROM finance_history_v2.${table} t ${cursor?'WHERE '+key+' > $1':''} ORDER BY ${key} LIMIT 250`,cursor?[cursor]:[])).rows.map(r=>r.body);
    if(!rows.length)break;
    const columns=Object.keys(rows[0]).sort();
    chunks.push(`INSERT INTO finance_history_v2.${table} (${columns.join(',')}) SELECT ${columns.join(',')} FROM jsonb_populate_recordset(NULL::finance_history_v2.${table},${lit(JSON.stringify(rows))}::jsonb);\n`);
    exported+=rows.length;cursor=rows.at(-1)[key];
   }
   ensure(exported===counts[table],'History export count changed');
   tableHashes[table]=(await handle.db.query(`SELECT encode(sha256(convert_to(COALESCE(string_agg(encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'),'|' ORDER BY ${key}::text COLLATE "C"),''),'UTF8')),'hex') hash FROM finance_history_v2.${table} t`)).rows[0].hash;
  }
  const countChecks=Object.entries(counts).map(([table,count])=>`IF (SELECT count(*) FROM finance_history_v2.${table})<>${count} THEN RAISE EXCEPTION 'History ${table} count differs'; END IF;`).join(' ');
  chunks.push(guards.after,`\nDO $history_postflight$ BEGIN ${countChecks} IF has_schema_privilege('anon','finance_history_v2','USAGE') OR has_schema_privilege('authenticated','finance_history_v2','USAGE') THEN RAISE EXCEPTION 'Browser history access must remain denied'; END IF; END $history_postflight$;\n`);
  const body=chunks.join(''),rollbackSql=body+'ROLLBACK;\n',commitSql=body+'COMMIT;\n';
  return {status:'private-review-only',remoteApplied:false,edition:HISTORY_EDITION,from,asOf,observedAt,counts,tableHashes,commitHash:hash(commitSql),rollbackHash:hash(rollbackSql),commitSql,rollbackSql,limitations:['No hosted role grants, execution helper, daily schedule or provider action.','Exact private artifact approval and actual server-role/readback acceptance required.','A target/preflight mismatch is not safe to retry by editing its expected hash.','Correction version publication is excluded from this initial history artifact.']};
 }finally{await handle.db.close();}
}
