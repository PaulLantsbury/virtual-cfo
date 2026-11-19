/** Candidate only. Explicitly reviewed upstream PUBLIC statistics metadata; no database changes. */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {validateDailyCapabilityPreflight} from './daily-capability-preflight.mjs';
import {PG17_STATISTICS_PROFILES} from './daily-statistics-profile.mjs';
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export const statisticsDigest=value=>createHash('sha256').update(canonical(value)).digest('hex');
// PostgreSQL 17 owners inherently hold all grant options, regardless of stored ACL bits.
// Normalize only that semantically redundant bit; every ordinary owner privilege,
// non-owner grant option, definition, and separately pinned owner identity remains exact.
// https://www.postgresql.org/docs/17/ddl-priv.html
export const statisticsObjectDigest=object=>{const {owner,...definition}=object;return statisticsDigest({...definition,acl:definition.acl?.map(entry=>entry.grantee==='@OWNER'?{...entry,grantOption:true}:entry)});};
const viewNames=['pg_stat_statements','pg_stat_statements_info'];
const roleFields=['name','login','superuser','bypassRls','replication','createRole','createDb','inherit'];
const sorted=value=>canonical([...value].sort((a,b)=>String(canonical(a)).localeCompare(String(canonical(b)))));
const key=object=>object?.schema+'.'+object?.name;
/** ownerRoles and reviewAccepted are private approval inputs, never copied automatically from a live catalog. */
export function validateStatisticsCompatibility(observed,expected,principalNames=[]){
 const findings=[],require=(ok,code)=>{if(!ok)findings.push(code);};
 const profile=Object.hasOwn(PG17_STATISTICS_PROFILES,expected?.profile??'')?PG17_STATISTICS_PROFILES[expected.profile]:undefined;
 require(expected?.reviewAccepted===true,'statistics-metadata-access-review-required');
 require(!!profile,'independently-reviewed-statistics-profile-required');
 const owners=Array.isArray(expected?.ownerRoles)?expected.ownerRoles:[];
 require(owners.length>0&&new Set(owners.map(r=>r?.name)).size===owners.length&&owners.every(r=>r&&Object.keys(r).length===roleFields.length&&roleFields.every(f=>Object.hasOwn(r,f))&&typeof r.name==='string'&&!principalNames.includes(r.name)&&roleFields.slice(1).every(f=>typeof r[f]==='boolean')&&(r.superuser||(r.login&&r.createRole))),'separate-reviewed-statistics-control-plane-owners-required');
 require(Array.isArray(observed?.ownerRoles)&&Array.isArray(owners)&&sorted(observed.ownerRoles)===sorted(owners),'statistics-owner-descriptor-mismatch');
 require(Array.isArray(observed?.platformAclRoles)&&sorted(observed.platformAclRoles)===sorted(profile?.platformAclRoles??[]),'source-reviewed-statistics-platform-acl-roles-required');
 const ext=observed?.extension;
 require(ext&&ext.name==='pg_stat_statements'&&ext.version==='1.11'&&ext.schema==='extensions'&&ext.relocatable===true&&owners.some(r=>r?.name===ext.owner),'fixed-upstream-statistics-extension-required');
 const views=Array.isArray(observed?.views)?observed.views:[];
 require(views.length===2&&sorted(views.map(v=>v?.name))===sorted(viewNames),'exact-statistics-view-set-required');
 for(const name of viewNames){const view=views.find(v=>v?.name===name);require(view&&view.schema==='extensions'&&view.kind==='v'&&view.extensionMember===true&&owners.some(r=>r?.name===view.owner)&&statisticsObjectDigest(view)===profile?.viewPins?.[name],'reviewed-statistics-view-mismatch:'+name);}
 const functions=Array.isArray(observed?.functions)?observed.functions:[];
 require(Array.isArray(functions)&&functions.length===Object.keys(profile?.functionPins??{}).length,'exact-statistics-function-set-required');
 for(const [signature,pin] of Object.entries(profile?.functionPins??{})){const f=functions.find(f=>f?.name+'('+f?.arguments+')'===signature);require(f&&f.schema==='extensions'&&f.extensionMember===true&&f.language==='c'&&f.securityDefiner===false&&owners.some(r=>r?.name===f.owner)&&statisticsObjectDigest(f)===pin,'reviewed-statistics-function-mismatch:'+signature);}
 const principals=Array.isArray(observed?.principals)?observed.principals:[];
 require(Array.isArray(observed?.principals)&&sorted(principals.map(p=>p?.name))===sorted([...new Set(principalNames)]),'exact-statistics-principal-audit-required');
 for(const p of principals??[]){
  if(!p||typeof p!=='object'){require(false,'valid-statistics-principal-required');continue;}
  require(p.readAllStatsUsage===false&&p.readAllStatsSet===false&&p.superuserSet===false&&p.controlPlaneSet===false&&p.resetExecute===false,'statistics-elevated-visibility-or-reset-forbidden:'+p.name);
  require(Array.isArray(p.views)&&p.views.length===2&&sorted(p.views.map(v=>v?.name))===sorted(viewNames)&&p.views.every(v=>v&&v.schema==='extensions'&&v.select===true&&v.selectGrantOption===false&&v.change===false),'statistics-select-only-required:'+p.name);
 }
 return {state:findings.length?'blocked':'reviewed-public-statistics-metadata-only',allowedRelations:findings.length?[]:viewNames.map(name=>'extensions.'+name),findings,activationAllowed:false};
}
/** Ordinary financial/unrelated-data guards remain unchanged. Only proven SELECT flags on two exact views are masked. */
export function validateDailyPreflightWithStatistics(observed,expected,statisticsObserved){
 if(expected?.statisticsCompatibility===undefined)return validateDailyCapabilityPreflight(observed,expected);
 const principals=[expected?.callerRole,expected?.ownerRole,...(expected?.memberships??[]).map(m=>m.member)];
 const statistics=validateStatisticsCompatibility(statisticsObserved,expected.statisticsCompatibility,principals);
 const allowed=statistics.allowedRelations;
 const selectOnlyBoundRow=row=>row&&Object.keys(row).length===8&&['principal','schema','name','kind','select','columnSelect','otherAuthority','selectGrantOption'].every(key=>Object.hasOwn(row,key))&&allowed.includes(key(row))&&row.kind==='v'&&principals.includes(row.principal)&&(row.select===true||row.columnSelect===true)&&row.otherAuthority===false&&row.selectGrantOption===false;
 const adjusted={...observed,
  boundLoginPrivileges:observed?.boundLoginPrivileges?.filter(row=>!selectOnlyBoundRow(row)),
  tables:observed?.tables?.map(table=>allowed.includes(key(table))&&table?.kind==='v'?{...table,callerSelect:false,callerColumnSelect:false,ownerSelect:false,ownerColumnSelect:false}:table),
 };
 const result=validateDailyCapabilityPreflight(adjusted,expected),findings=[...result.findings,...statistics.findings];
 return {...result,state:findings.length?'blocked':'catalog-ready-for-separate-approval',findings,statisticsCompatibility:statistics.state};
}
/** One parameterized statement provides one catalog snapshot, including immediately before dispatch. */
export async function prepareStatisticsCatalogQuery(ordinarySql,expected){
 const values=[expected.callerRole,expected.ownerRole,expected.managementRole?.name??null];
 if(expected.statisticsCompatibility===undefined)return {sql:ordinarySql,values};
 const marker="'kind',c.relkind)) FROM audited_principal x";
 if(ordinarySql.split(marker).length!==2)throw Error('Exact ordinary bound-login permission metadata required');
 const detailed=ordinarySql.replace(marker,()=>"'kind',c.relkind,'select',has_table_privilege(x.oid,c.oid,'SELECT'),'columnSelect',has_any_column_privilege(x.oid,c.oid,'SELECT'),'otherAuthority',has_table_privilege(x.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(x.oid,c.oid,'INSERT,UPDATE,REFERENCES'),'selectGrantOption',has_table_privilege(x.oid,c.oid,'SELECT WITH GRANT OPTION') OR has_any_column_privilege(x.oid,c.oid,'SELECT WITH GRANT OPTION'))) FROM audited_principal x");
 const stats=(await readFile(new URL('./daily-statistics-preflight.sql',import.meta.url),'utf8')).replaceAll('$1::text[]',()=>'$4::text[]');
 values.push([...new Set([expected.callerRole,expected.ownerRole,...(expected.memberships??[]).map(m=>m.member)])]);
 return {sql:`SELECT ordinary.preflight, statistics.statistics_preflight FROM (${detailed.trim().replace(/;$/,'')}) ordinary CROSS JOIN (${stats.trim().replace(/;$/,'')}) statistics`,values};
}
