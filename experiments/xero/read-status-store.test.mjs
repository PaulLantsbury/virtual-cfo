import test from 'node:test';
import assert from 'node:assert/strict';
import {writeLocalXeroReadStatus} from './read-status-store.mjs';
test('stores only an approved read phase and timestamp',async()=>{
 const writes=[];const fs={mkdir:async()=>{},writeFile:async(_path,body,options)=>writes.push({body,options}),rename:async()=>{}};
 await writeLocalXeroReadStatus('/tmp/xero-read-status.json',{phase:'account_directory',recordedAt:'2026-09-18T10:00:00.000Z'},{fs});
 assert.deepEqual(JSON.parse(writes[0].body),{source:'xero',phase:'account_directory',recordedAt:'2026-09-18T10:00:00.000Z'});assert.equal(writes[0].options.mode,0o600);
});
test('refuses error text, source payloads and unknown phases',async()=>{
 for(const input of [{phase:'unknown',recordedAt:'2026-09-18T10:00:00.000Z'},{phase:'account_directory',recordedAt:'bad',error:'secret'},{phase:'account_directory',recordedAt:'2026-09-18T10:00:00.000Z',payload:{Accounts:[]}}])await assert.rejects(writeLocalXeroReadStatus('/tmp/xero-read-status.json',input),/invalid/);
});
test('accepts only the fixed non-sensitive account-discovery reason set',async()=>{
 const writes=[];const fs={mkdir:async()=>{},writeFile:async(_path,body)=>writes.push(body),rename:async()=>{}};
 await writeLocalXeroReadStatus('/tmp/xero-read-status.json',{phase:'account_directory',reason:'upstream_refused',recordedAt:'2026-09-18T10:00:00.000Z'},{fs});
 assert.equal(JSON.parse(writes[0]).reason,'upstream_refused');
 await assert.rejects(writeLocalXeroReadStatus('/tmp/xero-read-status.json',{phase:'account_directory',reason:'403 forbidden',recordedAt:'2026-09-18T10:00:00.000Z'}),/invalid/);
});
