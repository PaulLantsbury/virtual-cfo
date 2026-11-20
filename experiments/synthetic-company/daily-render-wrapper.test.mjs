import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {stageRenderMountedBinding,renderDailyCli,verifyRenderBindingDelivery,RENDER_BINDING_MAX_BYTES} from './daily-render-wrapper.mjs';

async function fixture(){
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'render-delivery-test-')));await fs.chmod(root,0o700);
 const mounted=join(root,'mount'),targetDir=join(root,'target');await fs.mkdir(mounted,{mode:0o700});await fs.mkdir(targetDir,{mode:0o700});await fs.mkdir(join(root,'repo'),{mode:0o700});
 const target=join(targetDir,'mounted.json'),sourcePath=join(mounted,'binding.json');
 // Fictional credentials are intentionally absent from the fixture and all diagnostics.
 const body='{"purpose":"fictional-unit-binding","appendApproved":false}\n';
 await fs.writeFile(target,body,{mode:0o644});await fs.symlink(target,sourcePath);
 return {root,mounted,targetDir,target,sourcePath,body,options:{expectedSha256:createHash('sha256').update(body).digest('hex'),sourcePath,trustedSourceRoot:root,trustedOwnerUid:process.getuid(),runtimeUid:process.getuid(),repoRoot:join(root,'repo'),temporaryRoot:root},cleanup:()=>fs.rm(root,{recursive:true,force:true})};
}
test('trusted symlink delivery becomes an exclusive owner-only regular file and is cleaned up',async()=>{
 const f=await fixture();try{
  const staged=await stageRenderMountedBinding(f.options),stat=await fs.lstat(staged.path),parent=await fs.stat(join(staged.path,'..'));
  assert.ok(stat.isFile()&&!stat.isSymbolicLink());assert.equal(stat.uid,process.getuid());assert.equal(stat.mode&0o777,0o600);assert.equal(parent.mode&0o777,0o700);
  assert.equal(await fs.readFile(staged.path,'utf8'),f.body);assert.equal(await fs.readFile(f.target,'utf8'),f.body);
  await staged.cleanup();await assert.rejects(fs.lstat(staged.path),{code:'ENOENT'});
 }finally{await f.cleanup();}
});
test('untrusted ownership, writable parent/target and targets inside source fail closed',async()=>{
 for(const change of [
  async f=>{f.options.trustedOwnerUid=process.getuid()+1;},
  async f=>{await fs.chmod(f.mounted,0o777);},
  async f=>{await fs.chmod(f.targetDir,0o777);},
  async f=>{await fs.chmod(f.target,0o666);},
  async f=>{f.options.repoRoot=f.targetDir;},
 ]){const f=await fixture();try{await change(f);await assert.rejects(stageRenderMountedBinding(f.options));}finally{await f.cleanup();}}
});
test('oversize, malformed JSON, invalid UTF8 and unsafe paths never produce a private copy',async()=>{
 for(const value of [Buffer.alloc(RENDER_BINDING_MAX_BYTES+1,32),Buffer.from('{malformed'),Buffer.from([0xff,0xfe])]){
  const f=await fixture();try{await fs.writeFile(f.target,value);f.options.expectedSha256=createHash('sha256').update(value).digest('hex');await assert.rejects(stageRenderMountedBinding(f.options));assert.ok(!(await fs.readdir(f.root)).some(name=>name.startsWith('night-scout-render-binding-')));}finally{await f.cleanup();}
 }
 const f=await fixture();try{for(const sourcePath of ['relative.json',f.sourcePath+'/../binding.json',f.sourcePath+'\0'])await assert.rejects(stageRenderMountedBinding({...f.options,sourcePath}));}finally{await f.cleanup();}
});
test('a delivery rotation or file mutation during read is refused before handoff',async()=>{
 for(const attack of ['symlink','file']){
  const f=await fixture();let changed=false;
  const api={...fs,open:async(...args)=>{const file=await fs.open(...args);if(args[0]!==f.target)return file;return {stat:()=>file.stat(),close:()=>file.close(),read:async(...readArgs)=>{
   const result=await file.read(...readArgs);if(!changed){changed=true;if(attack==='symlink'){await fs.unlink(f.sourcePath);await fs.symlink(f.target,f.sourcePath);}else{await fs.appendFile(f.target,' ');}}return result;
  }};}};
  try{await assert.rejects(stageRenderMountedBinding({...f.options,api}),/changed/);}finally{await f.cleanup();}
 }
});
test('exclusive destination creation refuses a preexisting path instead of following it',async()=>{
 const f=await fixture();const api={...fs,mkdtemp:async prefix=>{const dir=await fs.mkdtemp(prefix);await fs.symlink(f.target,join(dir,'binding.json'));return dir;}};
 try{await assert.rejects(stageRenderMountedBinding({...f.options,api}),error=>error.code==='EEXIST'||error.code==='ELOOP');assert.equal(await fs.readFile(f.target,'utf8'),f.body);}finally{await f.cleanup();}
});
test('temporary-root symlink into the repository is refused before writing any binding copy',async()=>{
 const f=await fixture(),alias=join(f.root,'temp-alias');await fs.symlink(f.options.repoRoot,alias);
 try{await assert.rejects(stageRenderMountedBinding({...f.options,temporaryRoot:alias}),/outside-source/);assert.deepEqual(await fs.readdir(f.options.repoRoot),[]);}finally{await f.cleanup();}
});
test('disabled wrapper does not stage, read, import or connect even with a missing operator',async()=>{
 let called=0;assert.deepEqual(await renderDailyCli(['--recurring'],{stage:async()=>{called++;throw Error();},invoke:async()=>{called++;throw Error();}}),{state:'disabled',mode:'inspect',connections:0});assert.equal(called,0);
 const isolated=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'render-disabled-isolated-')));
 try{const entry=join(isolated,'daily-render-wrapper.mjs');await fs.writeFile(entry,await fs.readFile(new URL('./daily-render-wrapper.mjs',import.meta.url)));const result=JSON.parse(execFileSync(process.execPath,[entry,'--recurring'],{encoding:'utf8',env:{DATABASE_URL:'unused.invalid',PGHOST:'unused.invalid'}}));assert.deepEqual(result,{state:'disabled',mode:'inspect',connections:0});}finally{await fs.rm(isolated,{recursive:true,force:true});}
});
test('enabled wrapper hands only staged path to unchanged operator and preserves uncertainty through cleanup failure',async()=>{
 let cleaned=0,seen;
 const stage=async()=>({path:'/private/tmp/runtime-private/binding.json',cleanup:async()=>{cleaned++;throw Error('cleanup unavailable');}});
 const result=await renderDailyCli(['--enabled','--recurring'],{stage,invoke:async args=>{seen=args;return {state:'inspection-only'};}});
 assert.deepEqual(seen,['--enabled','--recurring','--mode=inspect','--binding-file=/private/tmp/runtime-private/binding.json']);assert.equal(result.state,'inspection-only');assert.equal(cleaned,1);
 const uncertain=new Error('private transport details');uncertain.operatorErrorClass='unknown-outcome-inspect-independently';
 await assert.rejects(renderDailyCli(['--enabled','--mode=append'],{stage,invoke:async()=>{throw uncertain;}}),error=>error===uncertain);assert.equal(cleaned,2);
 await assert.rejects(renderDailyCli(['--binding-file=/unreviewed/path']),/unsupported/);
});
test('delivery verification uses the unchanged strict operator reader on the real staged regular file, without connecting',async()=>{
 const {readPrivateOperatorBinding,OPERATOR_PURPOSE}=await import('./daily-operator.mjs');
 const f=await fixture();let stagedPath,reads=0;
 const binding={purpose:OPERATOR_PURPOSE,syntheticOnly:true,scope:{storeId:'d7500000-0000-4000-8000-000000000009',profile:'uk-gifts-v2',edition:'synthetic-history-v2-2026-11',anchor:'2024-11-01',currency:'GBP',timezone:'Europe/London'},connection:{host:'/private/tmp/fictional-unused-socket',port:5432,database:'postgres',user:'copy_binding_fixture',password:'',ssl:false},approvedDay:'2026-11-05',expectedThrough:'2026-11-04',initialThrough:'2026-11-04',ceiling:'2026-11-05',appendApproved:false,expected:{callerRole:'daily_capability_invoker',ownerRole:'daily_capability_owner',schemaOwner:'daily_capability_reviewer',memberships:[{role:'daily_capability_invoker',member:'copy_binding_fixture',adminOption:false,inheritOption:false,setOption:true}],protectedFingerprintsAccepted:false}};
 try{
  await fs.writeFile(f.target,JSON.stringify(binding));f.options.expectedSha256=createHash('sha256').update(JSON.stringify(binding)).digest('hex');
  const stage=async()=>{const staged=await stageRenderMountedBinding(f.options);stagedPath=staged.path;return staged;};
  const readBinding=async path=>{reads++;return readPrivateOperatorBinding(path);};
  const result=await renderDailyCli(['--verify-delivery'],{stage,readBinding,invoke:async()=>{throw Error('Operator execution is forbidden in verification');}});
  assert.deepEqual(result,{state:'delivery-verified-disabled',bindingValid:true,appendApproved:false,protectedFingerprintsAccepted:false,mutationAttempted:false,connections:0});assert.equal(reads,1);
  await assert.rejects(fs.lstat(stagedPath),{code:'ENOENT'});
  await fs.writeFile(f.target,JSON.stringify({...binding,appendApproved:true}));f.options.expectedSha256=createHash('sha256').update(JSON.stringify({...binding,appendApproved:true})).digest('hex');await assert.rejects(verifyRenderBindingDelivery({stage,readBinding}),/disabled-pending/);
  await assert.rejects(renderDailyCli(['--enabled','--verify-delivery'],{stage,readBinding}),/separate-purpose/);
 }finally{await f.cleanup();}
});

test('missing or malformed independent approval pin refuses before any filesystem access',async()=>{
 for(const expectedSha256 of [undefined,null,'','A'.repeat(64),'0'.repeat(63),'0'.repeat(65)]){
  let io=0;const api=new Proxy({},{get(){return async()=>{io++;throw Error('No filesystem access allowed');};}});
  await assert.rejects(stageRenderMountedBinding({expectedSha256,api}),/approved-binding-digest-required/);assert.equal(io,0);
 }
});
test('digest mismatch and replay of old valid JSON refuse before parsing or copying',async()=>{
 const f=await fixture();try{
  for(const body of ['{bad json','{"purpose":"older-reviewed-binding","appendApproved":false}',f.body+' ']){
   await fs.writeFile(f.target,body);await assert.rejects(stageRenderMountedBinding(f.options),/approved-digest-differs/);
   assert.ok(!(await fs.readdir(f.root)).some(n=>n.startsWith('night-scout-render-binding-')));
  }
 }finally{await f.cleanup();}
});
test('only fixed root-owned Render mount may be writable, with exact independent bytes and strict other ancestors',async()=>{
 const f=await fixture();try{
  await fs.chmod(f.mounted,0o777);
  let writableOther=false,wrongOwner=false;
  const source='/etc/secrets/synthetic-daily-binding.json',target='/etc/secrets/target/mounted.json';
  const map=p=>p===source?f.sourcePath:p===target?f.target:p==='/etc/secrets/target'?f.targetDir:p==='/etc/secrets'?f.mounted:p;
  const api={...fs,
   lstat:async p=>{if(p==='/'||p==='/etc')return {isDirectory:()=>true,isSymbolicLink:()=>false,uid:0,mode:p==='/etc'&&writableOther?0o40777:0o40755};const stat=await fs.lstat(map(p));if(p.startsWith('/etc/secrets'))return new Proxy(stat,{get(o,k){if(k==='uid')return wrongOwner&&p==='/etc/secrets'?1:0;const v=o[k];return typeof v==='function'?v.bind(o):v;}});return stat;},
   realpath:async p=>p===source||p===target?target:fs.realpath(map(p)),
   open:async(p,...args)=>{const file=await fs.open(map(p),...args);if(p!==target)return file;return {read:(...a)=>file.read(...a),close:()=>file.close(),stat:async()=>{const s=await file.stat();return new Proxy(s,{get(o,k){if(k==='uid')return 0;const v=o[k];return typeof v==='function'?v.bind(o):v;}});}};}
  };
  const options={...f.options,sourcePath:source,trustedSourceRoot:'/',trustedOwnerUid:0,api};
  const staged=await stageRenderMountedBinding(options);assert.equal(await fs.readFile(staged.path,'utf8'),f.body);await staged.cleanup();
  writableOther=true;await assert.rejects(stageRenderMountedBinding(options),/parent-not-trusted/);writableOther=false;
  wrongOwner=true;await assert.rejects(stageRenderMountedBinding(options),/parent-not-trusted/);wrongOwner=false;
  await fs.chmod(f.targetDir,0o777);await assert.rejects(stageRenderMountedBinding(options),/parent-not-trusted/);await fs.chmod(f.targetDir,0o700);
  await fs.writeFile(f.target,f.body+' ');await assert.rejects(stageRenderMountedBinding(options),/approved-digest-differs/);
 }finally{await f.cleanup();}
});
