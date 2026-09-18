import {createSingleUseStateGuard,readXeroTestConfig} from '../../../../experiments/xero/read-only-oauth.mjs';
import {exchangeReadOnlyCode,discoverConnectedTenant} from '../../../../experiments/xero/token-exchange.mjs';
import {readFixedXeroSnapshot,readXeroSnapshotDate} from '../../../../experiments/xero/read-only-snapshot.mjs';
import {xeroEvidenceSummary} from '../../../../experiments/xero/evidence-summary.mjs';
import {writeLocalXeroEvidenceSummary} from '../../../../experiments/xero/evidence-store.mjs';
import {pinXeroTenant} from '../../../../experiments/xero/tenant-pin.mjs';
import {resolve} from 'node:path';

export function xeroOAuthRuntime(env:NodeJS.ProcessEnv){
 const config=readXeroTestConfig({enabled:env.NIGHT_SCOUT_XERO_ENABLED,clientId:env.NIGHT_SCOUT_XERO_CLIENT_ID,clientSecret:env.NIGHT_SCOUT_XERO_CLIENT_SECRET,redirectUri:env.NIGHT_SCOUT_XERO_REDIRECT_URI});
 if(!config)return undefined;
 const stateKey=env.NIGHT_SCOUT_XERO_STATE_KEY;
 if(typeof stateKey!=='string'||stateKey.length<32)throw Error('Xero test configuration is invalid');
 const snapshotDate=readXeroSnapshotDate(env.NIGHT_SCOUT_XERO_SNAPSHOT_DATE);
 const states=createSingleUseStateGuard({stateKey});
 const evidencePath=resolve(process.cwd(),'../../.local/xero-evidence-summary.json');
 const tenantPinPath=resolve(process.cwd(),'../../.local/xero-test-tenant.json');
 return Object.freeze({start:()=>states.issue(config),accept:(state:string)=>states.consume(state),exchange:async(code:string)=>{const {accessToken}=await exchangeReadOnlyCode({code,config});const tenant=await discoverConnectedTenant({accessToken});const pinnedTenant=await pinXeroTenant(tenantPinPath,tenant);const snapshot=await readFixedXeroSnapshot({accessToken,tenantId:pinnedTenant.tenantId,date:snapshotDate});const summary=xeroEvidenceSummary(snapshot,{retrievedAt:new Date().toISOString()});await writeLocalXeroEvidenceSummary(evidencePath,summary);return {tenant:pinnedTenant,date:snapshot.date,evidence:'stored_locally'};}});
}
