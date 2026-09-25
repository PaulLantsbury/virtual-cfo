import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const frontendRoot=resolve(repositoryRoot,'artifacts/virtual-cfo');
const frontendRequire=createRequire(new URL('../virtual-cfo/package.json',import.meta.url));
const pnpmCommand=process.platform==='win32'?'pnpm.cmd':'pnpm';

function run(command,args,cwd=repositoryRoot,extraEnv={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,stdio:'inherit',env:{...process.env,...extraEnv}});
  child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(`${command} failed`)));
 });
}

await run(pnpmCommand,[
 'install','--frozen-lockfile','--prod=false',
 '--filter','@workspace/api-server...',
 '--filter','@workspace/virtual-cfo...'
]);
const viteBin=resolve(dirname(frontendRequire.resolve('vite/package.json')),'bin/vite.js');
await run(process.execPath,[viteBin,'build','--config','vite.config.ts'],frontendRoot,{PORT:process.env.PORT??'19234',BASE_PATH:'/'});
await run(process.execPath,['artifacts/api-server/build.mjs']);
