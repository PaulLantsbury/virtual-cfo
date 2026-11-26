import {readFile,open,lstat,realpath,unlink} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {createHash,randomBytes,pbkdf2Sync,createHmac} from 'node:crypto';
import {attestProviderAccess} from '../../experiments/marketing/provider-access-attestation.mjs';

export const STAGING_PROJECT='bioalckltvkhlczusdvl';
export const SOURCE_REVISION='0e7f99fa5c963de5fe7f3a8f88ec99b180ce08a1';
export const SQL_INPUTS=Object.freeze([
 ['meta-ads-spend-store-2026-11-20.sql','7ee141420cf19081cf348984934618efb83eda02586385e4da2a1e47b48be9b3'],
 ['meta-ads-spend-rpcs-2026-11-20.sql','a6df957d7ed26249e937143e07d46da119c9943756367110064a23a1e9cddb2c'],
 ['meta-ads-spend-read-rpc-2026-11-20.sql','3d2367000859ff33f5644bd4aedf73b25137edde0d52ad0a66810f323be0ad80'],
 ['google-ads-spend-store-2026-11-21.sql','85732db026d4882591405d18b6cb41eddac979cb7b9840dcfedb5a3905ac8e86'],
 ['google-ads-spend-rpcs-2026-11-21.sql','d9ec68696a64d09d3ba3c799167826172692d68620a320e98d327fd069ddc3d4'],
 ['google-ads-spend-read-rpc-2026-11-21.sql','f7cb0ac6d0a4ea31075474f875938989d46a68650ddbd7285342288c21333e87'],
].map(Object.freeze));
export const CAPABILITIES=Object.freeze(['meta','google'].flatMap(provider=>['api','report','collector'].map(capability=>Object.freeze({provider,capability,group:`night_scout_${provider}_ads_${capability}_group`,login:`night_scout_${provider}_ads_${capability}_login`,file:`${provider}-${capability}.credential.json`}))));
const ensure=ok=>{if(!ok)throw new Error('Provider access request unavailable');};
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,160}$/.test(x);
export function accessPlan(){return Object.freeze({mode:'plan',sourceRevision:SOURCE_REVISION,sql:SQL_INPUTS,roles:CAPABILITIES,installation:'One same-session transaction; temporary passwordless LOGIN satisfies SQL guards; committed state NOLOGIN',credentials:'Separate approved secure delivery; no secret generation in plan/install',activation:'Separate capability-specific approval; no collector scheduling',cleanup:'Cancel/disconnect first under API approval; NOLOGIN, terminate sessions, verify; never drop history'});}
async function verifiedSql(read=readFile){return Promise.all(SQL_INPUTS.map(async([name,hash])=>{const text=await read(new URL(`../../db-migrations/proposals/${name}`,import.meta.url),'utf8');ensure(createHash('sha256').update(text).digest('hex')===hash);ensure((text.match(/^BEGIN;$/gm)||[]).length===1&&(text.match(/^COMMIT;$/gm)||[]).length===1);return text.replace(/^BEGIN;\r?\n/m,'').replace(/^COMMIT;\s*$/m,'');}));}
function authorize(options,operation){const a=options.approval;ensure(options.mode==='execute'&&a&&a.operation===operation&&a.sourceRevision===SOURCE_REVISION&&safeId(a.approvalRef)&&safeId(a.targetId)&&a.targetId===options.executorTargetId&&a.targetId===STAGING_PROJECT&&a.environment==='staging'&&safeId(a.database)&&/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(a.definer)&&!a.definer.startsWith('night_scout_')&&typeof options.query==='function'&&a.loggingGatePassed===true);return a;}
async function lock(query){const r=await query('SELECT pg_try_advisory_xact_lock(684114,261126) AS acquired');ensure(r.rows?.[0]?.acquired===true);}
async function identity(query,a){const r=await query('SELECT current_database() AS database, current_user AS definer, session_user AS session_user');ensure(r.rows?.length===1&&r.rows[0].database===a.database&&r.rows[0].definer===a.definer&&r.rows[0].session_user===a.definer);}
async function transaction(query,action){await query('BEGIN');let commitAttempted=false;try{const result=await action();commitAttempted=true;await query('COMMIT');return result;}catch{try{await query('ROLLBACK');}catch{throw new Error('Provider transaction outcome uncertain; stop for private operator recovery');}if(commitAttempted)throw new Error('Provider transaction outcome uncertain; stop for private operator recovery');throw new Error('Provider operation rejected and transaction rolled back');}}
async function internalinstallAccess(options={}){
 if(options.mode!=='execute')return accessPlan();
 const a=authorize(options,'install'),query=options.query,sql=await verifiedSql(options.readSql??readFile);await identity(query,a);
 return transaction(query,async()=>{
  // Serialize these installers; do not retry if another operator is active.
  const lock=await query("SELECT pg_try_advisory_xact_lock(684114,261126) AS acquired");ensure(lock.rows?.[0]?.acquired===true);
  ensure((await attestProviderAccess(query,'absent')).accepted);
  for(const c of CAPABILITIES){await query(`CREATE ROLE ${c.group} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);await query(`CREATE ROLE ${c.login} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL`);await query(`GRANT ${c.group} TO ${c.login}`);}
  for(const statement of sql)await query(statement);
  ensure((await attestProviderAccess(query,'installed')).accepted);
  // Functions must be owned by the reviewed installer, not a runtime role.
  const owners=await query("SELECT count(*)::integer AS mismatches FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname IN ('meta_ads_v1','google_ads_v1') AND r.rolname<>$1",[a.definer]);ensure(owners.rows?.[0]?.mismatches===0);
  for(const c of CAPABILITIES)await query(`ALTER ROLE ${c.login} NOLOGIN`);
  ensure((await attestProviderAccess(query,'disabled')).accepted);
  return Object.freeze({state:'installed-disabled',sourceRevision:SOURCE_REVISION,schemas:2,roles:12,callableRpcs:32});
 });
}
function scram(password){const salt=randomBytes(16),iterations=4096,salted=pbkdf2Sync(password,salt,iterations,32,'sha256'),client=createHmac('sha256',salted).update('Client Key').digest(),stored=createHash('sha256').update(client).digest('base64'),server=createHmac('sha256',salted).update('Server Key').digest('base64');return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${stored}:${server}`;}
async function privateDirectory(path){ensure(typeof path==='string'&&isAbsolute(path)&&await realpath(path)===resolve(path));const s=await lstat(path);ensure(s.isDirectory()&&!s.isSymbolicLink()&&(s.mode&0o077)===0&&(typeof process.getuid!=='function'||s.uid===process.getuid()));}
async function internaldeliverCredentials(options={}){
 if(options.mode!=='execute')return accessPlan();const a=authorize(options,'credentials'),query=options.query;
 ensure(a.privateDirectory===options.privateDirectory&&a.noExistingCredentialsConfirmed===true);await privateDirectory(options.privateDirectory);await identity(query,a);await verifiedSql(options.readSql??readFile);
 const created=[];let committed=false;
 try{
  const result=await transaction(query,async()=>{
   await lock(query);ensure((await attestProviderAccess(query,'disabled')).accepted);
   // No replacement/rotation in this first-delivery operation.
   const existing=await query("SELECT count(*)::integer AS existing FROM pg_authid WHERE rolname=ANY($1::text[]) AND rolpassword IS NOT NULL",[CAPABILITIES.map(c=>c.login)]);ensure(existing.rows?.[0]?.existing===0);
   for(const c of CAPABILITIES){
    const password=randomBytes(32).toString('base64url'),path=join(options.privateDirectory,c.file),verifier=scram(password);
    const handle=await open(path,'wx',0o600);created.push(path);
    try{await handle.chmod(0o600);await handle.writeFile(JSON.stringify({version:1,provider:c.provider,capability:c.capability,username:c.login,password})+'\n');await handle.sync();}finally{await handle.close();}
    // Only a SCRAM verifier reaches SQL; it is still sensitive and must not be logged.
    ensure(/^[A-Za-z0-9+/=:$-]+$/.test(verifier));await query(`ALTER ROLE ${c.login} PASSWORD '${verifier}'`);
   }
   ensure((await attestProviderAccess(query,'disabled')).accepted);return Object.freeze({state:'credentials-delivered-disabled',files:CAPABILITIES.map(c=>c.file)});
  });committed=true;return result;
 }catch(error){
  // On an uncertain commit/rollback preserve files for operator reconciliation.
  if(error.message.includes('outcome uncertain'))throw error;
  let removed=true;if(!committed)for(const path of created)try{await unlink(path);}catch{removed=false;}
  if(!removed)throw new Error('Credential delivery failed; private file cleanup requires operator recovery');
  throw new Error('Credential delivery rejected; no activation performed');
 }
}
async function internaldisableAccess(options={}){
 if(options.mode!=='execute')return accessPlan();const a=authorize(options,'disable'),query=options.query;
 ensure(a.pendingConnectionsCleaned===true&&a.collectorsStopped===true&&a.sessionVisibilityConfirmed===true);await identity(query,a);
 // Disabling is committed before terminating pre-existing sessions.
 await transaction(query,async()=>{await lock(query);for(const c of CAPABILITIES)await query(`ALTER ROLE ${c.login} NOLOGIN`);});
 try{await query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename=ANY($1::text[]) AND pid<>pg_backend_pid()',[CAPABILITIES.map(c=>c.login)]);ensure((await attestProviderAccess(query,'disabled')).accepted);return Object.freeze({state:'disabled-no-visible-sessions',externalGrantRevocation:'separate',history:'preserved'});}catch{throw new Error('Logins disabled; session cleanup unverified, stop for private operator recovery');}
}
async function internalactivateAccess(options={}){
 if(options.mode!=='execute')return accessPlan();const a=authorize(options,'activate'),query=options.query;
 const validList=value=>Array.isArray(value)&&value.length<=6&&new Set(value).size===value.length&&value.every(name=>CAPABILITIES.some(c=>`${c.provider}-${c.capability}`===name));
 ensure(validList(a.capabilities)&&a.capabilities.length>0&&validList(a.expectedActiveCapabilities)&&a.expectedActiveCapabilities.every(c=>a.capabilities.includes(c))&&a.installedBodiesVerified===true&&a.hostSeparationVerified===true);
 const selected=CAPABILITIES.filter(c=>a.capabilities.includes(`${c.provider}-${c.capability}`));if(selected.some(c=>c.capability==='collector'))ensure(a.boundedOneShot===true);
 await identity(query,a);
 return transaction(query,async()=>{
  await lock(query);
  const current=await query('SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname=ANY($1::text[])',[CAPABILITIES.map(c=>c.login)]);ensure(current.rows?.length===6&&CAPABILITIES.every(c=>current.rows.some(r=>r.rolname===c.login&&r.rolcanlogin===a.expectedActiveCapabilities.includes(`${c.provider}-${c.capability}`))));
  const credentialed=await query('SELECT count(*)::integer AS n FROM pg_authid WHERE rolname=ANY($1::text[]) AND rolpassword IS NOT NULL',[selected.map(c=>c.login)]);ensure(credentialed.rows?.[0]?.n===selected.length);
  // This transaction-local LOGIN shape lets the combined checker verify all capabilities;
  // unused logins are restored NOLOGIN before COMMIT, never externally exposed.
  for(const c of CAPABILITIES)await query(`ALTER ROLE ${c.login} LOGIN`);
  ensure((await attestProviderAccess(query,'installed')).accepted);
  for(const c of CAPABILITIES.filter(c=>!selected.includes(c)))await query(`ALTER ROLE ${c.login} NOLOGIN`);
  return Object.freeze({state:'selected-logins-enabled',capabilities:[...a.capabilities],providerCalls:0,runtimeFlagsChanged:0});
 });
}
function internalvalidateOperatorBinding(binding,value){
 ensure(binding?.approval?.targetId===STAGING_PROJECT&&binding.targetId===STAGING_PROJECT&&binding.approval.environment==='staging');
 const url=new URL(value),role=binding.approval.definer;
 ensure(/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(role)&&!role.startsWith('night_scout_')&&['postgres:','postgresql:'].includes(url.protocol)&&url.port==='5432'&&url.pathname==='/postgres'&&binding.approval.database==='postgres'&&!url.search&&!url.hash&&!!url.password);
 const direct=url.hostname===`db.${STAGING_PROJECT}.supabase.co`&&decodeURIComponent(url.username)===role;
 const pooled=url.hostname==='aws-1-eu-west-1.pooler.supabase.com'&&decodeURIComponent(url.username)===`${role}.${STAGING_PROJECT}`;
 ensure(direct||pooled);return url;
}

const safeErrors=new Set(['Provider access request unavailable','Provider transaction outcome uncertain; stop for private operator recovery','Provider operation rejected and transaction rolled back','Credential delivery failed; private file cleanup requires operator recovery','Credential delivery rejected; no activation performed','Logins disabled; session cleanup unverified, stop for private operator recovery']);
async function safeCall(fn,options){try{return await fn(options);}catch(error){throw new Error(safeErrors.has(error?.message)?error.message:'Provider access operation unavailable; stop for private operator recovery');}}
export const installAccess=options=>safeCall(internalinstallAccess,options);
export const deliverCredentials=options=>safeCall(internaldeliverCredentials,options);
export const activateAccess=options=>safeCall(internalactivateAccess,options);
export const disableAccess=options=>safeCall(internaldisableAccess,options);

export function validateOperatorBinding(binding,value){try{return internalvalidateOperatorBinding(binding,value);}catch{throw new Error('Provider access request unavailable');}}
