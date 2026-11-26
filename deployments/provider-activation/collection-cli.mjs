import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {openSync,writeSync,closeSync,constants} from 'node:fs';
import {privateRead,privateDirectory,claimAttempt,receipt} from './collection-files.mjs';
import {runBoundCollection,guardPool,collectorDatabaseUrl} from './collection-run.mjs';
import {validateHostEnvironment} from './host-boundary.mjs';
const output=process.stdout.write.bind(process.stdout),error=process.stderr.write.bind(process.stderr);let fd;
try{
 const args=process.argv.slice(2);
 if(args.length===0)output('{"state":"disabled"}\n');
 else{
  if(args.length!==2||args[0]!=='--execute')throw Error();
  const b=JSON.parse(await privateRead(args[1]));
  validateHostEnvironment(`${b.provider}-collector`,process.env);
  // Inherited credentials are not an alternate configuration channel.
  if(Object.keys(process.env).some(k=>k.startsWith('NIGHT_SCOUT_')))throw Error();
  const config=JSON.parse(await privateRead(b.environmentFile));
  if(!config||Object.keys(config).some(k=>!['values','secretFiles','databaseCredentialFile','databaseConnection'].includes(k)))throw Error();
  const env=Object.assign(Object.create(null),config.values);
  if(Object.keys(env).some(k=>/DATABASE_URL|SECRET|MASTER_KEY|CA_PEM/.test(k)))throw Error();
  for(const [k,path]of Object.entries(config.secretFiles??{})){if(Object.hasOwn(env,k))throw Error();env[k]=await privateRead(path);}
  const dbKey=`NIGHT_SCOUT_${b.provider.toUpperCase()}_ADS_COLLECTOR_DATABASE_URL`;
  if(Object.hasOwn(env,dbKey))throw Error();
  env[dbKey]=collectorDatabaseUrl(b.provider,JSON.parse(await privateRead(config.databaseCredentialFile)),config.databaseConnection);
  await privateDirectory(b.privateDirectory);
  const cwd=fileURLToPath(new URL('../../',import.meta.url));
  const gitEnv={PATH:process.env.PATH,HOME:process.env.HOME};
  const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd,env:gitEnv,encoding:'utf8'}).trim();
  if(execFileSync('git',['status','--porcelain'],{cwd,env:gitEnv,encoding:'utf8'}).trim())throw Error();
  fd=openSync(join(b.privateDirectory,'collection-output.log'),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  process.stdout.write=process.stderr.write=(chunk,encoding,callback)=>{writeSync(fd,chunk);if(typeof encoding==='function')encoding();if(typeof callback==='function')callback();return true;};
  const result=await runBoundCollection({binding:b,env,sourceSha,claim:()=>claimAttempt(b.privateDirectory),writeReceipt:value=>receipt(b.privateDirectory,value),createRuntime:async(configured,binding)=>{
   const require=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url));const {Pool}=require('pg');
   const module=await import(`../../artifacts/api-server/src/lib/${binding.provider}-ads-collector-runtime.mjs`);
   const factory=binding.provider==='meta'?module.createMetaAdsCollectorRuntime:module.createGoogleAdsCollectorRuntime;
   return factory(configured,{createPool:options=>guardPool(new Pool(options),binding)});
  }});
  output(JSON.stringify(result)+'\n');if(result.state==='already_running')process.exitCode=1;
 }
}catch{error('Provider collection unavailable; inspect private state. No automatic retry.\n');process.exitCode=1;}
finally{process.stdout.write=output;process.stderr.write=error;if(fd!==undefined)closeSync(fd);}
