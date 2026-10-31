import {validateXeroAccountMapping} from './account-mapping-contract.mjs';

/**
 * Checks whether an owner-confirmed mapping can still be used with the latest
 * account directory. This is a mapping safety check only: it has no amounts,
 * does not select accounts, and never compares Xero with Shopify.
 */
export function assessXeroMappingReadiness({accounts,mapping}={}){
 if(!Array.isArray(accounts)||!accounts.every(validAccount))return unavailable('account_directory_unavailable');
 const approved=validateXeroAccountMapping(mapping);if(!approved)return unavailable('account_mapping_incomplete');
 const byId=new Map(accounts.map(account=>[account.id,account]));
 for(const [category,accountIds] of Object.entries(approved)){
  for(const accountId of accountIds){
   const account=byId.get(accountId);
   if(!account)return unavailable('mapped_account_missing');
   if(account.status!=='ACTIVE')return unavailable('mapped_account_inactive');
   if(!allowedTypes[category].has(account.type))return unavailable('mapped_account_wrong_type');
  }
 }
 return Object.freeze({available:true,reason:null,shopifyComparison:'not_requested'});
}

const unavailable=reason=>Object.freeze({available:false,reason,shopifyComparison:'not_requested'});
const allowedTypes=Object.freeze({revenue:new Set(['REVENUE','SALES']),processingFee:new Set(['OVERHEADS','EXPENSE']),advertising:new Set(['OVERHEADS','EXPENSE']),software:new Set(['OVERHEADS','EXPENSE']),includedCash:new Set(['BANK'])});
function validAccount(account){return account&&Object.getPrototypeOf(account)===Object.prototype&&Object.keys(account).sort().join(',')==='id,name,status,type'&&['id','name','type','status'].every(key=>typeof account[key]==='string'&&account[key].trim()!=='');}
