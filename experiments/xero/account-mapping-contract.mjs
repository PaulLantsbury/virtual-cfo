const categories=Object.freeze(['revenue','processingFee','advertising','software','includedCash']);
const unavailable=Object.freeze({available:false,reason:'account_mapping_incomplete',revenue:null,processingFee:null,advertising:null,software:null,includedCash:null,shopifyComparison:'not_requested'});

/**
 * Defines the accounts which are in scope for the first Xero accounting view.
 * Account ids, rather than labels, make the local mapping stable if a user renames
 * an account.  Every category must be mapped before any accounting value is shown.
 */
export function validateXeroAccountMapping(mapping){
 if(!plainObject(mapping)||!exactKeys(mapping,categories))return null;
 const normalized={};
 for(const category of categories){
  const ids=Array.isArray(mapping[category])?mapping[category]:[mapping[category]];
  if(!Array.isArray(ids)||ids.length===0||!ids.every(accountId))return null;
  normalized[category]=Object.freeze([...ids]);
 }
 const all=Object.values(normalized).flat();
 if(new Set(all).size!==all.length)return null;
 return Object.freeze(normalized);
}

/**
 * Produces only a Xero accounting view.  Shopify values are deliberately neither
 * accepted nor calculated here; source comparison is not part of this contract.
 */
export function xeroAccountingView({mapping,accountTotals}={}){
 const validMapping=validateXeroAccountMapping(mapping);
 if(!validMapping||!plainObject(accountTotals))return unavailable;
 const ids=Object.values(validMapping).flat();
 if(!ids.every(id=>Number.isSafeInteger(accountTotals[id])))return unavailable;
 const total=category=>validMapping[category].reduce((sum,id)=>sum+accountTotals[id],0);
 return Object.freeze({available:true,reason:null,revenue:total('revenue'),processingFee:total('processingFee'),advertising:total('advertising'),software:total('software'),includedCash:total('includedCash'),shopifyComparison:'not_requested'});
}

const accountId=value=>typeof value==='string'&&value.trim().length>0;
const plainObject=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
const exactKeys=(value,keys)=>Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
