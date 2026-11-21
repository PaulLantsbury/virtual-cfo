/** Generic optional composition. Connection policy remains in the unchanged existing runtime. */
import {initialiseReviewRuntime,reviewDatabase} from '../shopify/review-runtime.mjs';
import {createHistoryService} from './history-reader.mjs';
import {createSupplementalService} from './supplemental-reader.mjs';
export function attachHistoryReader(runtime,database,auth,{enabled=false,createReader=createHistoryService}={}){
 if(!enabled)return runtime;
 if(typeof database?.transaction!=='function'||typeof auth?.auth?.getUser!=='function')throw Error('Verified server reporting dependencies required');
 return {...runtime,historyService:createReader(database,auth)};
}
export async function initialiseHistoryReportingRuntime(config,factories,{enabled=false,supplementalEnabled=false,supplementalValidators={},attachRuntime}={}){
 if(supplementalEnabled&&!enabled)throw Error('Reviewed financial history is required for supplemental reporting');
 if(!enabled)return initialiseReviewRuntime(config,factories);
 let database,auth;
 const runtime=await initialiseReviewRuntime(config,{...factories,
  createPool:options=>{const pool=factories.createPool(options);database=reviewDatabase(pool);return pool;},
  createAuthClient:(...args)=>{auth=factories.createAuthClient(...args);return auth;}
 });
 try{const linked=attachHistoryReader(runtime,database,auth,{enabled:true});const ready=supplementalEnabled?{...linked,supplementalService:createSupplementalService(database,auth,{validators:supplementalValidators})}:linked;return attachRuntime?attachRuntime(ready,database,auth):ready;}
 catch(error){await runtime.close();throw error;}
}
