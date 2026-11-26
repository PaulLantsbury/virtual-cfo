import {createCanaryProxy} from '../../../../experiments/provider-proxy/canary.mjs';
import {createProviderProxyAdapter} from '../../../../experiments/provider-proxy/adapter.mjs';
import {PINNED_PRIVATE_PROVIDER_ORIGIN} from '../../../../experiments/provider-proxy/boundary.mjs';
// Integration owner verified service srv-dc46b5l9el5s73abpnc0. No environment-supplied target.
export const WEBSITE_PRIVATE_PROVIDER_ORIGIN = PINNED_PRIVATE_PROVIDER_ORIGIN;
const fail=()=>{throw new Error('Marketing provider configuration unavailable');};
export function validateWebsiteReportEnvironment(env){
 const allowed=new Set(['STAGING_PROJECT_REF','STAGING_OWNER_ID','STAGING_STORE_ID','REPORT_DATABASE_URL','REPORT_RUNTIME_ENABLED']);
 for(const [name,d] of Object.entries(Object.getOwnPropertyDescriptors(env))){
  if(!/^NIGHT_SCOUT_(META|GOOGLE)_ADS_/.test(name))continue;
  if(!('value' in d))fail();const value=d.value;
  if(value===undefined||value===null||value==='')continue;
  if(typeof value!=='string')fail();
  const suffix=name.replace(/^NIGHT_SCOUT_(META|GOOGLE)_ADS_/,'');
  if(suffix.endsWith('_ENABLED')&&!['true','false'].includes(value))fail();
  if(!allowed.has(suffix)&&!(suffix.endsWith('_ENABLED')&&value==='false'))fail();
 }
}
export function createWebsiteOwnerProxy(env){
 const enabled=env.NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED;
 if(enabled===undefined||enabled===''||enabled==='false')return undefined;
 if(enabled!=='true')fail();
 validateWebsiteReportEnvironment(env);
 return createProviderProxyAdapter({enabled:true,upstreamOrigin:WEBSITE_PRIVATE_PROVIDER_ORIGIN});
}

export function createWebsiteCanaryProxy(env){
 const flag=env.NIGHT_SCOUT_FICTIONAL_CANARY_PROXY_ENABLED;
 if(flag===undefined||flag===''||flag==='false')return undefined;
 if(flag!=='true'||env.NIGHT_SCOUT_PROVIDER_OWNER_PROXY_ENABLED==='true')fail();
 validateWebsiteReportEnvironment(env);
 return createCanaryProxy({enabled:true,expiresAt:env.NIGHT_SCOUT_FICTIONAL_CANARY_EXPIRES_AT,upstreamOrigin:WEBSITE_PRIVATE_PROVIDER_ORIGIN});
}
