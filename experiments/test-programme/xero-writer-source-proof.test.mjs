import test from 'node:test';import assert from 'node:assert/strict';
import {verifyXeroWriterSourceProof,validXeroSourceSelection} from './xero-writer-source-proof.mjs';
import {createXeroReaderContextProofSource,createXeroOwnerSessionBindingReader} from './xero-reader-context-proof.mjs';
const owner='90000000-0000-4000-8000-000000000001',store='90000000-0000-4000-8000-000000000002',tenant='90000000-0000-4000-8000-000000000003',contact='90000000-0000-4000-8000-000000000004',account='90000000-0000-4000-8000-000000000005';
const now=()=>new Date('2026-10-30T12:00:00Z'),token='synthetic-private-fresh-access-token',scopes='offline_access accounting.invoices accounting.settings.read accounting.contacts.read';
const selection={contactId:contact,accountId:account,confirmedSyntheticContactId:contact,confirmedNonStockAccountId:account,separateWriterAppConfirmed:true};
const row={tenant_id:tenant,store_id:store,context_role:'existing_authorized_audit_context',outcome:'connected',phase:'organisation',reason:'ok',tenant_visible:true,matches_current_credential:true,latest_time_unambiguous:true,checked_at:'2026-10-30T11:50:00Z'};
const reader=patch=>createXeroReaderContextProofSource({authenticateContext:async()=>({ownerId:owner,storeId:store,authenticated:true}),query:async()=>({rows:[{...row,...patch}]}),now});
const payloads=()=>({Organisation:{Organisations:[{BaseCurrency:'GBP',IsDemoCompany:true,PrivateOrgField:'discard-me'}]},Contacts:{Contacts:[{ContactID:contact,ContactStatus:'ACTIVE',Name:'PRIVATE CONTACT NAME',EmailAddress:'private@example.invalid',Addresses:[{AddressLine1:'PRIVATE ADDRESS'}]}]},Accounts:{Accounts:[{AccountID:account,Code:'200',Type:'REVENUE',Status:'ACTIVE',Name:'PRIVATE REVENUE ACCOUNT',BankAccountNumber:'PRIVATE BANK'}]}});
function harness(patch={}){const calls=[],bodies={...payloads(),...patch};return {calls,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(bodies[url.endsWith('/Organisation')?'Organisation':url.includes('/Contacts/')?'Contacts':'Accounts']));}};}
const base={accessToken:token,tenantId:tenant,grantedScopes:scopes,selection,ownerId:owner,storeId:store,now};
test('three exact scoped GETs verify actual selected facts and independently authenticated reader context',async()=>{
 const h=harness(),r=await verifyXeroWriterSourceProof({...base,...h,readerContextSource:reader()});
 assert.equal(r.state,'source_proof_complete');assert.equal(r.readerState,'matched');assert.equal(r.providerReads,3);assert.equal(r.providerWrites,0);assert.equal(r.credentialRefreshes,0);assert.equal(r.activationAuthorized,false);assert.equal(r.providerReceipt.accountCode,'200');assert.equal(r.providerReceipt.contactId,contact);assert.equal(r.providerReceipt.writerConsentState,undefined);assert.equal(r.expiresAt,'2026-10-30T12:50:00.000Z');assert.equal(r.provenance.syntheticContactIntent,'owner_confirmed_exact_contact_id');
 assert.deepEqual(h.calls.map(c=>c.url),['https://api.xero.com/api.xro/2.0/Organisation',`https://api.xero.com/api.xro/2.0/Contacts/${contact}`,`https://api.xero.com/api.xro/2.0/Accounts/${account}`]);
 for(const {options} of h.calls){assert.equal(options.method,'GET');assert.equal(options.headers['Xero-tenant-id'],tenant);assert.equal(options.headers.Authorization,'Bearer '+token);assert.equal(options.redirect,'error');assert.equal(options.signal instanceof AbortSignal,true);}
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE|private@example|access-token|refresh_token|EmailAddress|Addresses|BankAccountNumber|ciphertext/);assert.equal(Object.isFrozen(r.providerReceipt),true);
});
test('raw tenant receipt or missing independent reader adapter never becomes a matched reader',async()=>{
 let called=false;for(const readerContextSource of [undefined,{target:tenant,connected:true},{read:async()=>{called=true;return {target:tenant,connected:true};}}]){
 const r=await verifyXeroWriterSourceProof({...base,...harness(),readerContextSource});assert.equal(r.state,'source_proof_incomplete');assert.equal(r.readerState,'unavailable');assert.equal(r.readerReceipt,null);}
 assert.equal(called,false);
 const mismatched=await verifyXeroWriterSourceProof({...base,...harness(),readerContextSource:reader({tenant_id:account})});assert.equal(mismatched.readerState,'mismatched');assert.equal(mismatched.state,'source_proof_incomplete');
 const stale=await verifyXeroWriterSourceProof({...base,...harness(),readerContextSource:reader({checked_at:'2026-10-30T10:00:00Z'})});assert.equal(stale.readerState,'unavailable');
});
test('unsafe selections or scopes fail before contacting any source',async()=>{
 for(const patch of [{selection:{...selection,contactId:'../../Invoices'}},{selection:{...selection,confirmedSyntheticContactId:account}},{selection:{...selection,confirmedNonStockAccountId:contact}},{selection:{...selection,separateWriterAppConfirmed:false}},{selection:{...selection,extra:true}},{grantedScopes:scopes+' accounting.transactions'},{grantedScopes:'offline_access accounting.invoices accounting.settings.read'},{tenantId:'not-a-tenant'}]){
 const h=harness();await assert.rejects(verifyXeroWriterSourceProof({...base,...h,...patch}),/^Error: Xero writer source proof unavailable$/);assert.equal(h.calls.length,0);}
 assert.equal(validXeroSourceSelection(selection),true);
});
test('non-demo, inactive/wrong contact and non-revenue/inactive/wrong account cannot produce proof',async()=>{
 const cases=[{Organisation:{Organisations:[{BaseCurrency:'GBP',IsDemoCompany:false}]}},{Organisation:{Organisations:[{BaseCurrency:'USD',IsDemoCompany:true}]}},{Contacts:{Contacts:[{ContactID:account,ContactStatus:'ACTIVE'}]}},{Contacts:{Contacts:[{ContactID:contact,ContactStatus:'ARCHIVED'}]}},{Contacts:{Contacts:[]}},{Accounts:{Accounts:[{AccountID:account,Code:'200',Type:'INVENTORY',Status:'ACTIVE'}]}},{Accounts:{Accounts:[{AccountID:account,Code:'200',Type:'REVENUE',Status:'ARCHIVED'}]}},{Accounts:{Accounts:[{AccountID:contact,Code:'200',Type:'REVENUE',Status:'ACTIVE'}]}},{Accounts:{Accounts:[{AccountID:account,Type:'REVENUE',Status:'ACTIVE'}]}}];
 for(const patch of cases){const h=harness(patch);await assert.rejects(verifyXeroWriterSourceProof({...base,...h}));if(patch.Organisation)assert.equal(h.calls.length,1);}
});
test('upstream redirects, oversized/invalid bodies and private exceptions expose only fixed errors',async()=>{
 for(const fetchImpl of [async()=>{throw Error(token+' private failure');},async()=>new Response('{}',{status:403}),async()=>new Response('{}',{headers:{'content-length':'100000'}}),async()=>new Response('x'.repeat(65537)),async()=>new Response('not json'),async()=>({ok:true,redirected:true})])await assert.rejects(verifyXeroWriterSourceProof({...base,fetchImpl}),/^Error: Xero writer source proof unavailable$/);
});

test('fresh conflicting owner binding and strict reader evidence fail closed in either direction',async()=>{
 for(const [strictTarget,bindingTarget] of [[tenant,account],[account,tenant]]){
 const bindingReader=createXeroOwnerSessionBindingReader({authUrl:'https://bioalckltvkhlczusdvl.supabase.co',publicKey:'sb_publishable_'+'a'.repeat(24),authenticateOwner:async()=>({userId:owner,isOwner:true}),fetchImpl:async()=>new Response(JSON.stringify([{store_id:store,tenant_id:bindingTarget}])),now});
 const readerBindingReceipt=await bindingReader.read({authorization:'Bearer synthetic-owner-session',ownerId:owner,storeId:store});
 const r=await verifyXeroWriterSourceProof({...base,...harness(),readerBindingReceipt,readerContextSource:reader({tenant_id:strictTarget})});assert.equal(r.state,'source_proof_incomplete');assert.equal(r.tenantBindingVerified,false);assert.equal(r.readerHealthVerified,false);assert.equal(r.readerState,'conflicting_reader_evidence');assert.ok(r.limitations.includes('conflicting_reader_bindings'));
 }
});
