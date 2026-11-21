import {validReadiness} from './xero-merchant-readiness-runtime.ts';
/** Status only: existing accounting evidence cannot establish cash eligibility. */
export function cashReadinessFromMerchant(value:unknown,storeId:string){
 if(!validReadiness(value,storeId))throw Error('Xero readiness unavailable');
 const readiness=value as {connection:null|{status:string;mappingReviewRequired:boolean};evidenceState:string|null};
 if(!readiness.connection)return {storeId,state:'not_connected'};
 if(readiness.connection.status!=='active'||readiness.connection.mappingReviewRequired)return {storeId,state:'mapping_incomplete'};
 if(readiness.evidenceState==='denied')return {storeId,state:'denied'};
 if(readiness.evidenceState==='review_required')return {storeId,state:'review_required'};
 if(readiness.evidenceState==='stale')return {storeId,state:'stale',detail:'The accounting refresh is stale; a dated cash snapshot still requires an explicit same-store eligibility check.'};
 return {storeId,state:'evidence_incomplete',detail:'Accounting readiness alone does not establish a dated, eligible cash balance.'};
}
