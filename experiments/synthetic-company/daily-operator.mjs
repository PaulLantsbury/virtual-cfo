/** Disabled-by-default native Node operator. No environment bindings, scheduler or retry loop. */
import {readFile,open,lstat,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute,resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {validateDailyCapabilityPreflight} from './daily-capability-preflight.mjs';
import {addDays,date} from './generator.mjs';
import {RESERVED_SYNTHETIC_IDENTITY as identity} from './staging-payload.mjs';
export const OPERATOR_PURPOSE='night-scout-synthetic-daily-operator-v1';
export const OPERATOR_LIMITS=Object.freeze({connectionMs:5000,lockMs:5000,statementMs:60000,queryMs:65000,processMs:120000,idleTransactionMs:10000});
const repoRoot=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url));
const ensure=(v,code)=>{if(!v){const error=new Error(code);error.operatorErrorClass='operator-refused';throw error;}};
const ownKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k));
export const OPERATOR_CLOCK_SQL=`WITH stamp AS MATERIALIZED (SELECT pg_catalog.clock_timestamp() value)
SELECT value::text server_now,(value AT TIME ZONE 'Europe/London')::date::text london_day,
 ((value AT TIME ZONE 'Europe/London')::date-1)::text cutoff,
 extract(hour FROM value AT TIME ZONE 'Europe/London')::int london_hour,
 extract(minute FROM value AT TIME ZONE 'Europe/London')::int london_minute FROM stamp`;
const SETTINGS_SQL="SELECT set_config('search_path','pg_catalog',false),set_config('statement_timeout','60000',false),set_config('lock_timeout','5000',false),set_config('idle_in_transaction_session_timeout','10000',false),set_config('default_transaction_read_only','on',false)";
const IDENTITY_SQL="SELECT current_user AS current_role,session_user AS session_role,current_setting('server_version_num')::int AS server_version";
const INSPECT_SQL='SELECT finance_daily_v1.inspect_daily_receipt($1::date) AS result';
const APPEND_SQL='SELECT finance_daily_v1.append_completed_day($1::date,$2::date) AS result';
export function validateOperatorBinding(binding){
 ensure(ownKeys(binding,['purpose','syntheticOnly','scope','connection','expected','approvedDay','expectedThrough','initialThrough','ceiling','appendApproved']),'exact-private-binding-shape-required');
 ensure(binding.purpose===OPERATOR_PURPOSE&&binding.syntheticOnly===true,'reviewed-synthetic-binding-required');
 const scope=binding.scope,fixed={storeId:identity.storeId,profile:'uk-gifts-v2',edition:'synthetic-history-v2-2026-11',anchor:'2024-11-01',currency:'GBP',timezone:'Europe/London'};ensure(ownKeys(scope,Object.keys(fixed))&&Object.entries(fixed).every(([key,value])=>scope[key]===value),'fixed-synthetic-programme-scope-required');
 for(const key of ['approvedDay','expectedThrough','initialThrough','ceiling'])date(binding[key]);
 ensure(binding.initialThrough>='2024-11-01'&&binding.initialThrough<=binding.expectedThrough&&addDays(binding.expectedThrough,1)===binding.approvedDay&&binding.approvedDay<=binding.ceiling,'reviewed-contiguous-bounded-day-required');
 const c=binding.connection;ensure(ownKeys(c,['host','port','database','user','password','ssl']),'explicit-connection-fields-required');
 for(const key of ['host','database','user'])ensure(typeof c[key]==='string'&&c[key].length>0&&!/[\r\n\0]/.test(c[key]),'explicit-connection-field-required');
 ensure(Number.isInteger(c.port)&&c.port>0&&c.port<65536&&typeof c.password==='string','explicit-port-and-password-required');
 ensure(c.host.startsWith('/')?c.ssl===false:c.ssl?.rejectUnauthorized===true&&ownKeys(c.ssl,['rejectUnauthorized','ca']),'verified-tls-or-private-socket-required');
 ensure(binding.expected&&new Set([binding.expected.callerRole,binding.expected.ownerRole,binding.expected.schemaOwner]).size===3&&[binding.expected.callerRole,binding.expected.ownerRole,binding.expected.schemaOwner].every(v=>typeof v==='string'&&v.length>0)&&c.user!==binding.expected.ownerRole&&c.user!==binding.expected.schemaOwner&&c.user!==binding.expected.callerRole,'runtime-login-must-not-be-owner-or-invoker');
 ensure(binding.expected.memberships?.length===1&&binding.expected.memberships[0].role===binding.expected.callerRole&&binding.expected.memberships[0].member===c.user&&binding.expected.memberships[0].adminOption===false&&binding.expected.memberships[0].inheritOption===false&&binding.expected.memberships[0].setOption===true,'exact-reviewed-login-membership-required');
 return binding;
}
export async function readPrivateOperatorBinding(path){
 ensure(typeof path==='string'&&isAbsolute(path),'absolute-private-binding-file-required');
 const rel=relative(repoRoot,await realpath(path));ensure(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel),'binding-must-be-outside-source-tree');
 const info=await lstat(path);ensure(info.isFile()&&!info.isSymbolicLink()&&(info.mode&0o177)===0&&info.size<=1048576&&info.uid===process.getuid(),'private-owner-only-regular-binding-file-required');
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=await file.stat();ensure(stat.ino===info.ino&&stat.dev===info.dev&&stat.isFile()&&(stat.mode&0o177)===0&&stat.uid===process.getuid(),'private-binding-file-changed');return validateOperatorBinding(JSON.parse(await file.readFile('utf8')));}finally{await file.close();}
}
export function operatorClientConfig(binding){
 const c=binding.connection;return {host:c.host,port:c.port,database:c.database,user:c.user,
 // An explicit password function prevents pg's environment/pgpass credential fallback, including local trust fixtures.
 password:async()=>c.password,ssl:c.ssl,client_encoding:'UTF8',replication:'false',
 application_name:OPERATOR_PURPOSE,fallback_application_name:OPERATOR_PURPOSE,
 options:'-c search_path=pg_catalog -c default_transaction_read_only=on',
 connectionTimeoutMillis:OPERATOR_LIMITS.connectionMs,statement_timeout:OPERATOR_LIMITS.statementMs,
 lock_timeout:OPERATOR_LIMITS.lockMs,idle_in_transaction_session_timeout:OPERATOR_LIMITS.idleTransactionMs,
 query_timeout:OPERATOR_LIMITS.queryMs,keepAlive:true};
}
const nativeClient=binding=>{const {Client}=require('pg');return new Client(operatorClientConfig(binding));};
function clockContext(row){
 ensure(row&&Number.isFinite(Date.parse(row.server_now)),'trusted-server-clock-required');date(row.london_day);date(row.cutoff);
 ensure(addDays(row.cutoff,1)===row.london_day&&Number.isInteger(row.london_hour)&&Number.isInteger(row.london_minute),'trusted-london-cutoff-required');
 return {day:row.cutoff,londonDay:row.london_day,inWindow:row.london_hour===2&&row.london_minute>=0&&row.london_minute<=14};
}
function verifyProgramme(programme,binding,receiptState,mode){
 const expected={...binding.scope,initialThrough:binding.initialThrough,ceiling:binding.ceiling};
 ensure(programme&&Object.entries(expected).every(([key,value])=>programme[key]===value)&&typeof programme.enabled==='boolean','actual-programme-scope-or-horizon-differs');
 date(programme.currentThrough);ensure(programme.currentThrough>=binding.initialThrough&&programme.currentThrough<=binding.ceiling,'actual-programme-horizon-outside-review');
 if(mode==='append'){ensure(programme.enabled===true,'actual-programme-disabled');if(receiptState==='absent-review-before-retry')ensure(programme.currentThrough===binding.expectedThrough,'actual-programme-horizon-differs');}
}
/** Dependency injection is test-only; CLI exposes no clock, SQL, capability name or owner override. */
export async function operateDaily({enabled=false,mode='inspect',binding}={}, {createClient=nativeClient}={}){
 ensure(['inspect','append'].includes(mode),'inspect-or-append-mode-required');if(!enabled)return {state:'disabled',mode,connections:0};
 validateOperatorBinding(binding);ensure(mode!=='append'||binding.appendApproved===true,'separate-append-approval-required');
 let client,transaction=false,appendAttempted=false,day=binding.approvedDay,deadline,expired=false;
 try{
 client=createClient(binding);ensure(client&&typeof client.connect==='function','native-client-required');client.on?.('error',()=>{});
 deadline=setTimeout(()=>{expired=true;void client.end().catch(()=>{});},OPERATOR_LIMITS.processMs);deadline.unref?.();
 await client.connect();await client.query(SETTINGS_SQL);
 const initial=(await client.query(IDENTITY_SQL)).rows[0];ensure(initial?.session_role===binding.connection.user&&initial.current_role===binding.connection.user&&initial.server_version>=170000&&initial.server_version<180000,'exact-reviewed-pg17-login-required');
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');transaction=true;
 const sql=await readFile(new URL('./daily-capability-preflight.sql',import.meta.url),'utf8');
 const catalog=(await client.query(sql,[binding.expected.callerRole,binding.expected.ownerRole])).rows[0]?.preflight;
 const preflight=validateDailyCapabilityPreflight(catalog,binding.expected);if(preflight.state!=='catalog-ready-for-separate-approval'){const error=new Error('candidate-catalog-or-membership-preflight-blocked');error.operatorFindings=preflight.findings;throw error;}
 await client.query("SELECT set_config('role',$1,false)",[binding.expected.callerRole]);
 const effective=(await client.query(IDENTITY_SQL)).rows[0];ensure(effective?.current_role===binding.expected.callerRole&&effective.session_role===binding.connection.user,'restricted-effective-invoker-required');
 const stamp=clockContext((await client.query(OPERATOR_CLOCK_SQL)).rows[0]);
 const receipt=(await client.query(INSPECT_SQL,[day])).rows[0]?.result;ensure(['committed-reconciled','absent-review-before-retry'].includes(receipt?.state),'exact-receipt-inspection-required');
 verifyProgramme(receipt.programme,binding,receipt.state,mode);
 if(mode==='inspect'){await client.query('COMMIT');transaction=false;return {state:receipt.state,mode,day,mutationAttempted:false,publication:receipt.publication??null,inspectedAt:receipt.inspectedAt??null,receiptRunId:receipt.receipt?.runId??null};}
 if(stamp.day!==day||!stamp.inWindow){await client.query('COMMIT');transaction=false;return {state:stamp.day===day?'outside-london-window':'cutoff-or-gap-review',mode,day,mutationAttempted:false};}
 if(binding.expectedThrough>binding.initialThrough){const prior=(await client.query(INSPECT_SQL,[binding.expectedThrough])).rows[0]?.result;ensure(prior?.state==='committed-reconciled','previous-contiguous-receipt-required');}
 if(receipt.state==='committed-reconciled'){await client.query('COMMIT');transaction=false;return {state:'already-recorded-inspect',mode,day,mutationAttempted:false,publication:receipt.publication??null,inspectedAt:receipt.inspectedAt??null,receiptRunId:receipt.receipt?.runId??null};}
 await client.query('COMMIT');transaction=false;
 await client.query('BEGIN READ WRITE');transaction=true;
 const currentCatalog=(await client.query(sql,[binding.expected.callerRole,binding.expected.ownerRole])).rows[0]?.preflight;ensure(validateDailyCapabilityPreflight(currentCatalog,binding.expected).state==='catalog-ready-for-separate-approval','candidate-changed-before-dispatch');
 const fresh=clockContext((await client.query(OPERATOR_CLOCK_SQL)).rows[0]);ensure(!expired&&fresh.day===stamp.day&&fresh.londonDay===stamp.londonDay&&fresh.inWindow,'server-cutoff-changed-before-dispatch');
 appendAttempted=true;const result=(await client.query(APPEND_SQL,[binding.expectedThrough,day])).rows[0]?.result;
 ensure(result?.state==='committed-reconciled','append-postflight-required');await client.query('COMMIT');transaction=false;
 return {state:'committed-reconciled',mode,day,mutationAttempted:true,replay:result.replay===true,publication:result.publication??null,inspectedAt:result.inspectedAt??null,receiptRunId:result.receipt?.runId??null};
 }catch(error){if(transaction&&client){try{await client.query('ROLLBACK');}catch{}}
 if(error&&typeof error==='object'){error.operatorErrorClass=appendAttempted?'unknown-outcome-inspect-independently':error.operatorErrorClass??'operator-blocked';error.operatorDay=day;error.mutationAttempted=appendAttempted;}
 throw error;
 }finally{clearTimeout(deadline);if(client){try{await client.end();}catch{}}}
}
export async function dailyOperatorCli(argv=process.argv.slice(2)){
 const options={enabled:false,mode:'inspect'};let bindingPath;
 for(const arg of argv){if(arg==='--enabled')options.enabled=true;else if(arg.startsWith('--mode='))options.mode=arg.slice(7);else if(arg.startsWith('--binding-file='))bindingPath=arg.slice(15);else ensure(false,'unsupported-operator-option');}
 if(options.enabled){ensure(process.versions.node==='24.21.0','reviewed-node-24.21.0-required');options.binding=await readPrivateOperatorBinding(bindingPath);}
 return operateDaily(options);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 dailyOperatorCli().then(result=>process.stdout.write(JSON.stringify(result)+'\n')).catch(error=>{process.stderr.write(JSON.stringify({state:'operator-stopped',errorClass:error.operatorErrorClass??'operator-refused',day:error.operatorDay??null,mutationAttempted:error.mutationAttempted===true})+'\n');process.exitCode=1;});
}
