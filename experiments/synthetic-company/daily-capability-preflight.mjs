/** Offline fail-closed catalog validator. It neither installs nor activates a capability. */
import {createHash} from 'node:crypto';
export const DAILY_FUNCTION_CONTRACT=Object.freeze([
 {name:'append_completed_day',arguments:'date, date',caller:true},
 {name:'inspect_daily_receipt',arguments:'date',caller:true},
 {name:'validate_reviewed_day',arguments:'date, jsonb',caller:false},
]);
export const DAILY_PROTECTED_TABLES=Object.freeze(['contracts','events','orders','refunds','lines','returns','coverage','seals','invalidations','runs']);
export const capabilityDigest=value=>createHash('sha256').update(value).digest('hex');
/** expected hashes come from an independently reviewed private candidate, never the observed catalog. */
export function validateDailyCapabilityPreflight(observed,expected){
 const findings=[];const require=(ok,code)=>{if(!ok)findings.push(code);};
 require(observed?.schemaPresent===true,'missing-private-capability-schema');
 require(typeof expected?.callerRole==='string'&&typeof expected?.ownerRole==='string'&&expected.callerRole!==expected.ownerRole,'reviewed-distinct-roles-required');
 require(typeof expected?.schemaOwner==='string'&&![expected?.callerRole,expected?.ownerRole].includes(expected?.schemaOwner)&&observed?.schemaOwner===expected?.schemaOwner,'separate-reviewed-plan-owner-required');
 for(const name of [expected?.callerRole,expected?.ownerRole,expected?.schemaOwner]){
  const role=observed?.roles?.find(r=>r.name===name);
  require(role&&!role.login&&!role.superuser&&!role.bypassRls&&role.replication===false&&!role.createRole&&!role.createDb&&!role.inherit,'restricted-role-required:'+name);
 }
 const sorted=value=>JSON.stringify((value??[]).map(v=>JSON.stringify(v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)).sort());
 require(Array.isArray(observed?.memberships)&&sorted(observed.memberships)===sorted(expected?.memberships??[]),'unreviewed-role-membership');
 require((observed?.memberships??[]).every(m=>{const login=observed?.roles?.find(r=>r.name===m.member);return m.role===expected?.callerRole&&m.adminOption===false&&m.inheritOption===false&&m.setOption===true&&login?.login===true&&!login.superuser&&!login.bypassRls&&login.replication===false&&!login.createRole&&!login.createDb&&!login.inherit;}),'bound-login-must-have-only-restricted-invoker-membership');
 const principals=[expected?.callerRole,expected?.ownerRole,...(expected?.memberships??[]).map(m=>m.member)];
 require(Array.isArray(observed?.auditedPrincipals)&&sorted(observed.auditedPrincipals)===sorted([...new Set(principals)]),'exact-effective-principal-audit-required');
 for(const [field,code] of [['boundLoginPrivileges','bound-login-direct-authority-forbidden'],['unsafeSchemaCreate','schema-create-authority-forbidden'],['unsafeSequencePrivileges','sequence-authority-forbidden'],['unsafeSecurityDefinerExecute','unexpected-security-definer-execute-forbidden']])require(Array.isArray(observed?.[field])&&observed[field].length===0,code);
 require(Array.isArray(observed?.schemaPrivileges)&&observed.schemaPrivileges.every(g=>g.grantee===expected?.schemaOwner||([expected?.callerRole,expected?.ownerRole].includes(g.grantee)&&g.privilege==='USAGE')),'unsafe-capability-schema-grants');
 require(Array.isArray(observed?.unsafeOtherFunctions)&&observed.unsafeOtherFunctions.length===0,'unreviewed-other-function-execute');
 const functions=observed?.functions??[];require(functions.length===DAILY_FUNCTION_CONTRACT.length,'exact-function-set-required');
 for(const spec of DAILY_FUNCTION_CONTRACT){
  const matches=functions.filter(f=>f.name===spec.name&&f.arguments===spec.arguments);require(matches.length===1,'missing-or-overloaded-function:'+spec.name);
  if(matches.length!==1)continue;const f=matches[0];
  require(f.owner===expected?.ownerRole&&f.securityDefiner===true,'fixed-nonbrowser-function-owner:'+spec.name);
  require(JSON.stringify(f.settings)===JSON.stringify(spec.name==='append_completed_day'?['search_path=pg_catalog','lock_timeout=5s']:['search_path=pg_catalog']),'safe-search-path-required:'+spec.name);
  const allowed=[expected?.ownerRole,...(spec.caller?[expected?.callerRole]:[])].sort();
  require(Array.isArray(f.executeGrantees)&&JSON.stringify([...f.executeGrantees].sort())===JSON.stringify(allowed),'exact-execute-grants-required:'+spec.name);
  const hash=expected?.functionHashes?.[spec.name];
  require(/^[0-9a-f]{64}$/.test(hash??'')&&typeof f.definition==='string'&&capabilityDigest(f.definition)===hash,'reviewed-definition-mismatch:'+spec.name);
 }
 for(const t of observed?.tables??[])require(!t.unexpectedControlPrivileges,'relation-control-authority-forbidden:'+t.schema+'.'+t.name);
 for(const name of DAILY_PROTECTED_TABLES){
  const t=observed?.tables?.find(t=>t.schema==='finance_history_v2'&&t.name===name);
  require(!!t,'missing-history-table:'+name);if(!t)continue;
  require(t.kind==='r','exact-history-relation-kind:'+name);
  require(t.owner!==expected?.ownerRole&&t.owner!==expected?.callerRole,'separate-source-table-owner:'+name);
  require(t.rls===true,'history-rls-required:'+name);
  require(t.ownerSelect===true,'exact-owner-read-authority:'+name);
  require(!t.callerSelect&&!t.callerColumnSelect&&!t.callerDml&&!t.callerColumnUpdate,'caller-must-not-have-table-dml:'+name);
  require(t.ownerDeleteTruncate===false,'owner-delete-truncate-forbidden:'+name);
  require(!t.ownerColumnInsert||t.ownerInsert,'owner-column-insert-forbidden:'+name);
  require(t.ownerInsert===!['contracts','invalidations'].includes(name),'exact-owner-insert-authority:'+name);
  require(JSON.stringify(t.ownerUpdateColumns)===(name==='contracts'?'["through_day"]':'[]'),'exact-owner-update-columns:'+name);
  const pin=expected?.tableProtectionHashes?.[name];
  const protection=JSON.stringify({policies:t.policies,triggers:t.triggers,rls:t.rls,forceRls:t.forceRls,columns:t.columns,constraints:t.constraints});
  require(/^[0-9a-f]{64}$/.test(pin??'')&&capabilityDigest(protection)===pin,'reviewed-protection-mismatch:'+name);
 }
 for(const t of observed?.tables??[])if(!['finance_history_v2','finance_daily_v1'].includes(t.schema)||(t.schema==='finance_history_v2'&&!DAILY_PROTECTED_TABLES.includes(t.name)))require(!t.callerSelect&&!t.callerColumnSelect&&!t.callerDml&&!t.callerColumnUpdate&&!t.ownerInsert&&!t.ownerColumnInsert&&!t.ownerDeleteTruncate&&(t.ownerUpdateColumns??[]).length===0&&((!t.ownerSelect&&!t.ownerColumnSelect)||(t.schema==='finance_history_v2'&&t.name==='version_heads')),'unrelated-or-original-authority-forbidden:'+t.schema+'.'+t.name);
 require(sorted((observed?.tables??[]).filter(t=>t.schema==='finance_daily_v1').map(t=>t.name))===sorted(['programme','reviewed_days','publication_receipts']),'exact-private-table-set-required');
 for(const name of ['programme','reviewed_days','publication_receipts']){const t=observed?.tables?.find(t=>t.schema==='finance_daily_v1'&&t.name===name);require(t&&t.kind==='r'&&t.owner===expected?.schemaOwner&&t.rls===true&&t.ownerSelect===true&&!t.callerSelect&&!t.callerColumnSelect&&!t.callerDml&&!t.callerColumnUpdate&&t.ownerInsert===(name==='publication_receipts')&&(!t.ownerColumnInsert||name==='publication_receipts')&&!t.ownerDeleteTruncate&&(t.ownerUpdateColumns??[]).length===0,'operator-only-immutable-plan-table:'+name);const pin=expected?.planProtectionHashes?.[name];require(t&&/^[0-9a-f]{64}$/.test(pin??'')&&capabilityDigest(JSON.stringify({policies:t.policies,triggers:t.triggers,rls:t.rls,forceRls:t.forceRls,columns:t.columns,constraints:t.constraints}))===pin,'reviewed-plan-protection-mismatch:'+name);}
 require(expected?.canonicalValidationAccepted===true,'canonical-server-validation-not-accepted');
 require(expected?.restrictedCallerTestsAccepted===true,'restricted-caller-acceptance-missing');
 require(expected?.protectedFingerprintsAccepted===true,'protected-v1-closed-month-unrelated-fingerprints-missing');
 return {state:findings.length?'blocked':'catalog-ready-for-separate-approval',activationAllowed:false,findings};
}
