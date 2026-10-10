import {open,lstat,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {intakeConnectionOptions,intakeDatabase,INTAKE_TARGET} from './intake-runtime.mjs';
import {runDevelopmentIntake} from './run-development-intake.mjs';
import {inspectDevelopmentIntake} from './inspect-development-intake.mjs';
import {createDurableSyncJournal,createJournaledOperatorSyncService} from './durable-sync-journal.mjs';
import {startOperatorSyncServer} from './operator-sync-server.mjs';

const failure='Operator sync screen unavailable. Check the private configuration; no automatic collection or retry was requested.';
export function parseOperatorArguments(args){
 let configPath,accessFile,port=5190,portSeen=false,durableHistory=false;
 for(let i=0;i<args.length;i++){
  const value=args[i+1];
  if(args[i]==='--config'&&!configPath&&value&&!value.startsWith('--')){configPath=value;i++;}
  else if(args[i]==='--access-file'&&!accessFile&&value&&!value.startsWith('--')){accessFile=value;i++;}
  else if(args[i]==='--durable-history'&&!durableHistory){durableHistory=true;}
  else if(args[i]==='--port'&&!portSeen&&/^\d+$/.test(value??'')){port=Number(value);portSeen=true;i++;}
  else throw Error(failure);
 }
 if(!configPath||!accessFile||!Number.isInteger(port)||port<1024||port>65535)throw Error(failure);
 return {configPath,accessFile,port,...(durableHistory?{durableHistory:true}:{})};
}
export async function startOperatorSync({configPath,accessFile,port=5190,durableHistory=false},{check=runDevelopmentIntake,inspect=inspectDevelopmentIntake,createService=createJournaledOperatorSyncService,startServer=startOperatorSyncServer,createPool}={}){
 let server,access,accessIdentity,journalPool;
 const removeOwnAccess=async()=>{if(!accessIdentity)return;try{const current=await lstat(accessFile);if(current.ino===accessIdentity.ino&&current.dev===accessIdentity.dev)await unlink(accessFile);}catch{}accessIdentity=undefined;};
 try{
  const file=await open(configPath,constants.O_RDONLY|constants.O_NOFOLLOW);let config;
  try{const s=await file.stat();if(!s.isFile()||(s.mode&0o077)!==0||s.uid!==process.getuid()||s.size>16384)throw Error(failure);config=JSON.parse(await file.readFile('utf8'));}finally{await file.close();}
  const options=intakeConnectionOptions(config),{scope}=options;
  await check({configPath,mode:'check'});
  // Exclusive creation prevents overwriting another running screen's access link.
  access=await open(accessFile,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  accessIdentity=await access.stat();
  let journal;
  if(durableHistory){
   if(!createPool){const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));const {Pool}=require('pg');createPool=o=>new Pool(o);}
   journalPool=createPool(options.pool);journal=createDurableSyncJournal(intakeDatabase(journalPool),{scope});
   await journal.latest(); // Fail closed if approved schema/access is not installed.
  }
  const controller=createService({scope,...(journal?{journal}:{}),
   runIntake:()=>check({configPath,mode:'record',confirmTarget:`${INTAKE_TARGET.projectRef}/${INTAKE_TARGET.storeId}`}),
   inspectCandidate:()=>inspect({configPath})});
  server=await startServer({controller,port});
  await access.writeFile(server.url+'\n');await access.close();access=undefined;
  const close=server.close;return {...server,close:async()=>{try{await close();}finally{try{await journalPool?.end();}finally{await removeOwnAccess();}}}};
 }catch{try{await access?.close();}catch{}try{await server?.close();}catch{}try{await journalPool?.end();}catch{}await removeOwnAccess();throw Error(failure);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const args=parseOperatorArguments(process.argv.slice(2));
  const running=await startOperatorSync(args);
  process.stdout.write(`Private operator screen listening on 127.0.0.1:${args.port}. Open the link in the private access file. Collection runs only when requested.\n`);
  const stop=()=>{void running.close().then(()=>process.exit(0));};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
 }catch{process.stderr.write(failure+'\n');process.exitCode=1;}
}
