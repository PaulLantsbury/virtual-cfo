import {readFile} from 'node:fs/promises';
import {validateXeroAccountMapping} from './account-mapping-contract.mjs';

/** Reads the owner-approved local mapping; no fallback mapping is ever inferred. */
export async function readLocalXeroAccountMapping(path,{fs={readFile}}={}){
 if(typeof path!=='string'||!path.endsWith('.json'))throw Error('Xero account mapping is unavailable');
 let value;try{value=JSON.parse(await fs.readFile(path,'utf8'));}catch{throw Error('Xero account mapping is unavailable');}
 const mapping=validateXeroAccountMapping(value);if(!mapping)throw Error('Xero account mapping is unavailable');
 return mapping;
}
