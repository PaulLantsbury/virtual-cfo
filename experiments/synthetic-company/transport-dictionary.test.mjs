import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {prepareDictionaryTransport,reconstructTransport} from './transport-dictionary.mjs';
const sql=`-- synthetic generic test, no account binding
BEGIN;
SET LOCAL TIME ZONE 'UTC';
INSERT INTO source VALUES ('common repeated source reference',1),('common repeated source reference',2);
DO $check$ BEGIN IF (SELECT sum(amount) FROM source)<>3 THEN RAISE EXCEPTION 'postflight failure'; END IF; END $check$;
COMMIT;
`;
test('exact original byte reconstruction and one transaction execute multiple existing SQL statements',async()=>{
 const p=prepareDictionaryTransport(sql),db=new PGlite();try{
  assert.equal(reconstructTransport(p),sql);await db.exec('CREATE TABLE source(ref text,amount integer)');
  await db.exec(p.wrapperSql);assert.equal((await db.query('SELECT sum(amount)::int n FROM source')).rows[0].n,3);
 }finally{await db.close();}
});
test('postflight failure rolls back every source insert; corrupted transport cannot execute mutations',async()=>{
 const db=new PGlite();try{
  await db.exec('CREATE TABLE source(ref text,amount integer)');
  const bad=prepareDictionaryTransport(sql.replace('<>3','<>999'));
  await assert.rejects(db.exec(bad.wrapperSql),/postflight failure/);await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT count(*)::int n FROM source')).rows[0].n,0);
  const p=prepareDictionaryTransport(sql),corrupted=p.wrapperSql.replace("encoded text := '","encoded text := 'corrupted ");
  await assert.rejects(db.exec(corrupted),/checksum mismatch/);await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT count(*)::int n FROM source')).rows[0].n,0);
 }finally{await db.close();}
});
test('reserved token collisions and a mismatched approved original are refused; empty dictionary supported',async()=>{
 assert.throws(()=>prepareDictionaryTransport(sql,{expectedJsonHash:'a'.repeat(64)}),/checksum/);
 assert.throws(()=>prepareDictionaryTransport(sql+'-- \uE000'),/reserved/);
 assert.throws(()=>prepareDictionaryTransport('SELECT 1;'),/BEGIN/);
 const p=prepareDictionaryTransport('\nBEGIN;\nSELECT 1;\nCOMMIT;\n');assert.equal(p.dictionary.length,0);
 const db=new PGlite();try{await db.exec(p.wrapperSql);}finally{await db.close();}
});
test('dictionary replacement preserves literal JavaScript replacement metacharacters',()=>{
 const phrase='"repeated literal $$ $& $\' $` content"';
 const original='\nBEGIN;\n'+Array(40).fill('-- '+phrase).join('\n')+'\nSELECT 1;\nCOMMIT;\n';
 const p=prepareDictionaryTransport(original);assert.ok(p.dictionary.some(value=>value.includes('$$')));
 assert.equal(reconstructTransport(p),original);
});
