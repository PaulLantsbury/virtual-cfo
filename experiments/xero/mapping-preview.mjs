import {readFile} from 'node:fs/promises';
import {suggestXeroAccountMappings} from './account-mapping-suggestions.mjs';
import {validateXeroAccountMapping} from './account-mapping-contract.mjs';

const categories=Object.freeze(['revenue','processingFee','advertising','software','includedCash']);

/** Reads only the redacted local account directory created by a prior Xero read. */
export async function readLocalXeroAccountDirectory(path,{fs={readFile}}={}){
 if(typeof path!=='string'||!path.endsWith('.json'))throw Error('Xero account directory is unavailable');
 let directory;try{directory=JSON.parse(await fs.readFile(path,'utf8'));}catch{throw Error('Xero account directory is unavailable');}
 if(!validDirectory(directory))throw Error('Xero account directory is unavailable');
 return Object.freeze({source:'xero',tenantId:directory.tenantId,retrievedAt:directory.retrievedAt,accounts:Object.freeze(directory.accounts.map(account=>Object.freeze({...account})))});
}

/** Produces a review-only local preview. It never changes or infers a mapping. */
export function buildXeroMappingPreview({accounts,mapping}={}){
 if(!Array.isArray(accounts)||!accounts.every(validAccount))throw Error('Xero mapping preview is unavailable');
 const approved=validateXeroAccountMapping(mapping);if(!approved)throw Error('Xero mapping preview is unavailable');
 const byId=new Map(accounts.map(account=>[account.id,account]));
 const confirmed={};
 for(const category of categories){
  const selected=approved[category].map(id=>byId.get(id));
  if(selected.some(account=>!account||account.status!=='ACTIVE'))throw Error('Xero mapping preview is unavailable');
  confirmed[category]=Object.freeze(selected.map(({id,name,type,status})=>Object.freeze({id,name,type,status})));
 }
 const suggestions=suggestXeroAccountMappings(accounts);
 return Object.freeze({source:'xero',mappingStatus:'owner_confirmed_local_test',categories:Object.freeze(categories.map(category=>Object.freeze({category,confirmed:confirmed[category],suggestion:suggestions[category]})))});
}

function validDirectory(value){return value&&Object.getPrototypeOf(value)===Object.prototype&&value.source==='xero'&&typeof value.tenantId==='string'&&value.tenantId.trim()!==''&&typeof value.retrievedAt==='string'&&Number.isFinite(Date.parse(value.retrievedAt))&&Array.isArray(value.accounts)&&value.accounts.every(validAccount);}
function validAccount(account){return account&&Object.getPrototypeOf(account)===Object.prototype&&Object.keys(account).sort().join(',')==='id,name,status,type'&&['id','name','type','status'].every(key=>typeof account[key]==='string'&&account[key].trim()!=='');}
