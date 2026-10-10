import {open,constants} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {intakeConnectionOptions,intakeDatabase,INTAKE_TARGET} from './intake-runtime.mjs';
import {runDevelopmentIntake} from './run-development-intake.mjs';
import {createNightlyRunner} from './nightly-runner.mjs';
import {nightlyPlan} from './nightly-plan.mjs';
const failure='Nightly check failed or outcome unconfirmed. Inspect configuration and durable history; do not retry a collection blindly.';
export function parseNightlyArguments(args){
 let configPath,confirmTarget,mode='check',seen=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--config'&&!configPath&&args[i+1]&&!args[i+1].startsWith('--'))configPath=args[++i];
  else if(args[i]==='--confirm-target'&&!confirmTarget&&args[i+1]&&!args[i+1].startsWith('--'))confirmTarget=args[++i];
  else if(['--check','--tick'].includes(args[i])&&!seen){mode=args[i].slice(2);seen=true;}
  else throw Error(failure);
 }
 if(!configPath||(mode==='tick'&&confirmTarget!==`${INTAKE_TARGET.projectRef}/${INTAKE_TARGET.storeId}`)||(mode==='check'&&confirmTarget))throw Error(failure);
 return {configPath,mode,confirmTarget};
}
/** One invocation only. Does not install an OS/cloud scheduler. */
export async function runNightlyDevelopment({configPath,mode='check',confirmTarget},{createPool,check=runDevelopmentIntake,now=()=>new Date()}={}){
 let pool;
 try{
  if(!['check','tick'].includes(mode)||(mode==='tick'&&confirmTarget!==`${INTAKE_TARGET.projectRef}/${INTAKE_TARGET.storeId}`)||(mode==='check'&&confirmTarget))throw Error(failure);
  const file=await open(configPath,constants.O_RDONLY|constants.O_NOFOLLOW);let config;
  try{const s=await file.stat();if(!s.isFile()||(s.mode&0o077)!==0||s.uid!==process.getuid()||s.size>16384)throw Error(failure);config=JSON.parse(await file.readFile('utf8'));}finally{await file.close();}
  const options=intakeConnectionOptions(config);await check({configPath,mode:'check'});
  if(!createPool){const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));const {Pool}=require('pg');createPool=o=>new Pool(o);}
  pool=createPool(options.pool);const db=intakeDatabase(pool);
  await db.transaction(async tx=>{await tx.query('SELECT id FROM ingest_v1.nightly_claims LIMIT 0');});
  if(mode==='check')return {state:'prepared_not_installed',...nightlyPlan(now(),INTAKE_TARGET.timezone),from:options.scope.from,to:options.scope.to,financeImported:false};
  return await createNightlyRunner({db,scope:options.scope,now,runIntake:()=>check({configPath,mode:'record',confirmTarget})}).tick();
 }catch{throw Error(failure);}finally{try{await pool?.end();}catch{throw Error(failure);}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{process.stdout.write(JSON.stringify(await runNightlyDevelopment(parseNightlyArguments(process.argv.slice(2))))+'\n');}catch{process.stderr.write(failure+'\n');process.exitCode=1;}}
