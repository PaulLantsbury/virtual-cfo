import test from 'node:test';import assert from 'node:assert/strict';
import {createHistoryRehearsal,importHistory,createHistoryService} from './history-rehearsal.mjs';
import {prepareHistoryReadAccess,HISTORY_READ_TABLES} from './history-read-access.mjs';
import {createHistoryCorrectionService} from './history-corrections.mjs';
const now=()=>new Date('2026-11-05T17:00:00Z');
test('existing restricted server reads only member synthetic history; browser and writes stay denied; rollback removes access',async()=>{
 const h=await createHistoryRehearsal({now});try{
  await importHistory(h,{from:'2025-01-01',asOf:'2025-02-01'});
  await h.db.exec("CREATE ROLE history_test_reader NOLOGIN NOINHERIT;GRANT SELECT ON public.stores,public.store_memberships TO history_test_reader;ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;CREATE POLICY fixture_history_member ON public.store_memberships FOR SELECT TO history_test_reader USING(user_id=NULLIF(current_setting('night_scout.profit_user_id',true),'')::uuid);CREATE POLICY fixture_history_store ON public.stores FOR SELECT TO history_test_reader USING(EXISTS(SELECT 1 FROM public.store_memberships m WHERE m.store_id=stores.id))");
  const restricted={transaction:fn=>h.db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE history_test_reader');return fn(tx);})};
  const auth=id=>({auth:{getUser:async()=>({data:{user:{id,is_anonymous:false}}})}});
  const scope={storeId:h.storeId,currency:'GBP',from:'2025-01-01',to:'2025-01-31'},service=createHistoryService(restricted,auth(h.reviewerId),{now});
  await assert.rejects(service.read(scope,'Bearer valid'),/permission denied/);
  const p=prepareHistoryReadAccess({serviceRole:'history_test_reader'});
  await h.db.exec("CREATE TABLE finance_history_v2.release_manifest(release_id text PRIMARY KEY,published boolean NOT NULL);ALTER TABLE finance_history_v2.release_manifest ENABLE ROW LEVEL SECURITY;INSERT INTO finance_history_v2.release_manifest VALUES('disposable-stage',false)");
  await assert.rejects(h.db.exec(p.commitSql),/not published/);await h.db.exec('ROLLBACK');
  await h.db.exec('UPDATE finance_history_v2.release_manifest SET published=true');await h.db.exec(p.commitSql);
  const read=await service.read(scope,'Bearer valid');assert.equal(read.state,'supported');assert.equal(read.profit.operatingProfit,197602);
  const availability=await service.available({storeId:h.storeId,currency:'GBP'},'Bearer valid');assert.equal(availability.months.length,1);
  const writer=createHistoryCorrectionService(h,auth(h.reviewerId));
  const event=(await h.db.query("SELECT source_id,body FROM finance_history_v2.events WHERE kind='expense_accrual' AND event_date BETWEEN '2025-01-01' AND '2025-01-31' ORDER BY source_id LIMIT 1")).rows[0];
  const amount=event.body.postings.find(p=>p.account.startsWith('expense:')).amount;
  const proposal=await writer.prepare({scope,requestKey:'restricted-read-proof',expectedVersionId:read.versionId,eventId:event.source_id,amountPence:amount+1000,reason:'Explicit disposable expense evidence correction'},'Bearer valid');
  await writer.review({requestKey:'restricted-read-proof',proposalHash:proposal.proposalHash,decision:'approve',note:'Local test review'},'Bearer valid');
  const published=await writer.publish({requestKey:'restricted-read-proof',proposalHash:proposal.proposalHash,expectedVersionId:read.versionId},'Bearer valid');
  const corrected=await service.read(scope,'Bearer valid',{edition:'synthetic-history-v2-2026-11',versionId:published.versionId});
  assert.equal(corrected.state,'supported');assert.equal(corrected.profit.operatingProfit,196602);
  await assert.rejects(createHistoryService(restricted,auth('10000000-0000-4000-8000-000000000099'),{now}).read(scope,'Bearer valid'),/membership required/);
  for(const table of HISTORY_READ_TABLES){
   for(const role of ['anon','authenticated','service_role'])assert.equal((await h.db.query('SELECT has_table_privilege($1,$2,\'SELECT\') allowed',[role,'finance_history_v2.'+table])).rows[0].allowed,false);
   assert.equal((await h.db.query('SELECT has_table_privilege($1,$2,\'INSERT,UPDATE,DELETE,TRUNCATE\') allowed',['history_test_reader','finance_history_v2.'+table])).rows[0].allowed,false);
  }
  await assert.rejects(h.db.exec(p.commitSql),/policy state differs/);await h.db.exec('ROLLBACK');
  await h.db.exec(p.rollbackSql);await assert.rejects(service.read(scope,'Bearer valid'),/permission denied/);
 }finally{await h.db.close();}
});
