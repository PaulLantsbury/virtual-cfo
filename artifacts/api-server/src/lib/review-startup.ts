import pg from 'pg';
import {compiledDeploymentRevision} from './deployment-version.ts';
import {RUNTIME_ATTESTATION_RELEASE_ENABLED} from './runtime-attestation-release.ts';
import {CUSTOMER_ATTESTATION_POLICY,createCustomerRuntimeAttestationService} from '../../../../experiments/synthetic-company/customer-runtime-attestation-service.mjs';
import {validateCashPayload,validateAcquisitionPayload} from '../../../../experiments/synthetic-company/supplemental-validators.mjs';
import {createClient} from '@supabase/supabase-js';
import {initialiseHistoryReportingRuntime} from '../../../../experiments/synthetic-company/history-runtime.mjs';
/** Explicit opt-in; only dedicated server variables are accepted. No live defaults. */
export async function startReviewRuntime(env:NodeJS.ProcessEnv){
 if(env.NIGHT_SCOUT_REVIEW_ENABLED!=='true')return undefined;
 const reviewConfig=Object.freeze({
  projectRef:env.NIGHT_SCOUT_REVIEW_PROJECT_REF??'',
  authUrl:env.NIGHT_SCOUT_REVIEW_AUTH_URL??'',
  publishableKey:env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY??'',
  databaseUrl:env.NIGHT_SCOUT_REVIEW_DATABASE_URL??'',
 });
 return initialiseHistoryReportingRuntime(reviewConfig,{createPool:options=>new pg.Pool(options),createAuthClient:(url,key,options)=>createClient(url,key,options)},{enabled:env.NIGHT_SCOUT_HISTORY_ENABLED==='true',supplementalEnabled:env.NIGHT_SCOUT_SUPPLEMENTAL_ENABLED==='true',supplementalValidators:{cash:validateCashPayload,acquisition:validateAcquisitionPayload},attachRuntime:(runtime,database,auth)=>{
 const attestation=createCustomerRuntimeAttestationService(database,auth,{trustedRevision:compiledDeploymentRevision(),runtimeProjectRef:reviewConfig.projectRef,policy:{...CUSTOMER_ATTESTATION_POLICY,enabled:RUNTIME_ATTESTATION_RELEASE_ENABLED}});
 return {...runtime,service:{...runtime.service,attestRuntime:(scope:{storeId:string;from:string;to:string},authorization:string)=>attestation.inspect(scope,authorization)}};
 }});
}
