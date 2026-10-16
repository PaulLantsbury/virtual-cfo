import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverXeroAccounts,parseXeroAccountDirectory} from './account-discovery.mjs';

const accessToken='a'.repeat(20),tenantId='night-scout-test-tenant';
const payload=()=>({Accounts:[
 {AccountID:'account-sales',Name:'Sales',Type:'REVENUE',Status:'ACTIVE',BankAccountNumber:'never retain'},
 {AccountID:'account-fees',Name:'Processing fees',Type:'EXPENSE',Status:'ACTIVE'}
]});

test('uses one pinned, tenant-bound GET request and retains only account directory fields',async()=>{
 let request;
 const accounts=await discoverXeroAccounts({accessToken,tenantId,pinnedTenantId:tenantId,fetchImpl:async(url,options)=>{request={url,options};return new Response(JSON.stringify(payload()));}});
 assert.equal(request.url,'https://api.xero.com/api.xro/2.0/Accounts');
 assert.deepEqual(request.options,{method:'GET',headers:{authorization:`Bearer ${accessToken}`,'xero-tenant-id':tenantId,accept:'application/json'},redirect:'error'});
 assert.deepEqual(accounts,[{id:'account-sales',name:'Sales',type:'REVENUE',status:'ACTIVE'},{id:'account-fees',name:'Processing fees',type:'EXPENSE',status:'ACTIVE'}]);
 assert.equal(Object.isFrozen(accounts),true);assert.equal(Object.isFrozen(accounts[0]),true);
});

test('accepts a normal long OAuth access token while retaining short token rejection',async()=>{
 const accounts=await discoverXeroAccounts({accessToken:'a'.repeat(1500),tenantId,pinnedTenantId:tenantId,fetchImpl:async()=>new Response(JSON.stringify(payload()))});
 assert.equal(accounts.length,2);
});

test('refuses changed tenant, invalid request values, and upstream failures without exposing payloads',async()=>{
 for(const input of [
  {accessToken:'short',tenantId,pinnedTenantId:tenantId},
  {accessToken,tenantId,pinnedTenantId:'another-tenant'},
  {accessToken,tenantId:'',pinnedTenantId:tenantId}
 ])await assert.rejects(discoverXeroAccounts(input),error=>error.message==='Xero account discovery unavailable');
 for(const fetchImpl of [async()=>new Response('secret response',{status:403}),async()=>{throw Error('network secret');},async()=>new Response('not json')])await assert.rejects(discoverXeroAccounts({accessToken,tenantId,pinnedTenantId:tenantId,fetchImpl}),error=>error.message==='Xero account discovery unavailable');
});

test('retains an explicit unavailable status and rejects malformed account records and duplicate account identities',()=>{
 assert.deepEqual(parseXeroAccountDirectory({Accounts:[{AccountID:'id',Name:'Name',Type:'REVENUE'}]}),[{id:'id',name:'Name',type:'REVENUE',status:'Unavailable'}]);
 const invalid=[null,{}, {Accounts:{}},{Accounts:[null]}, {Accounts:[{AccountID:'id',Name:'Name'}]}, {Accounts:[{AccountID:'id',Name:'Name',Type:'REVENUE',Status:'ACTIVE'},{AccountID:'id',Name:'Other',Type:'EXPENSE',Status:'ACTIVE'}]}];
 for(const value of invalid)assert.throws(()=>parseXeroAccountDirectory(value),/Xero account discovery unavailable/);
});
