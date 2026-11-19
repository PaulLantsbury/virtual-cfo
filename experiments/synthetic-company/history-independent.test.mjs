import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createHistoryRehearsal,importHistory,appendHistoryDay} from './history-rehearsal.mjs';
import {createHistoryService} from './history-reader.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
import {stagingFingerprints} from './staging-rehearsal.mjs';
import {readProfitEvidence} from '../financial-v1/profit-evidence-reader.mjs';import {createProfitSalesReader} from '../financial-v1/profit-sales-reader.mjs';
async function fingerprint(db){const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='finance_history_v2' ORDER BY tablename")).rows;assert.ok(tables.length>=4,'actual private history tables required');const rows={};for(const {tablename}of tables){assert.match(tablename,/^[a-z_]+$/);rows[tablename]=(await db.query(`SELECT to_jsonb(t)::text r FROM finance_history_v2.${tablename} t ORDER BY to_jsonb(t)::text`)).rows;}return createHash('sha256').update(JSON.stringify(rows)).digest('hex');}
const auth=id=>({auth:{getUser:async token=>token==='valid'?{data:{user:{id,is_anonymous:false}}}:{error:{message:'private provider diagnostic'}}}});
const full={asOf:'2026-11-05',from:'2024-11-01'};
const referenceClock=()=>new Date('2026-11-06T12:00:00Z'); // Explicit offline next-day simulation, never a provider/runtime clock.
async function januaryV1(h){const v=(await h.db.query("SELECT id,store_id FROM finance_v1.profit_evidence_versions WHERE date_from='2025-01-01' AND date_to='2025-01-31'")).rows;assert.equal(v.length,1,'loaded January retained');return readProfitEvidence(h.db,{versionId:v[0].id,scope:{storeId:v[0].store_id,currency:'GBP',from:'2025-01-01',to:'2025-01-31'},readSales:createProfitSalesReader({userId:h.reviewerId})});}
function reportParts(r){const report=r.report??r;return {sales:report.sales,profit:report.profit??report};}
test('full SQL history supports every complete month, independent annual oracle, occupied January and exact replay',async()=>{
 const h=await createHistoryRehearsal({withLoadedJanuary:true,now:referenceClock});try{
 const legacy=await stagingFingerprints(h.db);assert.equal((await januaryV1(h)).result.operatingProfit.value,197602);
 await importHistory(h,full);assert.equal((await h.db.query("SELECT count(DISTINCT event_date)::int n FROM finance_history_v2.events WHERE event_date BETWEEN '2024-11-01' AND '2026-11-04'")).rows[0].n,734);assert.equal((await h.db.query('SELECT count(*)::int n FROM finance_history_v2.seals')).rows[0].n,24);const service=createHistoryService(h.db,auth(h.reviewerId),{now:h.now});
 let annual={revenue:0,orders:0,gross:0,operating:0,ebitda:0};const rolling=[{revenue:0,orders:0,gross:0,operating:0,ebitda:0},{revenue:0,orders:0,gross:0,operating:0,ebitda:0}];let months=0;
 for(let y=2024,m=11;y<2026||m<=10;m===12?(y++,m=1):m++){
 const from=`${y}-${String(m).padStart(2,'0')}-01`,to=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10),r=await service.read({storeId:h.storeId??identity.storeId,currency:'GBP',from,to},'Bearer valid');const {sales,profit}=reportParts(r);assert.equal(r.state,'supported');assert.equal(r.metadata.anchor,full.from);assert.equal(r.metadata.sourceBasis,'synthetic-local');assert.ok(Date.parse(r.metadata.observedAt)<=+referenceClock());assert.equal(Date.parse(r.metadata.sourceAsOf),Date.UTC(y,m,1)-(m>=3&&m<=9?3600000:0),'exclusive London month boundary');assert.ok(sales,'actual SQL-backed monthly sales');assert.equal(profit.state,'complete');assert.ok(Number.isSafeInteger(profit.operatingProfit));const bucket=rolling[Math.floor(months/12)];bucket.revenue+=profit.revenueDenominator;bucket.orders+=sales.originalOrders;bucket.gross+=profit.grossProfit;bucket.operating+=profit.operatingProfit;bucket.ebitda+=profit.ebitda;months++;
 if(y===2025){annual.revenue+=profit.revenueDenominator;annual.orders+=sales.originalOrders;annual.gross+=profit.grossProfit;annual.operating+=profit.operatingProfit;annual.ebitda+=profit.ebitda;}
 }
 assert.equal(months,24);const oracle={revenue:75000000,orders:19895,gross:36000000,operating:10224448,ebitda:10464448};assert.deepEqual(annual,oracle);assert.deepEqual(rolling,[oracle,oracle],'two complete rolling profile years');
 assert.equal(await stagingFingerprints(h.db),legacy);assert.equal((await januaryV1(h)).result.operatingProfit.value,197602);
 const before=await fingerprint(h.db);await importHistory(h,full);assert.equal(await fingerprint(h.db),before,'exact initial replay changes no history/receipt rows');
 assert.equal((await service.read({storeId:h.storeId??identity.storeId,currency:'GBP',from:'2026-11-01',to:'2026-11-30'},'Bearer valid')).state,'unavailable');
 await assert.rejects(createHistoryService(h.db,auth('10000000-0000-4000-8000-000000000099'),{now:h.now}).read({storeId:h.storeId??identity.storeId,currency:'GBP',from:'2025-01-01',to:'2025-01-31'},'Bearer valid'),/member|access/i);
 }finally{await h.db.close();}
});
test('completed-day append preserves closed scope and legacy January; replay remains receipt-idempotent',async()=>{
 const h=await createHistoryRehearsal({withLoadedJanuary:true,now:referenceClock});try{
 await importHistory(h,full);const legacy=await stagingFingerprints(h.db),service=createHistoryService(h.db,auth(h.reviewerId),{now:h.now}),scope={storeId:h.storeId??identity.storeId,currency:'GBP',from:'2025-01-01',to:'2025-01-31'};
 const before=await service.read(scope,'Bearer valid');await appendHistoryDay(h,{asOf:'2026-11-06',date:'2026-11-05'});assert.deepEqual(await service.read(scope,'Bearer valid'),before);assert.equal(await stagingFingerprints(h.db),legacy);
 const once=await fingerprint(h.db);await appendHistoryDay(h,{asOf:'2026-11-06',date:'2026-11-05'});assert.equal(await fingerprint(h.db),once);assert.equal((await januaryV1(h)).result.operatingProfit.value,197602);
 }finally{await h.db.close();}
});

test('failure rollback covers receipts and evidence; queued duplicate submissions produce one committed day, not distributed-concurrency acceptance',async()=>{
 const h=await createHistoryRehearsal({withLoadedJanuary:true,now:referenceClock});try{
 const small={asOf:'2025-02-01',from:'2025-01-01'},legacy=await stagingFingerprints(h.db),empty=await fingerprint(h.db);
 for(const failAt of ['after-sources','before-seal','before-commit']){await assert.rejects(importHistory(h,{...small,failAt}),/Injected history failure/);assert.equal(await fingerprint(h.db),empty);assert.equal(await stagingFingerprints(h.db),legacy);}
 await importHistory(h,small);const before=await fingerprint(h.db);
 await assert.rejects(appendHistoryDay(h,{from:small.from,asOf:'2025-02-02',date:'2025-02-01',failAt:'before-commit'}),/Injected/);assert.equal(await fingerprint(h.db),before);
 const results=await Promise.all([appendHistoryDay(h,{from:small.from,asOf:'2025-02-02',date:'2025-02-01'}),appendHistoryDay(h,{from:small.from,asOf:'2025-02-02',date:'2025-02-01'})]);assert.equal(results.filter(r=>r.replay===false).length,1);assert.equal(results.filter(r=>r.replay===true).length,1);
 const receipts=(await h.db.query("SELECT count(*)::int n FROM finance_history_v2.runs WHERE date_from='2025-02-01' AND date_to='2025-02-01'")).rows[0].n;assert.equal(receipts,1);assert.equal(await stagingFingerprints(h.db),legacy);
 await assert.rejects(appendHistoryDay(h,{from:'2024-12-01',asOf:'2025-02-03',date:'2025-02-02'}),/anchor|contiguous|edition|contract/i);
 await assert.rejects(appendHistoryDay(h,{from:small.from,asOf:'2025-02-04',date:'2025-02-03'}),/contiguous|next|anchor/i);
 await assert.rejects(appendHistoryDay(h,{from:small.from,asOf:'2026-11-07',date:'2026-11-06'}),/Future|current|completed/i);
 const stable=await fingerprint(h.db);await assert.rejects(h.db.exec('TRUNCATE finance_history_v2.contracts CASCADE'),/cannot|immutable|edition|append/i);assert.equal(await fingerprint(h.db),stable);
 }finally{await h.db.close();}
});

import {invalidateHistoryMonth} from './history-rehearsal.mjs';
async function refusesRead(service,scope){try{const r=await service.read(scope,'Bearer valid');assert.equal(r.state,'unavailable');}catch(e){assert.match(e.message,/contract|scope|coverage|evidence|changed|fingerprint|invalid|source|manifest/i);}}
test('coverage/contract authority, actual source correction and explicit invalidation fail closed',async()=>{
 const h=await createHistoryRehearsal({withLoadedJanuary:true,now:referenceClock});try{
 const options={asOf:'2025-02-01',from:'2025-01-01'};await importHistory(h,options);const service=createHistoryService(h.db,auth(h.reviewerId),{now:h.now}),scope={storeId:h.storeId,currency:'GBP',from:'2025-01-01',to:'2025-01-31'};
 assert.equal((await service.read(scope,'Bearer valid')).state,'supported');
 await assert.rejects(service.read(scope,'Bearer invalid'),/sign-in could not be verified/);await assert.rejects(service.read({...scope,snapshotId:'untrusted'},'Bearer valid'),/Complete history month/);
 const c=(await h.db.query("SELECT coverage_id,source_hash FROM finance_history_v2.coverage WHERE kind='month' AND date_from='2025-01-01'")).rows[0];
 // Privileged local corruption simulation, not a proposed correction/write interface.
 await h.db.exec('ALTER TABLE finance_history_v2.coverage DISABLE TRIGGER history_immutable');await h.db.query('UPDATE finance_history_v2.coverage SET source_hash=$1 WHERE coverage_id=$2',['0'.repeat(64),c.coverage_id]);await h.db.exec('ALTER TABLE finance_history_v2.coverage ENABLE TRIGGER history_immutable');await refusesRead(service,scope);
 await h.db.exec('ALTER TABLE finance_history_v2.coverage DISABLE TRIGGER history_immutable');await h.db.query('UPDATE finance_history_v2.coverage SET source_hash=$1 WHERE coverage_id=$2',[c.source_hash,c.coverage_id]);await h.db.exec('ALTER TABLE finance_history_v2.coverage ENABLE TRIGGER history_immutable');assert.equal((await service.read(scope,'Bearer valid')).state,'supported');
 try{await h.db.query("UPDATE finance_history_v2.contracts SET date_from='2025-02-01' WHERE store_id=$1",[h.storeId]);await refusesRead(service,scope);await h.db.query("UPDATE finance_history_v2.contracts SET date_from='2025-01-01' WHERE store_id=$1",[h.storeId]);}catch(e){assert.match(e.message,/contract|anchor|immutable|pinned|monotonic|completed-day/i);}
 const original=(await h.db.query("SELECT source_id,body,row_hash FROM finance_history_v2.orders WHERE event_date BETWEEN '2025-01-01' AND '2025-01-31' ORDER BY source_id LIMIT 1")).rows[0];
 await h.db.exec('ALTER TABLE finance_history_v2.orders DISABLE TRIGGER history_immutable');await h.db.query("UPDATE finance_history_v2.orders SET body=jsonb_set(body,'{gross_sales}','\"999.99\"'::jsonb) WHERE source_id=$1",[original.source_id]);await h.db.exec('ALTER TABLE finance_history_v2.orders ENABLE TRIGGER history_immutable');await refusesRead(service,scope);const corrupted=await fingerprint(h.db);await assert.rejects(importHistory(h,options),/Immutable history source conflict/);assert.equal(await fingerprint(h.db),corrupted,'changed replay adds no source or receipt rows');
 await h.db.exec('ALTER TABLE finance_history_v2.orders DISABLE TRIGGER history_immutable');await h.db.query('UPDATE finance_history_v2.orders SET body=$1::jsonb,row_hash=$2 WHERE source_id=$3',[JSON.stringify(original.body),original.row_hash,original.source_id]);await h.db.exec('ALTER TABLE finance_history_v2.orders ENABLE TRIGGER history_immutable');assert.equal((await service.read(scope,'Bearer valid')).state,'supported');
 await assert.rejects(service.read({...scope,storeId:'10000000-0000-4000-8000-000000000098'},'Bearer valid'),/member|access/);
 await invalidateHistoryMonth(h,{from:scope.from,to:scope.to,reason:'Explicit local historical correction review'});assert.equal((await service.read(scope,'Bearer valid')).state,'unavailable');assert.equal((await januaryV1(h)).result.operatingProfit.value,197602);
 }finally{await h.db.close();}
});

import {readFile} from 'node:fs/promises';import {createProfitReportingService} from '../financial-v1/profit-reporting-service.mjs';import {profitEvidenceDigest} from '../financial-v1/profit-evidence-reader.mjs';
test('existing January trusted snapshot and legacy service response remain intact across separate v2 import/append',async()=>{
 const h=await createHistoryRehearsal({withLoadedJanuary:true,now:referenceClock});try{
 await h.db.exec(await readFile(new URL('./staging-snapshot-schema.sql',import.meta.url),'utf8'));
 const scope={storeId:h.storeId,currency:'GBP',from:'2025-01-01',to:'2025-01-31'},version=(await h.db.query("SELECT id,source_manifest FROM finance_v1.profit_evidence_versions WHERE store_id=$1 AND date_from='2025-01-01'",[h.storeId])).rows[0];
 const sales=await h.db.transaction(tx=>createProfitSalesReader({userId:h.reviewerId})(tx,scope));
 await h.db.query("INSERT INTO finance_v1.reporting_snapshots(snapshot_id,store_id,date_from,date_to,currency,timezone,source_basis,formula_version,contract_version,sales_revision,profit_version_id,source_as_of,observed_at,manifest_digest,profile_version,coverage) VALUES('10000000-0000-4000-8000-000000000003',$1,'2025-01-01','2025-01-31','GBP','Europe/London','synthetic-local','night-scout-v11-2026-10-30',1,$2,$3,'2025-02-01T00:00:00Z','2026-11-04T12:00:00Z',$4,'uk-gifts-v2',$5)",[h.storeId,sales.revision,version.id,profitEvidenceDigest(version.source_manifest),JSON.stringify({sales:'complete',costs:'complete'})]);
 const service=createProfitReportingService(h.db,auth(h.reviewerId)),before=await service.read(scope,'Bearer valid');assert.equal(before.trustedSnapshot.state,'supported');assert.equal(before.report.operatingProfit.value,197602);
 const snapshot=await h.db.query('SELECT to_jsonb(t)::text r FROM finance_v1.reporting_snapshots t ORDER BY snapshot_id');
 await importHistory(h,{from:'2025-01-01',asOf:'2025-02-01'});await appendHistoryDay(h,{from:'2025-01-01',asOf:'2025-02-02',date:'2025-02-01'});
 assert.deepEqual(await service.read(scope,'Bearer valid'),before);assert.deepEqual((await h.db.query('SELECT to_jsonb(t)::text r FROM finance_v1.reporting_snapshots t ORDER BY snapshot_id')).rows,snapshot.rows);assert.equal((await h.db.query('SELECT count(*)::int n FROM finance_v1.reporting_snapshot_invalidations')).rows[0].n,0);
 }finally{await h.db.close();}
});
