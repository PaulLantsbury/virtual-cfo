import {mkdir,readFile,readdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const source=dirname(fileURLToPath(import.meta.url));
/** Creates a standalone deployment tree, never imports the customer app. */
export async function prepareOperatorDeployment(target,{scheduleProfile='daily-20261015-v1'}={}){
 if(!['daily-20261015-v1','daily-20261029-v1'].includes(scheduleProfile))throw Error('Unknown operator profile');
 const output=resolve(target);if(output===source||output==='/' )throw Error('Separate operator output required');
 await mkdir(output,{recursive:true});
 const files=['shopify-operator-entry.mjs','run-provider-test-programme.mjs','provider-write-plan.mjs','provider-transport.mjs','provider-rpc-ledger.mjs','shopify-writer-token.mjs','writer-database-identity.mjs'];
 for(const name of files)await copyFile(join(source,name),join(output,name));
 const manifest=JSON.parse(await readFile(join(source,'shopify-operator.manifest.json'),'utf8'));
 await writeFile(join(output,'operator-package.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 manifest.scripts={start:'node shopify-operator-entry.mjs'};
 await writeFile(join(output,'package.json'),JSON.stringify(manifest,null,2)+'\n');
 await copyFile(join(source,'shopify-operator-pnpm-lock.yaml'),join(output,'pnpm-lock.yaml'));
 await writeFile(join(output,'shopify-programme.json'),JSON.stringify({provider:'shopify',target:'pocketlaunchpad1.myshopify.com',startMonday:scheduleProfile==='daily-20261029-v1'?'2026-10-26':'2026-10-12',programmeKey:scheduleProfile==='daily-20261029-v1'?'shopify-staging-20261029':'shopify-staging-20261012',scheduleProfile},null,2)+'\n');
 return {state:'operator_deployment_prepared',files:files.length,output};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(!process.argv[2])throw Error();const result=await prepareOperatorDeployment(process.argv[2],process.argv[3]?{scheduleProfile:process.argv[3]}:undefined);process.stdout.write(JSON.stringify({state:result.state,files:result.files})+'\n');}
 catch{process.stderr.write('Operator deployment preparation unavailable\n');process.exitCode=1;}
}
