import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {prepareDictionaryTransport,reconstructTransport} from './transport-dictionary.mjs';
test('lossless UTF8 SQL byte reconstruction and native transaction execution including nested DO',async()=>{
 const original=`-- reviewed fictional test only\nBEGIN;\nSET LOCAL TIME ZONE 'UTC';\nINSERT INTO transport_fixture VALUES('£gift 漢字 ''quoted''');\nDO $inner$ BEGIN IF (SELECT count(*) FROM transport_fixture)<>1 THEN RAISE EXCEPTION 'bad'; END IF; END $inner$;\nCOMMIT;\n`;
 const p=prepareDictionaryTransport(original,{maxEntries:64});assert.equal(reconstructTransport(p),original);
 const db=new PGlite();try{await db.exec('CREATE TABLE transport_fixture(value text)');await db.exec(p.wrapperSql);assert.equal((await db.query('SELECT value FROM transport_fixture')).rows[0].value,"£gift 漢字 'quoted'");}finally{await db.close();}
});
test('execution failure rolls back all mutations; checksum corruption fails before source writes',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE TABLE transport_fixture(value text)');
 const original="-- reviewed test\nBEGIN;\nINSERT INTO transport_fixture VALUES('one');\nDO $inner$ BEGIN RAISE EXCEPTION 'intentional'; END $inner$;\nCOMMIT;\n";
 const p=prepareDictionaryTransport(original);await assert.rejects(db.exec(p.wrapperSql),/intentional/);await db.exec('ROLLBACK');assert.equal((await db.query('SELECT count(*)::int n FROM transport_fixture')).rows[0].n,0);
 const corrupt=p.wrapperSql.replace(p.originalSha256,'0'.repeat(64));await assert.rejects(db.exec(corrupt),/checksum mismatch/);await db.exec('ROLLBACK');assert.equal((await db.query('SELECT count(*)::int n FROM transport_fixture')).rows[0].n,0);
 assert.throws(()=>reconstructTransport({...p,encodedBody:p.encodedBody+'x'}),/checksum/);
 }finally{await db.close();}
});
test('ambiguous envelopes and dictionary-symbol collisions rejected',()=>{
 for(const sql of ['BEGIN; SELECT 1; COMMIT;',"-- reviewed\nBEGIN;\nSELECT 1;\nROLLBACK;\n","-- reviewed\nBEGIN;\nSELECT '\uE000';\nCOMMIT;\n"])assert.throws(()=>prepareDictionaryTransport(sql));
});

import {readFile} from 'node:fs/promises';import {prepareInitialSeedCandidate} from './initial-seed-candidate.mjs';import {createStagingRehearsal,readStagingProfit,stagingFingerprints} from './staging-rehearsal.mjs';
test('full bounded seed preserves exact SQL and canonical figures through one native transaction',async()=>{
 const reviewerId='10000000-0000-4000-8000-000000000001';
 const candidate=await prepareInitialSeedCandidate({reviewerId,observedAt:'2026-11-05T12:00:00Z'}),transport=prepareDictionaryTransport(candidate.commitCandidateSql,{maxEntries:64});assert.equal(reconstructTransport(transport),candidate.commitCandidateSql);assert.ok(transport.sizes.wrapperJsonRequestBytes<transport.sizes.originalJsonRequestBytes);
 const h=await createStagingRehearsal({reviewerId});try{
 await h.db.exec(await readFile(new URL('./staging-snapshot-schema.sql',import.meta.url),'utf8'));const other=await stagingFingerprints(h.db,{excludeTarget:true});await h.db.query("SELECT set_config('night_scout.synthetic_target_verified','v2-isolated-staging-reviewed',false)");await h.db.exec(transport.wrapperSql);
 assert.equal(await stagingFingerprints(h.db,{excludeTarget:true}),other);assert.equal((await h.db.query('SELECT count(*)::int n FROM finance_v1.reporting_snapshots')).rows[0].n,1);
 const snapshot=candidate.sourceSnapshot,result=await readStagingProfit(h,{storeId:snapshot.store_id,currency:'GBP',from:snapshot.date_from,to:snapshot.date_to,versionId:snapshot.profit_version_id});assert.equal(result.readError,null);assert.equal(result.result.operatingProfit.value,197602);
 }finally{await h.db.close();}
});
