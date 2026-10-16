import {execFileSync} from 'node:child_process';

export const normalizedRevision=value=>typeof value==='string'&&/^[0-9a-f]{40}$/i.test(value)?value.toLowerCase():null;

/** Build-time only. Never ship git access or runtime environment reflection. */
export function resolveApiBuildRevision({cwd,env=process.env,readGit=()=>execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8',timeout:1000,maxBuffer:1024,stdio:['ignore','pipe','ignore']})}={}){
 try{const revision=normalizedRevision(readGit().trim());if(revision)return revision;}catch{/* Hosted builds may omit the git directory. */}
 return normalizedRevision(env.RENDER_GIT_COMMIT);
}
