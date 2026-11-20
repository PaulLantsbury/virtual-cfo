/** Unapplied Render delivery adaptation. Strict operator binding checks remain unchanged. */
import {createHash,timingSafeEqual} from 'node:crypto';
import * as fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,resolve,relative,isAbsolute,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

export const RENDER_BINDING_MOUNT='/etc/secrets/synthetic-daily-binding.json';
export const RENDER_BINDING_MAX_BYTES=1048576;
export const RENDER_BINDING_DIGEST_ENV='NIGHT_SCOUT_BINDING_SHA256';
const repositoryRoot=fileURLToPath(new URL('../../',import.meta.url));
const ensure=(value,code)=>{if(!value){const error=new Error(code);error.operatorErrorClass='render-binding-stage-refused';throw error;}};
const inside=(root,path)=>{const rel=relative(root,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep));};
const unchanged=(a,b)=>['dev','ino','mode','uid','size','mtimeMs','ctimeMs'].every(key=>a[key]===b[key]);
async function trustedDirectories(api,path,root,owner,writableMount){
 ensure(inside(root,path),'mounted-secret-outside-trusted-root');
 const paths=[];for(let current=path;;current=dirname(current)){paths.push(current);if(current===root)break;ensure(current!==dirname(current),'mounted-secret-parent-root-differs');}
 for(const directory of paths.reverse()){const stat=await api.lstat(directory);ensure(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===owner&&((stat.mode&0o022)===0||directory===writableMount),'mounted-secret-parent-not-trusted');}
}
/** Test-only filesystem/layout injection is not exposed by the Render CLI. */
export async function stageRenderMountedBinding({sourcePath=RENDER_BINDING_MOUNT,trustedSourceRoot='/',trustedOwnerUid=0,runtimeUid=process.getuid(),repoRoot=repositoryRoot,temporaryRoot=tmpdir(),api=fs,expectedSha256=process.env[RENDER_BINDING_DIGEST_ENV]}={}){
 // The separately delivered private approval pin is authority; the writable mount is transport only.
 ensure(typeof expectedSha256==='string'&&/^[a-f0-9]{64}$/.test(expectedSha256),'independently-approved-binding-digest-required');
 const writableMount=sourcePath===RENDER_BINDING_MOUNT&&trustedSourceRoot==='/'&&trustedOwnerUid===0?'/etc/secrets':undefined;
 ensure(typeof sourcePath==='string'&&isAbsolute(sourcePath)&&resolve(sourcePath)===sourcePath&&!/[\r\n\0]/.test(sourcePath),'exact-absolute-mounted-secret-path-required');
 ensure(isAbsolute(trustedSourceRoot)&&resolve(trustedSourceRoot)===trustedSourceRoot&&isAbsolute(temporaryRoot),'absolute-trusted-roots-required');
 const actualRepoRoot=await api.realpath(repoRoot);
 ensure(!inside(actualRepoRoot,sourcePath),'mounted-secret-must-be-outside-source');
 await trustedDirectories(api,dirname(sourcePath),trustedSourceRoot,trustedOwnerUid,writableMount);
 const linkBefore=await api.lstat(sourcePath);
 ensure((linkBefore.isSymbolicLink()||linkBefore.isFile())&&linkBefore.uid===trustedOwnerUid,'mounted-secret-entry-not-trusted');
 const target=await api.realpath(sourcePath);
 ensure(isAbsolute(target)&&!inside(actualRepoRoot,target),'mounted-secret-target-must-be-outside-source');
 await trustedDirectories(api,dirname(target),trustedSourceRoot,trustedOwnerUid,writableMount);
 const before=await api.lstat(target);
 ensure(before.isFile()&&!before.isSymbolicLink()&&before.uid===trustedOwnerUid&&(before.mode&0o022)===0&&before.size>0&&before.size<=RENDER_BINDING_MAX_BYTES,'mounted-secret-target-not-trusted-or-bounded');
 let input,output,directory,destination,created=false;
 try{
  input=await api.open(target,constants.O_RDONLY|constants.O_NOFOLLOW);
  ensure(unchanged(before,await input.stat()),'mounted-secret-target-changed-before-read');
  // Bounded reads, including one overflow byte: readFile could allocate beyond the reviewed limit.
  const bytes=Buffer.alloc(RENDER_BINDING_MAX_BYTES+1);let length=0;
  while(length<bytes.length){const read=await input.read(bytes,length,bytes.length-length,length);if(read.bytesRead===0)break;length+=read.bytesRead;}
  ensure(length>0&&length<=RENDER_BINDING_MAX_BYTES,'mounted-secret-exceeds-bounded-read');
  ensure(unchanged(before,await input.stat())&&unchanged(before,await api.lstat(target)),'mounted-secret-target-changed-during-read');
  ensure(unchanged(linkBefore,await api.lstat(sourcePath))&&await api.realpath(sourcePath)===target,'mounted-secret-delivery-changed-during-read');
  await trustedDirectories(api,dirname(sourcePath),trustedSourceRoot,trustedOwnerUid,writableMount);
  await trustedDirectories(api,dirname(target),trustedSourceRoot,trustedOwnerUid,writableMount);
  const actualDigest=createHash('sha256').update(bytes.subarray(0,length)).digest();
  ensure(timingSafeEqual(actualDigest,Buffer.from(expectedSha256,'hex')),'mounted-secret-approved-digest-differs');
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,length));JSON.parse(text);}catch{ensure(false,'mounted-secret-json-invalid');}
  directory=await api.mkdtemp(join(temporaryRoot,'night-scout-render-binding-'));await api.chmod(directory,0o700);
  directory=await api.realpath(directory);
  ensure(!inside(actualRepoRoot,directory),'private-copy-directory-must-be-outside-source');
  const dirStat=await api.lstat(directory);ensure(dirStat.isDirectory()&&!dirStat.isSymbolicLink()&&dirStat.uid===runtimeUid&&(dirStat.mode&0o077)===0,'private-copy-directory-not-owned-and-private');
  destination=join(directory,'binding.json');
  output=await api.open(destination,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);created=true;
  await output.writeFile(text,'utf8');await output.sync();
  const written=await output.stat();ensure(written.isFile()&&written.uid===runtimeUid&&(written.mode&0o177)===0&&written.size===Buffer.byteLength(text),'private-copy-not-owned-and-private');
  await output.close();output=null;
  ensure(unchanged(written,await api.lstat(destination)),'private-copy-changed-before-handoff');
  const cleanup=async()=>{try{await api.unlink(destination);}finally{await api.rmdir(directory);}};
  return {path:destination,cleanup};
 }catch(error){if(output){try{await output.close();}catch{}}if(created){try{await api.unlink(destination);}catch{}}if(directory){try{await api.rmdir(directory);}catch{}}throw error;
 }finally{if(input){try{await input.close();}catch{}}}
}
/** Explicit file-delivery verification only. No database call or operator enabling path. */
export async function verifyRenderBindingDelivery({stage=stageRenderMountedBinding,readBinding=async path=>(await import('./daily-operator.mjs')).readPrivateOperatorBinding(path)}={}){
 const staged=await stage();
 try{
  const binding=await readBinding(staged.path);
  ensure(binding.appendApproved===false&&binding.expected?.protectedFingerprintsAccepted===false,'delivery-verification-requires-disabled-pending-binding');
  return {state:'delivery-verified-disabled',bindingValid:true,appendApproved:false,protectedFingerprintsAccepted:false,mutationAttempted:false,connections:0};
 }finally{try{await staged.cleanup();}catch{/* An owner-only leftover must not mask a validation error. */}}
}
/** Disabled returns before any secret operation, temporary copy or operator import. */
export async function renderDailyCli(argv=process.argv.slice(2),{stage=stageRenderMountedBinding,invoke=async args=>(await import('./daily-operator.mjs')).dailyOperatorCli(args),readBinding=async path=>(await import('./daily-operator.mjs')).readPrivateOperatorBinding(path)}={}){
 if(argv.includes('--verify-delivery')){ensure(argv.length===1,'delivery-verification-is-a-separate-purpose');return verifyRenderBindingDelivery({stage,readBinding});}
 let enabled=false,recurring=false,mode='inspect';
 for(const arg of argv){if(arg==='--enabled')enabled=true;else if(arg==='--recurring')recurring=true;else if(arg==='--mode=inspect')mode='inspect';else if(arg==='--mode=append')mode='append';else ensure(false,'unsupported-render-wrapper-option');}
 if(!enabled)return {state:'disabled',mode,connections:0};
 const staged=await stage();
 try{return await invoke(['--enabled',...(recurring?['--recurring']:[]),'--mode='+mode,'--binding-file='+staged.path]);}
 finally{try{await staged.cleanup();}catch{/* Keep an original operator/uncertain outcome; a retained copy is still owner-only. */}}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 renderDailyCli().then(result=>process.stdout.write(JSON.stringify(result)+'\n')).catch(error=>{process.stderr.write(JSON.stringify({state:'render-daily-stopped',errorClass:error.operatorErrorClass??'render-binding-stage-refused',mutationAttempted:error.mutationAttempted===true})+'\n');process.exitCode=1;});
}
