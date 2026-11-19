/** Test tooling only. Requires explicitly selected PostgreSQL 17 binaries/share files. */
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
export function dailyTestPostgres(){
 const bin=process.env.NIGHT_SCOUT_TEST_PG_BIN,share=process.env.NIGHT_SCOUT_TEST_PG_SHARE;
 if(!bin||!share||!isAbsolute(bin)||!isAbsolute(share))throw Error('Explicit absolute NIGHT_SCOUT_TEST_PG_BIN and NIGHT_SCOUT_TEST_PG_SHARE required');
 if(!/^postgres \(PostgreSQL\) 17\./.test(execFileSync(join(bin,'postgres'),['--version'],{encoding:'utf8'})))throw Error('PostgreSQL 17 test runtime required');
 return {bin:bin.replace(/\/$/,'')+'/',share};
}
export async function mkdtempTest(prefix){
 if(!/^[a-z0-9-]+$/.test(prefix))throw Error('Fixed test prefix required');
 const root='/tmp/night-scout';await mkdir(root,{recursive:true,mode:0o700});
 return mkdtemp(join(root,prefix));
}
