import test from 'node:test';
import assert from 'node:assert/strict';
import {writeLocalXeroAccountDirectory} from './account-directory-store.mjs';

const directory=()=>({tenantId:'tenant-a',retrievedAt:'2026-09-18T10:00:00.000Z',accounts:[{id:'sales',name:'Sales',type:'REVENUE',status:'ACTIVE'}]});
test('stores only a minimal local account directory',async()=>{
 const writes=[];const fs={mkdir:async()=>{},writeFile:async(path,body,options)=>writes.push({path,body,options}),rename:async()=>{}};
 const result=await writeLocalXeroAccountDirectory('/tmp/xero-account-directory.json',directory(),{fs});
 assert.equal(result.accountCount,1);assert.equal(writes.length,1);assert.deepEqual(JSON.parse(writes[0].body),{source:'xero',...directory()});assert.equal(writes[0].options.mode,0o600);
});
test('refuses balances, settings, malformed values and duplicate account identities',async()=>{
 for(const mutate of [x=>x.accounts[0].balance=1,x=>x.accounts[0].id='',x=>x.accounts.push({...x.accounts[0]}),x=>x.retrievedAt='bad']){
  const input=directory();mutate(input);await assert.rejects(writeLocalXeroAccountDirectory('/tmp/xero-account-directory.json',input),/invalid/);
 }
});
