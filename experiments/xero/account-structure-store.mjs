import {mkdir,rename,writeFile} from 'node:fs/promises';import {dirname} from 'node:path';import {randomBytes} from 'node:crypto';
/** Stores a redacted selected-account report structure profile, never account labels or amounts. */
export async function writeLocalXeroAccountStructure(path,{retrievedAt,structure},{fs={mkdir,rename,writeFile}}={}){
 if(typeof path!=='string'||!path.endsWith('.json')||typeof retrievedAt!=='string'||!Number.isFinite(Date.parse(retrievedAt))||!valid(structure))throw Error('Xero account structure is invalid');
 const body={source:'xero',retrievedAt,structure},temporary=`${path}.${randomBytes(12).toString('hex')}.tmp`;await fs.mkdir(dirname(path),{recursive:true,mode:0o700});await fs.writeFile(temporary,`${JSON.stringify(body)}\n`,{encoding:'utf8',mode:0o600,flag:'wx'});await fs.rename(temporary,path);return Object.freeze({path,retrievedAt});
}
function valid(value){return value&&Object.getPrototypeOf(value)===Object.prototype&&['profitAndLoss','balanceSheet'].every(key=>validReport(value[key]));}
function validReport(value){return value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join(',')==='accountAttributeRows,cellCounts,foundAccountIds,missingAccountIds,selectedAccountIds'&&['selectedAccountIds','foundAccountIds','missingAccountIds'].every(key=>Array.isArray(value[key])&&value[key].every(x=>typeof x==='string'&&x!==''))&&Array.isArray(value.cellCounts)&&value.cellCounts.every(Number.isInteger)&&Number.isInteger(value.accountAttributeRows)&&value.accountAttributeRows>=0;}
