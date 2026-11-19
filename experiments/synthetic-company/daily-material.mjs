/** Offline finite material compiler. No connection factory, filesystem, CLI or hosted binding. */
import {createHash} from 'node:crypto';
import {addDays,date} from './generator.mjs';
import {historySourceAsOf,HISTORY_EDITION,HISTORY_FORMULA} from './history-context.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
import {validateDailyProgramme,DAILY_PROGRAMME_PURPOSE,DAILY_PROGRAMME_SCOPE,DAILY_PROGRAMME_MAX_DAYS,DAILY_PROGRAMME_MAX_REVIEW_REF} from './daily-programme.mjs';

const ensure=(value,message)=>{if(!value)throw Error(message);};
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export const materialDigest=value=>createHash('sha256').update(canonical(value)).digest('hex');
const bytesDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceTables=['events','orders','refunds','lines','returns'];
const publicTables=['stores','store_memberships','orders','refunds','order_line_items','overhead_categories','overhead_entries'];
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const same=(a,b)=>canonical(a)===canonical(b);

export function reviewedMaterialRange({initialThrough,ceiling,reviewRef,expectedPrefixFingerprint,generatedAt}={}){
 date(initialThrough);date(ceiling);
 ensure(initialThrough>='2024-11-01'&&ceiling>initialThrough,'Finite later ceiling required');
 const firstDay=addDays(initialThrough,1),days=[];
 for(let day=firstDay;day<=ceiling;day=addDays(day,1)){days.push(day);ensure(days.length<=DAILY_PROGRAMME_MAX_DAYS,'At most 366 reviewed days allowed');}
 ensure(typeof reviewRef==='string'&&reviewRef.trim().length>0&&reviewRef.trim()===reviewRef&&reviewRef.length<=DAILY_PROGRAMME_MAX_REVIEW_REF&&!/[\u0000-\u001f\u007f]/.test(reviewRef),'Explicit bounded review reference required');
 ensure(typeof expectedPrefixFingerprint==='string'&&/^[0-9a-f]{64}$/.test(expectedPrefixFingerprint),'Independently reviewed prefix fingerprint required');
 ensure(typeof generatedAt==='string'&&Number.isFinite(Date.parse(generatedAt))&&new Date(generatedAt).toISOString()===generatedAt&&Date.parse(generatedAt)<=Date.now(),'Actual nonfuture preparation timestamp required');
 return {initialThrough,ceiling,firstDay,days,reviewRef,expectedPrefixFingerprint,generatedAt};
}

async function checkedClient(client){
 const {assertDisposableDailyClient}=await import('./daily-writer.mjs');
 ensure(typeof assertDisposableDailyClient==='function','Disposable brand assertion is required');
 assertDisposableDailyClient(client);
}
async function snapshot(client){
 const listed=(await client.query("SELECT n.nspname AS schema,c.relname AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND (n.nspname IN ('finance_history_v2','finance_v1') OR (n.nspname='public' AND c.relname=ANY($1::text[]))) ORDER BY n.nspname,c.relname",[publicTables])).rows;
 ensure(listed.some(t=>t.schema==='finance_history_v2'&&t.name==='contracts'),'Reviewed history schema required');
 const tables={};
 for(const table of listed){const key=table.schema+'.'+table.name;tables[key]=(await client.query(`SELECT to_jsonb(t) AS row FROM ${quote(table.schema)}.${quote(table.name)} t ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.row);}
 return tables;
}
/** Reads only an already branded disposable database; its result must be independently reviewed. */
export async function reviewedPrefixFingerprint(client){await checkedClient(client);return materialDigest(await snapshot(client));}

function assertProtectedRetained(before,after,{initialThrough,ceiling}){
 ensure(same(Object.keys(before),Object.keys(after)),'Disposable table inventory changed during compilation');
 for(const [table,rows] of Object.entries(before)){
  const actual=after[table];
  if(!table.startsWith('finance_history_v2.')||!['contracts',...sourceTables,'coverage','seals','runs'].includes(table.slice('finance_history_v2.'.length))){ensure(same(rows,actual),'Original or unrelated protection changed: '+table);continue;}
  if(table==='finance_history_v2.contracts'){
   ensure(rows.length===actual.length&&rows.every(old=>actual.some(row=>same(old.store_id===identity.storeId?{...old,through_day:ceiling}:old,row))),'Reviewed contract changed beyond exact approved horizon');
  }else{
   const retained=new Set(actual.map(canonical));ensure(rows.every(row=>retained.has(canonical(row))),'Protected retained prefix changed: '+table);
   ensure(same(rows.filter(row=>row.store_id!==identity.storeId),actual.filter(row=>row.store_id!==identity.storeId)),'Unrelated history rows changed: '+table);
   const original=new Set(rows.map(canonical));ensure(actual.every(row=>original.has(canonical(row))||(row.store_id===identity.storeId&&(row.event_date??row.date_to)>initialThrough)),'Unexpected earlier-prefix insertion: '+table);
  }
 }
}
async function extractMaterial(client,plan,expectedThrough){
 const run=(await client.query('SELECT to_jsonb(t) AS row FROM finance_history_v2.runs t WHERE store_id=$1 AND date_from=$2 AND date_to=$2',[identity.storeId,plan.day])).rows;
 ensure(run.length===1,'Exactly one canonical daily receipt required');
 const coverage=(await client.query('SELECT to_jsonb(t) AS row FROM finance_history_v2.coverage t WHERE store_id=$1 AND date_to=$2 ORDER BY kind,coverage_id',[identity.storeId,plan.day])).rows.map(r=>r.row);
 const seals=(await client.query('SELECT to_jsonb(t) AS row FROM finance_history_v2.seals t WHERE store_id=$1 AND date_to=$2 ORDER BY snapshot_id',[identity.storeId,plan.day])).rows.map(r=>r.row);
 const validationSets={};
 for(const table of sourceTables){
  const result=(await client.query(`SELECT jsonb_build_object('rowCount',count(*),'sha256',encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY source_id),'[]'::jsonb)::text,'UTF8')),'hex')) AS proof FROM finance_history_v2.${table} t WHERE store_id=$1 AND event_date<=$2`,[identity.storeId,plan.day])).rows[0];
  ensure(result&&Number.isSafeInteger(result.proof?.rowCount)&&result.proof.rowCount>=0&&/^[0-9a-f]{64}$/.test(result.proof.sha256),'Complete actual prefix proof required');validationSets[table]=result.proof;
 }
 return {validationSets,contract:'reviewed-synthetic-daily-material-v1',storeId:identity.storeId,day:plan.day,expectedThrough,edition:HISTORY_EDITION,profile:'uk-gifts-v2',anchor:'2024-11-01',sourceHash:plan.hash,sources:plan.mapped,coverage,seals,run:run[0].row};
}

/** Mutates only the supplied new disposable rehearsal DB; never applies or provisions hosted material. */
export async function compileReviewedProgramme(client,options={}){
 const allowed=['initialThrough','ceiling','reviewRef','expectedPrefixFingerprint','generatedAt'];
 ensure(options&&Object.keys(options).every(k=>allowed.includes(k)),'Only finite offline compiler options accepted');
 const range=reviewedMaterialRange({...options,generatedAt:options.generatedAt??new Date().toISOString()});
 await checkedClient(client);
 const before=await snapshot(client);ensure(materialDigest(before)===range.expectedPrefixFingerprint,'Reviewed prefix fingerprint differs');
 const contracts=before['finance_history_v2.contracts']??[],contract=contracts.find(c=>c.store_id===identity.storeId);
 ensure(contract&&contract.through_day===range.initialThrough&&contract.date_from==='2024-11-01'&&contract.profile==='uk-gifts-v2'&&contract.edition===HISTORY_EDITION&&contract.currency==='GBP'&&contract.timezone==='Europe/London','Exact reviewed initial contract required');
 const {prepareDailySources,createDisposableDailyWriter}=await import('./daily-writer.mjs');
 const materials=[],entries=[];
 let through=range.initialThrough;
 for(const day of range.days){
  const modeledBoundary=historySourceAsOf(day),plan=prepareDailySources({asOf:addDays(day,1),anchor:'2024-11-01',day});
  await createDisposableDailyWriter(client,{now:()=>new Date(modeledBoundary)}).append(plan,{expectedThrough:through});
  const material=await extractMaterial(client,plan,through);
  ensure(material.coverage.every(c=>c.source_manifest.observedAt===modeledBoundary&&c.source_manifest.sourceAsOf===modeledBoundary),'Modeled boundary metadata differs');
  const proof=(await client.query("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') AS sha256",[JSON.stringify(material)])).rows[0]?.sha256;
  ensure(/^[0-9a-f]{64}$/.test(proof),'PostgreSQL JSONB material digest required');
  const entry={day,expectedThrough:through,sourceHash:plan.hash,modeledBoundary,materialByteSha256:bytesDigest(material),materialJsonbSha256:proof,reviewRef:range.reviewRef};
  entries.push(entry);materials.push({day,material,material_sha256:proof,review_ref:range.reviewRef});through=day;
 }
 assertProtectedRetained(before,await snapshot(client),range);
 const manifest={contract:'reviewed-synthetic-finite-programme-v1',storeId:identity.storeId,profile:'uk-gifts-v2',edition:HISTORY_EDITION,anchor:'2024-11-01',currency:'GBP',timezone:'Europe/London',formulaVersion:HISTORY_FORMULA,initialThrough:range.initialThrough,firstDay:range.firstDay,ceiling:range.ceiling,reviewRef:range.reviewRef,generatedAt:range.generatedAt,expectedPrefixFingerprint:range.expectedPrefixFingerprint,timestampSemantics:'observedAt in precomputed synthetic evidence is the modeled completed-day boundary, not preparation, observation, provider collection or publication time; actual publication is recorded by the hosted server separately',hostedApplied:false,activationAllowed:false,entries};
 const programme=validateDailyProgramme({purpose:DAILY_PROGRAMME_PURPOSE,scope:DAILY_PROGRAMME_SCOPE,initialThrough:range.initialThrough,ceiling:range.ceiling,days:entries.map(({day,expectedThrough,materialJsonbSha256,reviewRef})=>({day,expectedThrough,materialSha256:materialJsonbSha256,reviewRef}))});
 return {manifest,manifestSha256:materialDigest(manifest),programme,materials};
}
