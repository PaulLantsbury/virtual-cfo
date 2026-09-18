/**
 * Fixed configuration gate for the staging-only Xero scheduled worker.
 *
 * This module does not contact Xero or the database.  It makes the scheduled
 * host fail closed until the production worker composition is present, and is
 * deliberately reusable by that composition.  No secret is included in its
 * return value or error.
 */
import {INTAKE_TARGET} from '../../experiments/shopify/intake-runtime.mjs';
import {validateXeroAccountMapping} from '../../experiments/xero/account-mapping-contract.mjs';
const unavailable=()=>Error('Xero staging worker configuration is invalid');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))&&new Date(`${value}T00:00:00.000Z`).toISOString().slice(0,10)===value;
const text=(value,min,max)=>typeof value==='string'&&value.length>=min&&value.length<=max&&!/[\x00-\x20\x7f]/.test(value);
function database(url){
 if(!text(url,20,4096))return false;
 try { const parsed=new URL(url),user=decodeURIComponent(parsed.username),host=parsed.hostname;
  return ['postgres:','postgresql:'].includes(parsed.protocol)&&
   ((host===`db.${INTAKE_TARGET.projectRef}.supabase.co`&&user==='night_scout_import_login')||
    (host==='aws-1-eu-west-1.pooler.supabase.com'&&user===`night_scout_import_login.${INTAKE_TARGET.projectRef}`))&&
   (!parsed.port||parsed.port==='5432')&&parsed.pathname==='/postgres'&&!parsed.search&&!parsed.hash&&parsed.password.length>0;
 } catch { return false; }
}
/** Only accepts the fixed staging target and pre-agreed non-production scope. */
export function readStagingXeroWorkerConfig(env={}){
 try {
  if(env.NIGHT_SCOUT_RUNTIME_ENV!=='staging'||env.NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED!=='true'||env.NIGHT_SCOUT_XERO_STAGING_PROJECT_REF!==INTAKE_TARGET.projectRef)throw unavailable();
  const config={
   connectionId:env.NIGHT_SCOUT_XERO_STAGING_CONNECTION_ID,
   mappingVersionId:env.NIGHT_SCOUT_XERO_STAGING_MAPPING_VERSION_ID,
   from:env.NIGHT_SCOUT_XERO_REPORT_FROM,
   to:env.NIGHT_SCOUT_XERO_REPORT_TO,
   currency:env.NIGHT_SCOUT_XERO_CURRENCY,
   databaseUrl:env.NIGHT_SCOUT_INTAKE_DATABASE_URL,
   caPem:env.NIGHT_SCOUT_STAGING_CA_PEM,
   clientId:env.NIGHT_SCOUT_XERO_CLIENT_ID,
   clientSecret:env.NIGHT_SCOUT_XERO_CLIENT_SECRET,
   envelopeKey:env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY,
   envelopeKeyVersion:env.NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION,
   mappingJson:env.NIGHT_SCOUT_XERO_STAGING_MAPPING_JSON,
  };
  const mapping=typeof config.mappingJson==='string'&&config.mappingJson.length<=4096?validateXeroAccountMapping(JSON.parse(config.mappingJson)):null;
  if(!mapping||!uuid(config.connectionId)||!uuid(config.mappingVersionId)||!date(config.from)||!date(config.to)||config.from>config.to||(Date.parse(config.to)-Date.parse(config.from))/86400000>=31||config.currency!=='GBP'||!database(config.databaseUrl)||typeof config.caPem!=='string'||config.caPem.length<100||config.caPem.length>32768||!text(config.clientId,20,256)||!text(config.clientSecret,24,2048)||!text(config.envelopeKey,32,512)||!text(config.envelopeKeyVersion,1,128))throw unavailable();
  return Object.freeze({connectionId:config.connectionId,mappingVersionId:config.mappingVersionId,mapping,scope:Object.freeze({from:config.from,to:config.to,currency:config.currency}),projectRef:INTAKE_TARGET.projectRef});
 } catch { throw unavailable(); }
}
/**
 * Host composition hook.  A caller supplies the private runtime; the public
 * receipt contains no financial values, credentials, provider payloads or IDs
 * beyond the pre-configured connection/mapping identities.
 */
export async function runStagingXeroWorker({env=process.env,run}={}){
 const config=readStagingXeroWorkerConfig(env);
 if(typeof run!=='function')throw unavailable();
 try { const result=await run(config); if(!result||!['supported','stale','failed'].includes(result.state))throw unavailable(); return Object.freeze({state:result.state,projectRef:config.projectRef,scope:config.scope}); }
 catch { throw unavailable(); }
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
 // The deploy manifest intentionally invokes the final composed runtime, not
 // this guard directly.  Direct execution is only a safe readiness check.
 try { readStagingXeroWorkerConfig(process.env); process.stdout.write('{"state":"configured"}\n'); }
 catch { process.stderr.write('Xero staging worker configuration is invalid\n'); process.exitCode=1; }
}
