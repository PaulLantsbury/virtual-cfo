import {randomBytes} from 'node:crypto';
import {createAuthorization,readXeroTestConfig,verifyAuthorizationState} from '../../../../experiments/xero/read-only-oauth.mjs';
import {exchangeReadOnlyCode,discoverConnectedTenant} from '../../../../experiments/xero/token-exchange.mjs';
import {readFixedXeroSnapshot} from '../../../../experiments/xero/read-only-snapshot.mjs';

export function xeroOAuthRuntime(env:NodeJS.ProcessEnv){
 const config=readXeroTestConfig({enabled:env.NIGHT_SCOUT_XERO_ENABLED,clientId:env.NIGHT_SCOUT_XERO_CLIENT_ID,clientSecret:env.NIGHT_SCOUT_XERO_CLIENT_SECRET,redirectUri:env.NIGHT_SCOUT_XERO_REDIRECT_URI});
 if(!config)return undefined;
 const stateKey=env.NIGHT_SCOUT_XERO_STATE_KEY;
 if(typeof stateKey!=='string'||stateKey.length<32)throw Error('Xero test configuration is invalid');
 return Object.freeze({start:()=>createAuthorization(config,{stateKey,nonce:randomBytes(24).toString('base64url')}),accept:(state:string)=>verifyAuthorizationState(state,{stateKey}),exchange:async(code:string)=>{const {accessToken}=await exchangeReadOnlyCode({code,config});const tenant=await discoverConnectedTenant({accessToken});const snapshot=await readFixedXeroSnapshot({accessToken,tenantId:tenant.tenantId,date:'2026-09-17'});return {tenant,date:snapshot.date};}});
}
