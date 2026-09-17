import {open,lstat,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {intakeConnectionOptions,INTAKE_TARGET} from './intake-runtime.mjs';
import {runDevelopmentIntake} from './run-development-intake.mjs';
import {inspectDevelopmentIntake} from './inspect-development-intake.mjs';
import {createOperatorSyncService} from './operator-sync-service.mjs';
import {startOperatorSyncServer} from './operator-sync-server.mjs';

const failure='Operator sync screen unavailable. Check the private configuration; no automatic collection or retry was requested.';
export function parseOperatorArguments(args){
 let configPath,accessFile,port=5190,portSeen=false;
 for(let i=0;i<args.length;i++){
  const value=args[i+1];
  if(args[i]==='--config'&&!configPath&&value&&!value.startsWith('--')){configPath=value;i++;}
  else if(args[i]==='--access-file'&&!accessFile&&value&&!value.startsWith('--')){accessFile=value;i++;}
  else if(args[i]==='--port'&&!portSeen&&/^\d+$/.test(value??'')){port=Number(value);portSeen=true;i++;}
  else throw Error(failure);
 }
 if(!configPath||!accessFile||!Number.isInteger(port)||port<1024||port>65535)throw Error(failure);
 return {configPath,accessFile,port};
}
export async function startOperatorSync({configPath,accessFile,port=5190},{check=runDevelopmentIntake,inspect=inspectDevelopmentIntake,createService=createOperatorSyncService,startServer=startOperatorSyncServer}={}){
 let server,access,accessIdentity;
 const removeOwnAccess=async()=>{if(!accessIdentity)return;try{const current=await lstat(accessFile);if(current.ino===accessIdentity.ino&&current.dev===accessIdentity.dev)await unlink(accessFile);}catch{}accessIdentity=undefined;};
 try{
  const file=await open(configPath,constants.O_RDONLY|constants.O_NOFOLLOW);let config;
  try{const s=await file.stat();if(!s.isFile()||(s.mode&0o077)!==0||s.uid!==process.getuid()||s.size>16384)throw Error(failure);config=JSON.parse(await file.readFile('utf8'));}finally{await file.close();}
  const {scope}=intakeConnectionOptions(config);
  await check({configPath,mode:'check'});
  // Exclusive creation prevents overwriting another running screen's access link.
  access=await open(accessFile,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  accessIdentity=await access.stat();
  const controller=createService({scope,
   runIntake:()=>check({configPath,mode:'record',confirmTarget:`${INTAKE_TARGET.projectRef}/${INTAKE_TARGET.storeId}`}),
   inspectCandidate:()=>inspect({configPath})});
  server=await startServer({controller,port});
  await access.writeFile(server.url+'\n');await access.close();access=undefined;
  const close=server.close;return {...server,close:async()=>{try{await close();}finally{await removeOwnAccess();}}};
 }catch{try{await access?.close();}catch{}try{await server?.close();}catch{}await removeOwnAccess();throw Error(failure);}
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
