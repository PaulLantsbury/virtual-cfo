import {readFileSync} from 'node:fs';
export const providerAccessAttestationSql=readFileSync(new URL('./provider-access-attestation.sql',import.meta.url),'utf8');
const counts=['schema_count','role_count','rpc_count'];
const booleans=['mode_valid','roles_complete','role_flags_safe','memberships_safe','ownership_safe','tables_safe','sequences_safe','schemas_safe','rpc_matrix_safe','function_config_safe','no_provider_sessions','report_contracts_safe','default_acls_safe','external_definers_safe','accepted'];
/** Inject an already authorised read-only executor. This module owns no connection. */
export async function attestProviderAccess(query,mode){
 if(typeof query!=='function'||!['absent','installed','disabled'].includes(mode))throw new Error('Provider access attestation unavailable');
 let result;
 try{result=await query(providerAccessAttestationSql,[mode]);}catch{throw new Error('Provider access attestation unavailable');}
 const row=result?.rows?.length===1?result.rows[0]:null;
 if(!row||Object.getPrototypeOf(row)!==Object.prototype||Object.keys(row).sort().join(',')!==[...counts,...booleans].sort().join(',')
   ||counts.some(k=>!Number.isSafeInteger(row[k])||row[k]<0)||booleans.some(k=>typeof row[k]!=='boolean'))throw new Error('Provider access attestation unavailable');
 return Object.freeze({mode,...row});
}
