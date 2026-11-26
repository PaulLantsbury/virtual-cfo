import {open,lstat,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute,resolve,dirname,join} from 'node:path';
export async function privateDirectory(path){if(!isAbsolute(path)||await realpath(path)!==resolve(path))throw Error();const s=await lstat(path);if(!s.isDirectory()||(s.mode&0o777)!==0o700||s.uid!==process.getuid())throw Error();return path;}
export async function privateRead(path){if(typeof path!=='string'||!isAbsolute(path)||await realpath(path)!==resolve(path))throw Error();await privateDirectory(dirname(path));const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const s=await f.stat();if(!s.isFile()||(s.mode&0o777)!==0o600||s.uid!==process.getuid()||s.size>65536)throw Error();return await f.readFile('utf8');}finally{await f.close();}}
export async function claimAttempt(dir){await privateDirectory(dir);const f=await open(join(dir,'collection-attempt.json'),constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);await f.writeFile(JSON.stringify({state:'claimed-no-automatic-retry'}));await f.sync();await f.close();}
export async function receipt(dir,value){const f=await open(join(dir,'collection-receipt.json'),constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);try{await f.writeFile(JSON.stringify(value));await f.sync();}finally{await f.close();}}
