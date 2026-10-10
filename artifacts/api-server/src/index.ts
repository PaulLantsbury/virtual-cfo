import {createXeroTestWriterRuntime} from './lib/xero-test-writer-runtime.ts';
import {createApp} from "./app";
import {startReviewRuntime} from "./lib/review-startup";
import { logger } from "./lib/logger";
import {createXeroStagingBootstrapRuntime} from './lib/xero-staging-bootstrap-runtime';
import {resolve} from 'node:path';
import {createXeroMerchantReadinessRuntime} from './lib/xero-merchant-readiness-runtime.ts';
import {createXeroAccountingRuntime} from './lib/xero-accounting-runtime.ts';
import {createXeroSavedMappingRuntime} from './lib/xero-saved-mapping-runtime.ts';
import {reportingConfigReadiness} from '../../../deployments/render-staging/check-reporting-config.mjs';

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}
const localBind=process.env["NIGHT_SCOUT_LOCAL_BIND"];
if(localBind!==undefined&&localBind!=="127.0.0.1"){
  throw new Error('Invalid local bind address');
}

logger.info(reportingConfigReadiness(process.env),'Web reporting readiness');
const runtime = await startReviewRuntime(process.env).catch((error:unknown) => {
  const diagnostic=(error as {safeDiagnostic?:{phase?:string;code?:string}})?.safeDiagnostic;
  const phases=["database_connect","database_readiness","auth_client"];
  const codes=["ENETUNREACH","EHOSTUNREACH","ENOTFOUND","ECONNREFUSED","ETIMEDOUT","28P01","28000","42501","42P01","42883","SELF_SIGNED_CERT_IN_CHAIN","DEPTH_ZERO_SELF_SIGNED_CERT","UNABLE_TO_VERIFY_LEAF_SIGNATURE","UNABLE_TO_GET_ISSUER_CERT_LOCALLY","CERT_HAS_EXPIRED","CHECK_FAILED"];
  logger.error({event:"web_reporting_startup_failure",phase:phases.includes(diagnostic?.phase??"")?diagnostic?.phase:"configuration",code:codes.includes(diagnostic?.code??"")?diagnostic?.code:"CHECK_FAILED"},"Reporting startup diagnostic");
  logger.error("Financial review configuration failed; server startup stopped");
  process.exit(1);
});
let xeroBootstrap;
try{xeroBootstrap=createXeroStagingBootstrapRuntime(process.env);}catch{
  logger.error("Xero staging bootstrap configuration failed; server startup stopped");
  await runtime?.close();
  process.exit(1);
}
let xeroReadiness;
try{xeroReadiness=createXeroMerchantReadinessRuntime(process.env);}catch{
  logger.error("Xero merchant readiness configuration failed; server startup stopped");
  await Promise.all([runtime?.close(),xeroBootstrap?.close()]);
  process.exit(1);
}
let xeroAccounting;
try{xeroAccounting=createXeroAccountingRuntime(process.env);}catch{
  logger.error("Xero accounting reader configuration failed; server startup stopped");
  await Promise.all([runtime?.close(),xeroBootstrap?.close()]);
  process.exit(1);
}
const webRoot=process.env.NIGHT_SCOUT_RUNTIME_ENV==='staging'?resolve(process.cwd(),'artifacts/virtual-cfo/dist/public'):undefined;
let xeroSavedMapping;
try{xeroSavedMapping=createXeroSavedMappingRuntime(process.env);}catch{
  logger.error("Xero saved mapping reader configuration failed; server startup stopped");
  await Promise.all([runtime?.close(),xeroBootstrap?.close()]);
  process.exit(1);
}
let xeroTestWriter;
try{xeroTestWriter=createXeroTestWriterRuntime(process.env);}catch{
 logger.error("Xero test writer configuration failed; server startup stopped");
 await Promise.all([runtime?.close(),xeroBootstrap?.close()]);
 process.exit(1);
}
const app=createApp(runtime?.service,xeroBootstrap?{service:xeroBootstrap.service,authenticate:xeroBootstrap.authenticate}:undefined,webRoot,xeroReadiness,runtime?.profitService,xeroAccounting,xeroSavedMapping,xeroTestWriter?.service);
const server=app.listen(port, localBind ?? "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

for(const signal of ["SIGTERM","SIGINT"] as const){
 process.once(signal,()=>{server.close(()=>{void Promise.all([runtime?.close(),xeroBootstrap?.close(),xeroTestWriter?.close()]).finally(()=>process.exit(0));});});
}
