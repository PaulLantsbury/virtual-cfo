import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('Xero declaration boundaries and exact worker range compile without implicit-any escapes',()=>{
 const result=spawnSync(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'--noEmit','--strict','--target','es2022','--module','esnext','--moduleResolution','bundler','--types','node','--typeRoots',resolve(root,'artifacts/api-server/node_modules/@types'),'--skipLibCheck','false',resolve(root,'experiments/xero/type-contracts.test.ts')],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 assert.equal(result.error,undefined);assert.equal(result.status,0,[result.stdout,result.stderr].join('\n'));
});
