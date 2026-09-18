import {mkdir,rename,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomBytes} from 'node:crypto';

/** Stores the owner-reviewed account directory and no balances, settings, or transactions. */
export async function writeLocalXeroAccountDirectory(path,{tenantId,retrievedAt,accounts},{fs={mkdir,rename,writeFile}}={}){
 if(typeof path!=='string'||!path.endsWith('.json')||!validDirectory({tenantId,retrievedAt,accounts}))throw Error('Xero account directory is invalid');
 const directory=dirname(path),temporary=`${path}.${randomBytes(12).toString('hex')}.tmp`;
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 await fs.writeFile(temporary,`${JSON.stringify({source:'xero',tenantId,retrievedAt,accounts},null,2)}\n`,{encoding:'utf8',mode:0o600,flag:'wx'});
 await fs.rename(temporary,path);
 return Object.freeze({path,tenantId,retrievedAt,accountCount:accounts.length});
}

function validDirectory({tenantId,retrievedAt,accounts}={}){
 if(typeof tenantId!=='string'||tenantId.trim()===''||typeof retrievedAt!=='string'||!Number.isFinite(Date.parse(retrievedAt))||!Array.isArray(accounts))return false;
 const ids=new Set();
 return accounts.every(account=>{
  if(!account||Object.getPrototypeOf(account)!==Object.prototype||Object.keys(account).sort().join(',')!=='id,name,status,type')return false;
  if(!['id','name','type','status'].every(key=>typeof account[key]==='string'&&account[key].trim()!==''&&account[key].length<=256)||ids.has(account.id))return false;
  ids.add(account.id);return true;
 });
}
