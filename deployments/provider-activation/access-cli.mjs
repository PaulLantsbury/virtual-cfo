#!/usr/bin/env node
// Plan prints no bindings. Execution loads only explicitly approved private local files.
import {open,lstat,realpath} from 'node:fs/promises';
import {isAbsolute,resolve,dirname} from 'node:path';
import {constants} from 'node:fs';
import {createRequire} from 'node:module';
import {accessPlan,installAccess,deliverCredentials,activateAccess,disableAccess,validateOperatorBinding} from './access-plan.mjs';
const commands={install:installAccess,deliver:deliverCredentials,activate:activateAccess,disable:disableAccess};
async function privateRead(path){
 if(typeof path!=='string'||!isAbsolute(path)||await realpath(path)!==resolve(path))throw Error();
 const parent=await lstat(dirname(path));if(!parent.isDirectory()||(parent.mode&0o077)!==0||(process.getuid&&parent.uid!==process.getuid()))throw Error();
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const s=await handle.stat();if(!s.isFile()||(s.mode&0o077)!==0||s.size>65536||(process.getuid&&s.uid!==process.getuid()))throw Error();const text=await handle.readFile('utf8');if(Buffer.byteLength(text)>65536)throw Error();return text;}finally{await handle.close();}
}
const args=process.argv.slice(2);let client;
try{
 if(args.length===0||(args.length===1&&args[0]==='plan'))process.stdout.write(JSON.stringify(accessPlan(),null,2)+'\n');
 else{
  if(args.length!==2||args[1]!=='--execute'||!commands[args[0]]||process.env.NIGHT_SCOUT_PROVIDER_ACCESS_EXECUTE!=='true')throw Error();
  const binding=JSON.parse(await privateRead(process.env.NIGHT_SCOUT_PROVIDER_ACCESS_BINDING_FILE));
  const url=validateOperatorBinding(binding,(await privateRead(binding.databaseUrlSecretFile)).trim());
  const ca=await privateRead(binding.caFile);
  const require=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url));const {Client}=require('pg');
  client=new Client({connectionString:url.href,ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:10000,statement_timeout:60000,application_name:'night-scout-provider-access-operator'});
  await client.connect();
  const result=await commands[args[0]]({mode:'execute',query:(sql,params)=>client.query(sql,params),approval:binding.approval,executorTargetId:binding.targetId,privateDirectory:binding.privateDirectory});
  process.stdout.write(JSON.stringify(result)+'\n');
 }
}catch{
 process.stderr.write('Provider access operation unavailable; stop and inspect private operator state. No automatic retry.\n');process.exitCode=1;
}finally{if(client)try{await client.end();}catch{process.exitCode=1;}}
