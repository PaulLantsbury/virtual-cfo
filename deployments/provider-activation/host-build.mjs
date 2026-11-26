import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const api=resolve(here,'../../artifacts/api-server');
const require=createRequire(resolve(api,'package.json'));
const {build}=require('esbuild');
await build({entryPoints:[resolve(here,'host-entry.ts')],outfile:resolve(here,'dist/host-entry.mjs'),bundle:true,platform:'node',format:'esm',nodePaths:[resolve(api,'node_modules')],external:['pg-native'],logLevel:'silent',banner:{js:"import {createRequire as __createRequire} from 'node:module'; const require=__createRequire(import.meta.url);"}});
console.log('Provider API host build complete');
