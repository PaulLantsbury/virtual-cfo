import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const frontendRoot=resolve(repositoryRoot,'artifacts/virtual-cfo');
const frontendRequire=createRequire(new URL('../virtual-cfo/package.json',import.meta.url));
const pnpmCommand=process.platform==='win32'?'pnpm.cmd':'pnpm';
const allowedEnvironment=new Set([
 'PATH','HOME','TMPDIR','TMP','TEMP','XDG_CACHE_HOME','PNPM_HOME','COREPACK_HOME',
 'CI','NODE_ENV','NODE_OPTIONS','SSL_CERT_FILE','NODE_EXTRA_CA_CERTS',
 'HTTP_PROXY','HTTPS_PROXY','NO_PROXY','http_proxy','https_proxy','no_proxy',
 'NPM_CONFIG_REGISTRY','npm_config_registry','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY'
]);
const buildEnvironment=Object.fromEntries(Object.entries(process.env).filter(([name])=>allowedEnvironment.has(name)));

function run(command,args,cwd=repositoryRoot,extraEnv={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,stdio:'inherit',env:{...buildEnvironment,...extraEnv}});
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
