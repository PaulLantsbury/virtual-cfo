import {pathToFileURL} from 'node:url';
import {executeDemoReader} from './run-demo-refresh.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)try{process.stdout.write(JSON.stringify(await executeDemoReader({operation:'preflight',clock:()=>new Date()}))+'\n');}catch{process.stderr.write('Demo reader preflight unavailable\n');process.exitCode=1;}
