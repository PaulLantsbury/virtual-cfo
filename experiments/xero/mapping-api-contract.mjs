import {validateXeroAccountMapping} from './account-mapping-contract.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Browser command shape. Actor identity and tenant are derived server-side. */
export function validXeroMappingConfirmation(value){
 if(!plain(value)||!exactKeys(value,['storeId','connectionId','effectiveFrom','mapping']))return false;
 return uuid.test(value.storeId)&&uuid.test(value.connectionId)&&date(value.effectiveFrom)&&!!validateXeroAccountMapping(value.mapping);
}
/** Value-free response shape for an authenticated current-store mapping read. */
export function parseXeroMappingView(value){
 if(!plain(value)||!exactKeys(value,['storeId','connectionId','tenantId','mappingVersionId','effectiveFrom','confirmedAt','mapping','readiness','shopifyComparison']))return null;
 if(!uuid.test(value.storeId)||!uuid.test(value.connectionId)||!uuid.test(value.mappingVersionId)||!identifier(value.tenantId)||!date(value.effectiveFrom)||!timestamp(value.confirmedAt)||value.shopifyComparison!=='not_requested')return null;
 const mapping=validateXeroAccountMapping(value.mapping);if(!mapping||!plain(value.readiness)||!exactKeys(value.readiness,['available','reason'])||typeof value.readiness.available!=='boolean'||!(value.readiness.reason===null||['account_directory_unavailable','account_directory_changed','account_mapping_incomplete','mapped_account_missing','mapped_account_inactive','mapped_account_wrong_type'].includes(value.readiness.reason)))return null;
 return Object.freeze({...value,mapping,readiness:Object.freeze({...value.readiness})});
}
const plain=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
const exactKeys=(value,keys)=>Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const identifier=value=>typeof value==='string'&&value.trim().length>0&&value.length<=256;
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(`${value}T00:00:00.000Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;};
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
