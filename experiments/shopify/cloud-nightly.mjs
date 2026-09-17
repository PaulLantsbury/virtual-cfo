import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {X509Certificate} from 'node:crypto';
import {INTAKE_TARGET,intakeConnectionOptions} from './intake-runtime.mjs';
const execute=promisify(execFile);
const target=`${INTAKE_TARGET.projectRef}/${INTAKE_TARGET.storeId}`;
const missed='Cloud nightly start was outside the allowed nightly window. No collection was attempted; inspect the schedule before another run.';
const failure='Cloud nightly configuration failed or execution outcome is unconfirmed. Inspect durable history before retrying; no automatic retry was attempted.';
const ensure=ok=>{if(!ok)throw Error(failure);};
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const bounded=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\x00-\x20\x7f]/.test(v);
const instant=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v));
export function parseCloudNightlyArguments(args){
 let mode='check',seen=false,confirmTarget;
 for(let i=0;i<args.length;i++){
 if(['--check','--tick'].includes(args[i])&&!seen){mode=args[i].slice(2);seen=true;}
 else if(args[i]==='--confirm-target'&&confirmTarget===undefined&&args[i+1]&&!args[i+1].startsWith('--'))confirmTarget=args[++i];
 else throw Error(failure);
 }
 ensure(mode==='tick'?confirmTarget===target:confirmTarget===undefined);
 return {mode,confirmTarget};
}
function configuration(env){
 ensure(env.NIGHT_SCOUT_STAGING_PROJECT_REF===INTAKE_TARGET.projectRef&&bounded(env.NIGHT_SCOUT_INTAKE_DATABASE_URL,4096)&&bounded(env.NIGHT_SCOUT_SHOPIFY_CLIENT_ID,256)&&bounded(env.NIGHT_SCOUT_SHOPIFY_CLIENT_SECRET,4096));
 const scope={storeId:INTAKE_TARGET.storeId,shopId:INTAKE_TARGET.shopId,from:env.NIGHT_SCOUT_REPORT_FROM,to:env.NIGHT_SCOUT_REPORT_TO};
 ensure(day(scope.from)&&day(scope.to)&&scope.from<=scope.to&&(Date.parse(scope.to)-Date.parse(scope.from))/86400000<31);
 const config={projectRef:INTAKE_TARGET.projectRef,databaseUrl:env.NIGHT_SCOUT_INTAKE_DATABASE_URL,scope};
 intakeConnectionOptions(config); // Pins staging direct/session endpoint and dedicated login, validated TLS.
 const pem=env.NIGHT_SCOUT_STAGING_CA_PEM;ensure(typeof pem==='string'&&pem.length<=32768);
 const certs=pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
 ensure(certs?.length>0&&certs.length<=8&&certs.reduce((s,c)=>s.replace(c,''),pem).trim()==='');
 for(const cert of certs)ensure(new X509Certificate(cert).ca===true);
 return {config,pem,shop:{domain:INTAKE_TARGET.domain,shopId:INTAKE_TARGET.shopId,currency:INTAKE_TARGET.currency,timezone:INTAKE_TARGET.timezone,clientId:env.NIGHT_SCOUT_SHOPIFY_CLIENT_ID,clientSecret:env.NIGHT_SCOUT_SHOPIFY_CLIENT_SECRET}};
}
function safeReceipt(r,mode,scope){
 const states=mode==='check'?['prepared_not_installed']:['not_due','already_claimed','completed'];
 ensure(r&&typeof r==='object'&&!Array.isArray(r)&&states.includes(r.state)&&r.financeImported===false);
 const result={state:r.state,executionMode:mode,projectRef:INTAKE_TARGET.projectRef,storeId:scope.storeId,from:scope.from,to:scope.to,financeImported:false};
 if(r.localDate!==undefined){ensure(day(r.localDate));result.localDate=r.localDate;}
 if(r.scheduledAt!==undefined){ensure(instant(r.scheduledAt));result.scheduledAt=r.scheduledAt;}
 if(r.timezone!==undefined){ensure(r.timezone===INTAKE_TARGET.timezone);result.timezone=r.timezone;}
 if(r.due!==undefined){ensure(typeof r.due==='boolean');result.due=r.due;}
 if(r.state==='prepared_not_installed')ensure(r.from===scope.from&&r.to===scope.to);
 if(r.state==='completed'){
 ensure(['recorded_requires_review','changed_requires_review','replay','historical_replay','stale_source','conflicting_source','missing_source'].includes(r.resultCode)&&r.coverageCertified===false&&r.reviewRequired===true);
 result.resultCode=r.resultCode;result.coverageCertified=false;result.reviewRequired=true;
 }
 return result;
}
/** Explicit deployment-env adapter. Disabled unless exact opt-in is supplied.
 * Child starts with its CA setting and no inherited secrets/NODE_OPTIONS. Raw
 * child output is never forwarded. Timeout/exit/cleanup failures are uncertain.
 * This module neither uploads secrets nor installs a scheduler/deployment.
 */
export async function runCloudNightly({env=process.env,mode='check',confirmTarget}={}, {runChild=async({executable,args,environment,timeoutMs,maxBuffer})=>execute(executable,args,{env:environment,timeout:timeoutMs,maxBuffer,killSignal:'SIGKILL',encoding:'utf8'})}={}){
 let directory;
 try{
 ensure(['check','tick'].includes(mode)&&(mode==='tick'?confirmTarget===target:confirmTarget===undefined));
 ensure([undefined,'false','true'].includes(env.NIGHT_SCOUT_CLOUD_ENABLED));
 if(env.NIGHT_SCOUT_CLOUD_ENABLED!=='true')return {state:'disabled',executionMode:mode,writeAttempted:false};
 const {config,shop,pem}=configuration(env);
 directory=await mkdtemp(join(tmpdir(),'night-scout-cloud-'));await chmod(directory,0o700);
 const configPath=join(directory,'intake.json'),shopifyConfigPath=join(directory,'shopify.json'),caPath=join(directory,'staging-ca.pem');
 await writeFile(caPath,pem,{mode:0o600,flag:'wx'});await writeFile(shopifyConfigPath,JSON.stringify(shop),{mode:0o600,flag:'wx'});await writeFile(configPath,JSON.stringify({...config,shopifyConfigPath}),{mode:0o600,flag:'wx'});
 const args=[fileURLToPath(new URL('./nightly-development.mjs',import.meta.url)),'--config',configPath,`--${mode}`];
 if(mode==='tick')args.push('--confirm-target',target);
 const output=await runChild({executable:process.execPath,args,environment:{NODE_EXTRA_CA_CERTS:caPath,TZ:'UTC'},timeoutMs:300000,maxBuffer:32768});
 ensure(typeof output?.stdout==='string'&&output.stdout.length<=32768&&(!output.stderr||typeof output.stderr==='string'&&output.stderr.length<=32768));
 // Even warnings are withheld and fail closed rather than publishing arbitrary child text.
 ensure(!output.stderr?.trim());
 const receipt=safeReceipt(JSON.parse(output.stdout),mode,config.scope);
 if(mode==='tick'&&receipt.state==='not_due')throw Error(missed);
 return receipt;
 }catch(error){throw Error(error?.message===missed?missed:failure);}finally{if(directory)try{await rm(directory,{recursive:true,force:true});}catch{throw Error(failure);}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{process.stdout.write(JSON.stringify(await runCloudNightly(parseCloudNightlyArguments(process.argv.slice(2))))+'\n');}
 catch(error){process.stderr.write((error?.message===missed?missed:failure)+'\n');process.exitCode=1;}
}
