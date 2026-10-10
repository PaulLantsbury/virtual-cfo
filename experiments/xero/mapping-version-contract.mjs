import {validateXeroAccountMapping} from './account-mapping-contract.mjs';

/**
 * Validates an immutable, persistence-agnostic merchant mapping version.
 * It deliberately carries identifiers and selections only: never values,
 * report payloads, OAuth credentials, or Shopify data.
 */
export function validateXeroMappingVersion(value){
 if(!plain(value)||!exactKeys(value,['versionId','storeId','tenantId','effectiveFrom','confirmedAt','confirmedBy','mapping']))return null;
 if(!identifier(value.versionId)||!identifier(value.storeId)||!identifier(value.tenantId)||!identifier(value.confirmedBy)||!date(value.effectiveFrom)||!timestamp(value.confirmedAt))return null;
 const mapping=validateXeroAccountMapping(value.mapping);if(!mapping)return null;
 return Object.freeze({versionId:value.versionId,storeId:value.storeId,tenantId:value.tenantId,effectiveFrom:value.effectiveFrom,confirmedAt:value.confirmedAt,confirmedBy:value.confirmedBy,mapping});
}

/** Rejects using a version outside the authenticated store and pinned tenant. */
export function mappingVersionInScope({version,storeId,tenantId}={}){
 const valid=validateXeroMappingVersion(version);
 if(!valid||!identifier(storeId)||!identifier(tenantId)||valid.storeId!==storeId||valid.tenantId!==tenantId)return null;
 return valid;
}

const identifier=value=>typeof value==='string'&&value.trim().length>0&&value.length<=256;
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(`${value}T00:00:00.000Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;};
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const plain=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
const exactKeys=(value,keys)=>Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
