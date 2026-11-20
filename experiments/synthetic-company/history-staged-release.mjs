/** Offline, bounded private staging parcels. No connection, automatic retry, grants or execution. */
import {createHash} from 'node:crypto';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const ensure=(v,m)=>{if(!v)throw Error(m);};
const requestBytes=sql=>Buffer.byteLength(JSON.stringify({query:sql}));
const keys={contracts:'store_id',events:'source_id',orders:'source_id',refunds:'source_id',lines:'source_id',returns:'source_id',coverage:'coverage_id',seals:'snapshot_id',invalidations:'snapshot_id',runs:'run_id'};
const sources=new Set(['events','orders','refunds','lines','returns']);
const correctionTables=['correction_proposals','correction_reviews','correction_overlays','correction_versions','correction_selections','version_heads','correction_receipts'];
export function prepareHistoryStagedRelease(artifact,{maxChunkBytes=1200000}={}){
 ensure(artifact?.status==='private-review-only'&&artifact.commitHash===hash(artifact.commitSql)&&artifact.tableHashes,'Exact reviewed finite history artifact required');
 ensure(Object.keys(artifact.tableHashes).sort().join(',')===Object.keys(keys).sort().join(',')&&Object.keys(artifact.counts).sort().join(',')===Object.keys(keys).sort().join(',')&&Object.values(artifact.counts).every(v=>Number.isSafeInteger(v)&&v>=0),'Exact ten-table history manifest required');
 ensure(Number.isSafeInteger(maxChunkBytes)&&maxChunkBytes>=16000&&maxChunkBytes<=1500000,'Explicit bounded chunk size required');
 const lines=artifact.commitSql.split('\n'),insertLines=lines.filter(l=>l.startsWith('INSERT INTO finance_history_v2.'));
 ensure(insertLines.length,'History insert statements required');
 const parsed=insertLines.map(line=>{
  const m=line.match(/^INSERT INTO finance_history_v2\.([a-z_]+) \(([a-z_,]+)\) SELECT \2 FROM jsonb_populate_recordset\(NULL::finance_history_v2\.\1,'(.*)'::jsonb\);$/);
  ensure(m&&keys[m[1]],'Unreviewed history statement grammar');
  const rows=JSON.parse(m[3].replaceAll("''","'"));ensure(Array.isArray(rows)&&rows.length>0,'Nonempty immutable rows required');
  ensure(line===`INSERT INTO finance_history_v2.${m[1]} (${m[2]}) SELECT ${m[2]} FROM jsonb_populate_recordset(NULL::finance_history_v2.${m[1]},${lit(JSON.stringify(rows))}::jsonb);`,'Noncanonical SQL literal refused');
  return {table:m[1],columns:m[2],rows,line};
 });
 const releaseId=artifact.commitHash;
 const transactionStart=`BEGIN;\nSET LOCAL TRANSACTION ISOLATION LEVEL SERIALIZABLE;\nSET LOCAL lock_timeout='5s';\nSELECT pg_advisory_xact_lock(hashtextextended(${lit('history-v2:'+identity.storeId)},0));\nSELECT pg_advisory_xact_lock(hashtextextended(${lit('history-release:'+releaseId)},0));\n`;
 const guard=`IF NOT EXISTS(SELECT 1 FROM finance_history_v2.release_manifest WHERE release_id=${lit(releaseId)} AND NOT published) THEN RAISE EXCEPTION 'Exact unpublished history release required'; END IF;`;
 const parcels=[];let pending=[];
 const render=(blocks,index)=>{
  const payloadHash=hash(JSON.stringify(blocks.map(b=>({table:b.table,rows:b.rows}))));
  const declarations=blocks.map((b,i)=>`d${i} jsonb := ${lit(JSON.stringify(b.rows))}::jsonb;`).join('\n');
  const writes=blocks.map((b,i)=>`INSERT INTO finance_history_v2.${b.table} (${b.columns}) SELECT ${b.columns} FROM jsonb_populate_recordset(NULL::finance_history_v2.${b.table},d${i}) ON CONFLICT DO NOTHING;
IF EXISTS(SELECT 1 FROM jsonb_populate_recordset(NULL::finance_history_v2.${b.table},d${i}) e LEFT JOIN finance_history_v2.${b.table} a ON a.${keys[b.table]}=e.${keys[b.table]} AND a.store_id=e.store_id WHERE to_jsonb(a) IS DISTINCT FROM to_jsonb(e)) THEN RAISE EXCEPTION 'Immutable staged history source differs'; END IF;`).join('\n');
  return {index,payloadHash,rows:blocks.reduce((s,b)=>s+b.rows.length,0),sql:`-- Private immutable history parcel\n${transactionStart}DO $history_parcel$ DECLARE ${declarations} BEGIN ${guard}
IF EXISTS(SELECT 1 FROM finance_history_v2.release_chunks WHERE chunk_index=${index} AND payload_hash<>${lit(payloadHash)}) THEN RAISE EXCEPTION 'Changed release parcel refused'; END IF;
${writes}
INSERT INTO finance_history_v2.release_chunks VALUES(${index},${lit(payloadHash)}) ON CONFLICT DO NOTHING;
END $history_parcel$;\nCOMMIT;\n`};
 };
 const flush=()=>{if(pending.length){parcels.push(render(pending,parcels.length));pending=[];}};
 for(const block of parsed.filter(b=>sources.has(b.table))){
  const trial=render([...pending,block],parcels.length);
  if(requestBytes(trial.sql)>maxChunkBytes&&pending.length)flush();
  ensure(requestBytes(render([block],parcels.length).sql)<=maxChunkBytes,'A source block exceeds the reviewed parcel bound');pending.push(block);
 }flush();
 const prefix=artifact.commitSql.slice(0,artifact.commitSql.indexOf(insertLines[0]));
 const initSql=prefix+`CREATE TABLE finance_history_v2.release_manifest(release_id text PRIMARY KEY,published boolean NOT NULL DEFAULT false);
CREATE TABLE finance_history_v2.release_chunks(chunk_index integer PRIMARY KEY,payload_hash text NOT NULL);
ALTER TABLE finance_history_v2.release_manifest ENABLE ROW LEVEL SECURITY; ALTER TABLE finance_history_v2.release_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON finance_history_v2.release_manifest,finance_history_v2.release_chunks FROM PUBLIC;
CREATE TRIGGER history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_history_v2.release_chunks FOR EACH STATEMENT EXECUTE FUNCTION finance_history_v2.reject_change();
INSERT INTO finance_history_v2.release_manifest VALUES(${lit(releaseId)},false);\nCOMMIT;\n`;
 const expected=JSON.stringify(parcels.map(p=>({chunk_index:p.index,payload_hash:p.payloadHash})));
 const exactParcels=`IF (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY chunk_index),'[]'::jsonb) FROM finance_history_v2.release_chunks c) IS DISTINCT FROM ${lit(expected)}::jsonb THEN RAISE EXCEPTION 'History parcels incomplete or changed'; END IF;`;
 const fullHashes=Object.entries(artifact.tableHashes).map(([table,expectedHash])=>{
  ensure(keys[table]&&/^[0-9a-f]{64}$/.test(expectedHash),'Reviewed table fingerprints required');
  return `IF (SELECT count(*) FROM finance_history_v2.${table})<>${artifact.counts[table]} OR (SELECT encode(sha256(convert_to(COALESCE(string_agg(encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'),'|' ORDER BY ${keys[table]}::text COLLATE "C"),''),'UTF8')),'hex') FROM finance_history_v2.${table} t)<>${lit(expectedHash)} THEN RAISE EXCEPTION 'Staged ${table} source fingerprint differs'; END IF;`;
 }).join('\n');
 const tail=artifact.commitSql.slice(artifact.commitSql.indexOf(insertLines.at(-1))+insertLines.at(-1).length).replace(/COMMIT;\s*$/,'');
 const emptyCorrections=correctionTables.map(t=>`IF EXISTS(SELECT 1 FROM finance_history_v2.${t}) THEN RAISE EXCEPTION 'Initial history must remain uncorrected'; END IF;`).join('\n');
 const publishSql=`${transactionStart}DO $history_publication$ BEGIN ${guard} ${exactParcels} ${emptyCorrections} END $history_publication$;\n${parsed.filter(b=>!sources.has(b.table)).map(b=>b.line).join('\n')}\nDO $history_hashes$ BEGIN ${fullHashes} END $history_hashes$;\n${tail}\nUPDATE finance_history_v2.release_manifest SET published=true WHERE release_id=${lit(releaseId)} AND NOT published;\nCOMMIT;\n`;
 const actualHashes=Object.keys(keys).map(table=>`${lit(table)},(SELECT encode(sha256(convert_to(COALESCE(string_agg(encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'),'|' ORDER BY ${keys[table]}::text COLLATE "C"),''),'UTF8')),'hex') FROM finance_history_v2.${table} t)`).join(',');
 const existsSql="BEGIN READ ONLY; SELECT to_regclass('finance_history_v2.release_manifest') IS NOT NULL AS release_initialised; COMMIT;";
 const inspectSql=`BEGIN READ ONLY; SELECT m.release_id,m.published,(SELECT count(*) FROM finance_history_v2.release_chunks) AS committed_parcels,(SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY chunk_index),'[]'::jsonb) FROM finance_history_v2.release_chunks c) AS parcel_receipts,jsonb_build_object(${actualHashes}) AS actual_table_hashes,${lit(JSON.stringify(artifact.tableHashes))}::jsonb AS expected_table_hashes FROM finance_history_v2.release_manifest m WHERE m.release_id=${lit(releaseId)}; COMMIT;`;
 ensure(requestBytes(initSql)<=maxChunkBytes&&requestBytes(publishSql)<=maxChunkBytes,'Publication control exceeds parcel bound');
 return {status:'private-staged-proposal-only',releaseId,remoteApplied:false,initSql,parcels,publishSql,existsSql,inspectSql,initHash:hash(initSql),publishHash:hash(publishSql),limitations:['No financial contracts, coverage or seals are published until final all-parcel/full-row fingerprint checks commit.','No server grants or recurring job are included; staged rows remain private.','After unknown initialisation, run existsSql first; only inspect the ledger if it exists. An absent ledger does not authorise overwriting another occupied schema.','Inspect exact durable parcel receipts and actual/expected row hashes after uncertain outcomes before explicitly replaying a parcel.','Initialisation is not blindly replayable; an occupied namespace requires inspection.','Actual multi-backend writer contention and hosted execution remain unverified.']};
}
