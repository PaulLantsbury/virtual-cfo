declare const __NIGHT_SCOUT_BUILD_REVISION__: unknown;

export function compiledDeploymentRevision():unknown{
 return typeof __NIGHT_SCOUT_BUILD_REVISION__==='undefined'?null:__NIGHT_SCOUT_BUILD_REVISION__;
}

/** Public metadata contains one validated build SHA, never environment values. */
export function deploymentVersion(revision:unknown){
 return Object.freeze({revision:typeof revision==='string'&&/^[0-9a-f]{40}$/i.test(revision)?revision.toLowerCase():null});
}
