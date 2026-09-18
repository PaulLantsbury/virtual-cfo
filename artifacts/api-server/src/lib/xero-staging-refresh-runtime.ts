import {runStagingXeroRefresh} from '../../../../experiments/xero/staging-refresh-orchestrator.mjs';

/**
 * Server composition boundary for the staging Xero refresh worker.
 *
 * It intentionally does not create a scheduler, read a database URL, create a
 * credential client, or make an HTTP request.  Those capabilities are supplied
 * by the hosting worker after its private staging configuration is verified.
 * A regular API process therefore remains inert even if generic Xero OAuth
 * variables happen to be present.
 */
export type XeroRefreshConnection={id:string;tenantId:string};
export type XeroRefreshScope={from:string;to:string;currency:string};
export type XeroRefreshJob={connection:XeroRefreshConnection;scope:XeroRefreshScope;mapping:Record<string,unknown>};
export type XeroRefreshCredentialPort={
  /** A worker-only port. It must acquire/rotate credentials internally and must never return token material. */
  readSnapshot(input:{connectionId:string;tenantId:string;date:string}):Promise<unknown>;
};
export type XeroRefreshPersistencePort={writeSupported(input:unknown):Promise<void>;writeFailure(input:unknown):Promise<void>};
export type XeroStagingRefreshDependencies={credentials:XeroRefreshCredentialPort;persistence:XeroRefreshPersistencePort;now?:()=>string};

export type XeroStagingRefreshRuntime={run(job:XeroRefreshJob):Promise<unknown>};

const enabled=(env:NodeJS.ProcessEnv)=>
  env.NIGHT_SCOUT_RUNTIME_ENV==='staging' &&
  env.NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED==='true' &&
  typeof env.NIGHT_SCOUT_XERO_STAGING_PROJECT_REF==='string' &&
  /^[a-z0-9]{20}$/.test(env.NIGHT_SCOUT_XERO_STAGING_PROJECT_REF);

/**
 * Returns undefined unless all three staging guards are exact.  In particular,
 * NIGHT_SCOUT_XERO_ENABLED (the old local proof switch) cannot activate this
 * worker.  Calling `run` is the only point where the injected credential port
 * can be reached.
 */
export function createXeroStagingRefreshRuntime(env:NodeJS.ProcessEnv,dependencies?:XeroStagingRefreshDependencies):XeroStagingRefreshRuntime|undefined{
  if(!enabled(env))return undefined;
  if(!dependencies||typeof dependencies.credentials?.readSnapshot!=='function'||typeof dependencies.persistence?.writeSupported!=='function'||typeof dependencies.persistence?.writeFailure!=='function')throw Error('Xero staging refresh configuration is invalid');
  const now=dependencies.now??(()=>new Date().toISOString());
  return Object.freeze({
    async run(job:XeroRefreshJob){
      // Do not hand OAuth material to the orchestrator or persistence layer.
      const readSnapshot=(input:{tenantId:string;date:string})=>dependencies.credentials.readSnapshot({connectionId:job.connection.id,...input});
      return runStagingXeroRefresh({connection:job.connection,scope:job.scope,mapping:job.mapping,readSnapshot,persist:dependencies.persistence,now});
    },
  });
}
