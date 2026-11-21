import type {XeroAccountMapping,XeroReadFs} from './contracts.mjs';
export function readLocalXeroAccountMapping(path:string,options?:{fs?:XeroReadFs}):Promise<XeroAccountMapping>;
