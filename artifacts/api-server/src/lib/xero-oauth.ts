import {createSingleUseStateGuard,readXeroTestConfig} from '../../../../experiments/xero/read-only-oauth.mjs';
import {exchangeReadOnlyCode,discoverConnectedTenant} from '../../../../experiments/xero/token-exchange.mjs';
import {readFixedXeroSnapshot,readXeroSnapshotDate} from '../../../../experiments/xero/read-only-snapshot.mjs';
import {xeroEvidenceSummary} from '../../../../experiments/xero/evidence-summary.mjs';
import {writeLocalXeroEvidenceSummary} from '../../../../experiments/xero/evidence-store.mjs';
import {pinXeroTenant} from '../../../../experiments/xero/tenant-pin.mjs';
import {discoverXeroAccounts} from '../../../../experiments/xero/account-discovery.mjs';
import {writeLocalXeroAccountDirectory} from '../../../../experiments/xero/account-directory-store.mjs';
import {writeLocalXeroReadStatus} from '../../../../experiments/xero/read-status-store.mjs';
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
 const accountDirectoryPath=resolve(process.cwd(),'../../.local/xero-account-directory.json');
 const readStatusPath=resolve(process.cwd(),'../../.local/xero-read-status.json');
 return Object.freeze({start:()=>states.issue(config),accept:(state:string)=>states.consume(state),exchange:async(code:string)=>{let phase='token_exchange';try{const {accessToken}=await exchangeReadOnlyCode({code,config});phase='tenant_discovery';const tenant=await discoverConnectedTenant({accessToken});const pinnedTenant=await pinXeroTenant(tenantPinPath,tenant);const retrievedAt=new Date().toISOString();phase='account_directory';const accounts=await discoverXeroAccounts({accessToken,tenantId:pinnedTenant.tenantId,pinnedTenantId:pinnedTenant.tenantId});await writeLocalXeroAccountDirectory(accountDirectoryPath,{tenantId:pinnedTenant.tenantId,retrievedAt,accounts});phase='report_snapshot';const snapshot=await readFixedXeroSnapshot({accessToken,tenantId:pinnedTenant.tenantId,date:snapshotDate});phase='evidence_summary';const summary=xeroEvidenceSummary(snapshot,{retrievedAt});await writeLocalXeroEvidenceSummary(evidencePath,summary);return {tenant:pinnedTenant,date:snapshot.date,accountDirectory:'stored_locally',evidence:'stored_locally'};}catch{await writeLocalXeroReadStatus(readStatusPath,{phase,recordedAt:new Date().toISOString()});throw Error('Xero read unavailable');}}});
}
