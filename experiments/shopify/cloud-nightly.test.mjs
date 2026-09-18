import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,access} from 'node:fs/promises';
import {dirname} from 'node:path';
import {rootCertificates} from 'node:tls';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {runCloudNightly,parseCloudNightlyArguments} from './cloud-nightly.mjs';
import {INTAKE_TARGET as target} from './intake-runtime.mjs';
const execute=promisify(execFile),confirmTarget=`${target.projectRef}/${target.storeId}`;
const environment=()=>({NIGHT_SCOUT_CLOUD_ENABLED:'true',NIGHT_SCOUT_STAGING_PROJECT_REF:target.projectRef,NIGHT_SCOUT_INTAKE_DATABASE_URL:`postgres://night_scout_intake_login:private-database-secret@db.${target.projectRef}.supabase.co/postgres`,NIGHT_SCOUT_SHOPIFY_CLIENT_ID:'synthetic-client',NIGHT_SCOUT_SHOPIFY_CLIENT_SECRET:'private-shop-secret',NIGHT_SCOUT_STAGING_CA_PEM:rootCertificates[0],NIGHT_SCOUT_REPORT_FROM:'2026-09-17',NIGHT_SCOUT_REPORT_TO:'2026-09-17',NODE_OPTIONS:'--require malicious',SUPABASE_SERVICE_ROLE_KEY:'not-to-be-forwarded'});
const check=()=>({state:'prepared_not_installed',from:'2026-09-17',to:'2026-09-17',financeImported:false,timezone:'Europe/London',localDate:'2026-09-17',scheduledAt:'2026-09-17T01:00:00.000Z',due:false,secret:'private-shop-secret'});
const completed=()=>({state:'completed',localDate:'2026-09-17',resultCode:'replay',financeImported:false,coverageCertified:false,reviewRequired:true});
test('disabled by default; argument gate defaults check and requires explicit fixed target for tick',async()=>{
 assert.equal(parseCloudNightlyArguments([]).mode,'check');assert.equal((await runCloudNightly({env:{}},{runChild:()=>assert.fail()})).state,'disabled');
 for(const args of [['--tick'],['--check','--tick'],['--confirm-target',confirmTarget],['--tick','--confirm-target','wrong'],['--config','private']])assert.throws(()=>parseCloudNightlyArguments(args));
 assert.equal(parseCloudNightlyArguments(['--tick','--confirm-target',confirmTarget]).mode,'tick');
});
test('private temporary files have minimal permissions; no secret environment inheritance or raw output forwarding',async()=>{
 let directory;const result=await runCloudNightly({env:environment()},{runChild:async({executable,args,environment:childEnv,timeoutMs,maxBuffer})=>{
 assert.equal(executable,process.execPath);assert.equal(args.at(-1),'--check');assert.equal(timeoutMs,300000);assert.equal(maxBuffer,32768);
 const path=args[2];directory=dirname(path);assert.equal((await stat(directory)).mode&0o777,0o700);assert.equal((await stat(path)).mode&0o777,0o600);
 const config=JSON.parse(await readFile(path,'utf8'));assert.equal(config.scope.storeId,target.storeId);assert.equal(config.projectRef,target.projectRef);assert.equal((await stat(config.shopifyConfigPath)).mode&0o777,0o600);assert.equal((await stat(childEnv.NODE_EXTRA_CA_CERTS)).mode&0o777,0o600);assert.deepEqual(Object.keys(childEnv).sort(),['NODE_EXTRA_CA_CERTS','TZ']);assert.equal(JSON.parse(await readFile(config.shopifyConfigPath,'utf8')).clientSecret,'private-shop-secret');
 return {stdout:JSON.stringify(check()),stderr:''};
 }});assert.equal(result.state,'prepared_not_installed');assert.ok(!JSON.stringify(result).includes('private-shop-secret'));await assert.rejects(access(directory));
});
test('rejects original project, broad role, altered host, unsafe TLS options, malformed CA and oversized or broad scope before spawning',async()=>{
 const base=environment();for(const patch of [{NIGHT_SCOUT_STAGING_PROJECT_REF:'futkktdebdygsdrcknpr'},{NIGHT_SCOUT_INTAKE_DATABASE_URL:base.NIGHT_SCOUT_INTAKE_DATABASE_URL.replace('night_scout_intake_login','postgres')},{NIGHT_SCOUT_INTAKE_DATABASE_URL:base.NIGHT_SCOUT_INTAKE_DATABASE_URL.replace('db.bio','evil.bio')},{NIGHT_SCOUT_INTAKE_DATABASE_URL:base.NIGHT_SCOUT_INTAKE_DATABASE_URL+'?sslmode=disable'},{NIGHT_SCOUT_STAGING_CA_PEM:'not a certificate'},{NIGHT_SCOUT_STAGING_CA_PEM:base.NIGHT_SCOUT_STAGING_CA_PEM+'SECRET'},{NIGHT_SCOUT_SHOPIFY_CLIENT_SECRET:'x'.repeat(4097)},{NIGHT_SCOUT_INTAKE_DATABASE_URL:'x'.repeat(4097)},{NIGHT_SCOUT_REPORT_TO:'2026-12-17'},{NIGHT_SCOUT_REPORT_FROM:'2026-02-30'},{NIGHT_SCOUT_CLOUD_ENABLED:'yes'}])await assert.rejects(runCloudNightly({env:{...base,...patch}},{runChild:()=>assert.fail()}),e=>e.message.includes('unconfirmed')&&!e.message.includes('SECRET'));
});
test('timeout, failed child, malformed output and warnings are sanitised and cleaned without retry',async()=>{
 for(const response of ['throw','json','warning','oversize']){let calls=0,directory;await assert.rejects(runCloudNightly({env:environment()},{runChild:async({args})=>{calls++;directory=dirname(args[2]);if(response==='throw')throw Error('ETIMEDOUT private-shop-secret');if(response==='json')return {stdout:'private invalid json',stderr:''};if(response==='warning')return {stdout:JSON.stringify(check()),stderr:'private warning'};return {stdout:'x'.repeat(32769),stderr:''};}}),e=>e.message.includes('unconfirmed')&&!e.message.includes('private-shop-secret'));assert.equal(calls,1);await assert.rejects(access(directory));}
});
test('tick delegates exact acknowledgement; late start is failure, existing claim is not reported completed',async()=>{
 for(const receipt of [completed(),{state:'already_claimed',localDate:'2026-09-17',financeImported:false}]){const r=await runCloudNightly({env:environment(),mode:'tick',confirmTarget},{runChild:async({args})=>{assert.deepEqual(args.slice(-3),['--tick','--confirm-target',confirmTarget]);return {stdout:JSON.stringify(receipt),stderr:''};}});assert.equal(r.state,receipt.state);assert.equal(r.executionMode,'tick');}
 await assert.rejects(runCloudNightly({env:environment(),mode:'tick',confirmTarget},{runChild:async()=>({stdout:JSON.stringify({state:'not_due',financeImported:false}),stderr:''})}),/outside the allowed nightly window/);
});
test('real synthetic Node child receives CA at startup and can read restricted files without inherited secrets',async()=>{
 let directory;const result=await runCloudNightly({env:environment()},{runChild:async({executable,args,environment:childEnv,timeoutMs,maxBuffer})=>{
 const path=args[2];directory=dirname(path);
 const script=`const fs=require('node:fs');const assert=require('node:assert/strict');assert.equal(process.env.NODE_OPTIONS,undefined);assert.equal(process.env.NIGHT_SCOUT_SHOPIFY_CLIENT_SECRET,undefined);assert.ok(process.env.NODE_EXTRA_CA_CERTS);const c=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));assert.equal(fs.statSync(process.argv[1]).mode&511,384);assert.equal(JSON.parse(fs.readFileSync(c.shopifyConfigPath,'utf8')).clientId,'synthetic-client');console.log(JSON.stringify({state:'prepared_not_installed',from:c.scope.from,to:c.scope.to,financeImported:false}));`;
 return execute(executable,['-e',script,path],{env:childEnv,timeout:Math.min(timeoutMs,5000),maxBuffer,encoding:'utf8'});
 }});assert.equal(result.state,'prepared_not_installed');await assert.rejects(access(directory));
});

test('cloud bootstrap accepts only the verified staging session pooler and passes it unchanged to the child',async()=>{
 const env=environment();env.NIGHT_SCOUT_INTAKE_DATABASE_URL=`postgresql://night_scout_intake_login.${target.projectRef}:synthetic@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
 const result=await runCloudNightly({env},{runChild:async({args})=>{const c=JSON.parse(await readFile(args[2],'utf8'));assert.equal(c.databaseUrl,env.NIGHT_SCOUT_INTAKE_DATABASE_URL);return {stdout:JSON.stringify(check()),stderr:''};}});
 assert.equal(result.state,'prepared_not_installed');
 for(const databaseUrl of [env.NIGHT_SCOUT_INTAKE_DATABASE_URL.replace(':5432',':6543'),env.NIGHT_SCOUT_INTAKE_DATABASE_URL.replace(target.projectRef,'futkktdebdygsdrcknpr'),env.NIGHT_SCOUT_INTAKE_DATABASE_URL+'?sslmode=disable'])await assert.rejects(runCloudNightly({env:{...env,NIGHT_SCOUT_INTAKE_DATABASE_URL:databaseUrl}},{runChild:()=>assert.fail()}),/unconfirmed/);
});
