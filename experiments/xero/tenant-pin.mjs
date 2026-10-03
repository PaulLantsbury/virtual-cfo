import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomBytes} from 'node:crypto';

const valid=value=>typeof value==='string'&&value.length>0&&value.length<=256;

/** Pins the sole approved Xero test tenant in a local owner-only file. */
export async function pinXeroTenant(path,tenant,{fs={mkdir,readFile,rename,writeFile}}={}){
 if(typeof path!=='string'||!path.endsWith('.json')||!tenant||!valid(tenant.tenantId)||(tenant.tenantName!==undefined&&!valid(tenant.tenantName)))throw Error('Xero tenant pin is invalid');
 let prior;
 try{prior=JSON.parse(await fs.readFile(path,'utf8'));}catch(error){if(error?.code!=='ENOENT')throw Error('Xero tenant pin is unavailable');}
 if(prior){
  if(!valid(prior.tenantId)||prior.tenantId!==tenant.tenantId)throw Error('Xero tenant changed; explicit local reset required');
  return Object.freeze({tenantId:prior.tenantId,tenantName:prior.tenantName});
 }
 const pinned={tenantId:tenant.tenantId,...(tenant.tenantName?{tenantName:tenant.tenantName}:{})};
 const temporary=`${path}.${randomBytes(12).toString('hex')}.tmp`;
 await fs.mkdir(dirname(path),{recursive:true,mode:0o700});
 await fs.writeFile(temporary,`${JSON.stringify(pinned)}\n`,{encoding:'utf8',mode:0o600,flag:'wx'});
 await fs.rename(temporary,path);
 return Object.freeze(pinned);
}
