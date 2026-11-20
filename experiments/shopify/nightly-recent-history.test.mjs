import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readRecentNightlyHistory} from './nightly-recent-history.mjs';

const input={storeId:'56d92f8a-746e-4b4f-b408-81fc98c4aa17',localDate:'2026-10-15',timezone:'Europe/London'};
const common={local_date:'2026-10-15',date_from:'2026-09-14',date_to:'2026-10-14',state:'completed',started_at:new Date('2026-10-15T01:00:01Z'),finished_at:new Date('2026-10-15T01:00:10Z')};
const claim={...common,timezone:'Europe/London',scheduled_at:new Date('2026-10-15T01:00:00Z')};
const attempt={...common,result_code:'recorded_requires_review'};
function fixture({claims=[claim],attempts=[attempt]}={}){
 const queries=[];
 return {queries,query:async(sql,args)=>{queries.push({sql,args});return {rows:sql.includes('nightly_claims')?claims:attempts};}};
}
test('bounded metadata retains exact scope/timestamps without claims of host correlation or raw fields',async()=>{
 const db=fixture({claims:[{...claim,secret:'PRIVATE',id:'PRIVATE'}],attempts:[{...attempt,raw_payload:'PRIVATE'}]});
 const result=await readRecentNightlyHistory(db,input);
 assert.equal(result.fromLocalDate,'2026-10-09');assert.equal(result.toLocalDate,'2026-10-15');
 assert.equal(result.recentClaims[0].scheduledAt,'2026-10-15T01:00:00.000Z');
 assert.equal(result.recentAttempts[0].resultCode,'recorded_requires_review');assert.equal(result.hostReceiptCorrelation,'not_assessed');
 assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.equal(result.attemptHistoryTruncated,false);
 assert.deepEqual(db.queries.map(q=>q.args),[[input.storeId,'2026-10-09','2026-10-15'],[input.storeId,'2026-10-09','2026-10-15','Europe/London']]);
 assert.ok(db.queries.every(q=>q.sql.startsWith('SELECT ')));assert.ok(db.queries[0].sql.endsWith('LIMIT 7'));assert.ok(db.queries[1].sql.endsWith('LIMIT 16'));
});
test('bounded history explicitly marks truncation and never guesses missing executions',async()=>{
 const result=await readRecentNightlyHistory(fixture({claims:[],attempts:Array.from({length:16},()=>attempt)}),input);
 assert.equal(result.recentAttempts.length,15);assert.equal(result.attemptHistoryTruncated,true);assert.deepEqual(result.recentClaims,[]);
});
test('corrupt, oversized or private-looking metadata fails closed without exposing values',async()=>{
 for(const variant of [
  {claims:[claim,claim]}, {claims:[{...claim,local_date:'2026-10-08'}]},
  {claims:[{...claim,timezone:'UTC'}]}, {claims:[{...claim,finished_at:null}]},
  {attempts:[{...attempt,result_code:'PRIVATE'}]}, {attempts:[{...attempt,state:'unconfirmed',result_code:'replay'}]},
  {attempts:[{...attempt,started_at:'PRIVATE'}]}, {attempts:[{...attempt,date_from:'2026-08-01'}]},
  {attempts:Array.from({length:17},()=>attempt)},
 ]) await assert.rejects(readRecentNightlyHistory(fixture(variant),input),error=>!error.message.includes('PRIVATE'));
});
test('real PostgreSQL queries bound both tables to seven London dates and remain read only',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE SCHEMA ingest_v1;
CREATE TABLE ingest_v1.nightly_claims(store_id uuid,local_date date,timezone text,scheduled_at timestamptz,date_from date,date_to date,state text,started_at timestamptz,finished_at timestamptz);
CREATE TABLE ingest_v1.sync_attempts(id integer,store_id uuid,date_from date,date_to date,state text,result_code text,started_at timestamptz,finished_at timestamptz);
INSERT INTO ingest_v1.nightly_claims VALUES('${input.storeId}','2026-10-15','Europe/London','2026-10-15T01:00:00Z','2026-09-14','2026-10-14','completed','2026-10-15T01:00:01Z','2026-10-15T01:00:10Z');
INSERT INTO ingest_v1.sync_attempts VALUES(1,'${input.storeId}','2026-09-14','2026-10-14','completed','replay','2026-10-15T01:00:01Z','2026-10-15T01:00:10Z'),
(2,'${input.storeId}','2026-09-08','2026-10-08','completed','replay','2026-10-08T22:59:59Z','2026-10-08T23:00:00Z'),
(3,'${input.storeId}','2026-09-08','2026-10-08','completed','replay','2026-10-08T23:00:00Z','2026-10-08T23:00:01Z');
BEGIN READ ONLY;`);
  const result=await readRecentNightlyHistory(db,input);
  assert.equal(result.recentClaims.length,1);assert.equal(result.recentAttempts.length,2);
  assert.equal(result.recentAttempts[1].localDate,'2026-10-09');
  await db.exec('ROLLBACK');
 }finally{await db.close();}
});
