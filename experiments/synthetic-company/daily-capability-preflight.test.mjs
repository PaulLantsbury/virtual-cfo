import test from 'node:test';import assert from 'node:assert/strict';
import {DAILY_FUNCTION_CONTRACT,DAILY_PROTECTED_TABLES,capabilityDigest,validateDailyCapabilityPreflight} from './daily-capability-preflight.mjs';
function candidate(){
 const expected={callerRole:'daily_test_invoker',schemaOwner:'separate_operator',ownerRole:'daily_test_owner',functionHashes:{},tableProtectionHashes:{},planProtectionHashes:{},canonicalValidationAccepted:true,restrictedCallerTestsAccepted:true,protectedFingerprintsAccepted:true};
 const observed={schemaPresent:true,schemaOwner:expected.schemaOwner,auditedPrincipals:[expected.callerRole,expected.ownerRole],boundLoginPrivileges:[],unsafeSchemaCreate:[],unsafeSequencePrivileges:[],unsafeSecurityDefinerExecute:[],schemaPrivileges:[],memberships:[],unsafeOtherFunctions:[],roles:[expected.callerRole,expected.ownerRole,expected.schemaOwner].map(name=>({name,login:false,superuser:false,bypassRls:false,replication:false,createRole:false,createDb:false,inherit:false})),functions:[],tables:[]};
 for(const spec of DAILY_FUNCTION_CONTRACT){const definition='reviewed candidate '+spec.name;expected.functionHashes[spec.name]=capabilityDigest(definition);observed.functions.push({...spec,definition,owner:expected.ownerRole,securityDefiner:true,settings:spec.name==='append_completed_day'?['search_path=pg_catalog','lock_timeout=5s']:['search_path=pg_catalog'],executeGrantees:[expected.ownerRole,...(spec.caller?[expected.callerRole]:[])]});}
 for(const name of DAILY_PROTECTED_TABLES){const table={schema:'finance_history_v2',name,kind:'r',owner:'separate_history_table_owner',rls:true,forceRls:false,callerSelect:false,callerDml:false,callerColumnUpdate:false,ownerSelect:true,ownerDeleteTruncate:false,ownerInsert:!['contracts','invalidations'].includes(name),ownerUpdateColumns:name==='contracts'?['through_day']:[],policies:['reviewed fixed company predicate'],triggers:[{name:'immutable',enabled:'O',definition:'reviewed trigger'}]};observed.tables.push(table);expected.tableProtectionHashes[name]=capabilityDigest(JSON.stringify({policies:table.policies,triggers:table.triggers,rls:table.rls,forceRls:table.forceRls}));}
 for(const name of ['programme','reviewed_days','publication_receipts']){const t={schema:'finance_daily_v1',name,kind:'r',owner:'separate_operator',rls:true,forceRls:false,callerSelect:false,callerDml:false,callerColumnUpdate:false,ownerSelect:true,ownerInsert:name==='publication_receipts',ownerColumnInsert:name==='publication_receipts',ownerDeleteTruncate:false,ownerUpdateColumns:[],policies:[],triggers:['immutable']};observed.tables.push(t);expected.planProtectionHashes[name]=capabilityDigest(JSON.stringify({policies:t.policies,triggers:t.triggers,rls:t.rls,forceRls:t.forceRls,columns:t.columns,constraints:t.constraints}));}
 return {expected,observed};
}
test('missing capability is blocked with exact missing-function findings, never activation permission',()=>{
 const {expected}=candidate();const result=validateDailyCapabilityPreflight({schemaPresent:false,roles:[],functions:[],memberships:[],tables:[]},expected);
 assert.equal(result.state,'blocked');assert.ok(result.findings.includes('missing-or-overloaded-function:append_completed_day'));assert.ok(result.findings.includes('missing-or-overloaded-function:validate_reviewed_day'));assert.equal(result.activationAllowed,false);
});
test('catalog acceptance cannot override separate canonical, restricted caller and protection acceptance',()=>{
 const {expected,observed}=candidate();assert.equal(validateDailyCapabilityPreflight(observed,expected).state,'catalog-ready-for-separate-approval');
 for(const field of ['canonicalValidationAccepted','restrictedCallerTestsAccepted','protectedFingerprintsAccepted'])assert.equal(validateDailyCapabilityPreflight(observed,{...expected,[field]:false}).state,'blocked');
 assert.equal(validateDailyCapabilityPreflight(observed,expected).activationAllowed,false);
});
test('PUBLIC/browser grants, unsafe ownership/search path, extra overloads and column DML fail closed',()=>{
 const changes=[r=>r.functions[0].executeGrantees.push('PUBLIC'),r=>r.functions[0].executeGrantees.push('authenticated'),r=>r.functions[0].settings=['search_path=public'],r=>r.roles[1].bypassRls=true,r=>r.memberships.push({role:'privileged',member:'daily_test_invoker'}),r=>r.tables[0].owner='daily_test_owner',r=>r.tables[0].callerColumnUpdate=true,r=>r.tables[1].callerSelect=true,r=>r.tables[1].ownerUpdateColumns=['body'],r=>r.tables[1].ownerDeleteTruncate=true,r=>r.tables[0].triggers=[],r=>r.functions.push({...r.functions[0],arguments:'text'}),r=>r.functions[0].definition+=' changed',r=>r.tables.push({schema:'finance_v1',name:'original_january',callerDml:true})];
 for(const change of changes){const {expected,observed}=candidate();change(observed);assert.equal(validateDailyCapabilityPreflight(observed,expected).state,'blocked');}
});

test('bound LOGIN membership options cannot confer administration, implicit inheritance or lose SET admission',()=>{
 const {expected,observed}=candidate();const login={name:'generic_bound_login',login:true,superuser:false,bypassRls:false,replication:false,createRole:false,createDb:false,inherit:false};observed.roles.push(login);observed.auditedPrincipals.push(login.name);const membership={role:expected.callerRole,member:login.name,adminOption:false,inheritOption:false,setOption:true};observed.memberships=[membership];expected.memberships=[{...membership}];assert.equal(validateDailyCapabilityPreflight(observed,expected).state,'catalog-ready-for-separate-approval');for(const [key,value] of [['adminOption',true],['inheritOption',true],['setOption',false]]){const changed=structuredClone(observed);changed.memberships[0][key]=value;assert.equal(validateDailyCapabilityPreflight(changed,expected).state,'blocked');}
});

test('effective audit is mandatory for every principal and rejects all unsafe grant classes',()=>{
 for(const field of ['auditedPrincipals','boundLoginPrivileges','unsafeSchemaCreate','unsafeSequencePrivileges','unsafeSecurityDefinerExecute']){
  const {expected,observed}=candidate();delete observed[field];assert.equal(validateDailyCapabilityPreflight(observed,expected).state,'blocked');
 }
 for(const field of ['boundLoginPrivileges','unsafeSchemaCreate','unsafeSequencePrivileges','unsafeSecurityDefinerExecute']){
  const {expected,observed}=candidate();observed[field].push({principal:expected.callerRole});assert.equal(validateDailyCapabilityPreflight(observed,expected).state,'blocked');
 }
 const {expected,observed}=candidate();observed.auditedPrincipals.push('unreviewed_identity');assert.equal(validateDailyCapabilityPreflight(observed,expected).state,'blocked');
});


test('replication authority and absent replication evidence block every restricted principal',()=>{
 for(const name of ['daily_test_invoker','daily_test_owner','separate_operator'])for(const value of [true,undefined]){
  const {expected,observed}=candidate();observed.roles.find(r=>r.name===name).replication=value;assert.equal(validateDailyCapabilityPreflight(observed,expected).state,'blocked');
 }
 for(const value of [true,undefined]){const {expected,observed}=candidate();const login={name:'bound_login',login:true,superuser:false,bypassRls:false,replication:value,createRole:false,createDb:false,inherit:false};observed.roles.push(login);observed.auditedPrincipals.push(login.name);const membership={role:expected.callerRole,member:login.name,adminOption:false,inheritOption:false,setOption:true};observed.memberships=[membership];expected.memberships=[{...membership}];assert.equal(validateDailyCapabilityPreflight(observed,expected).state,'blocked');}
});
