import {mkdir,rename,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomBytes} from 'node:crypto';

const reports=['profitAndLoss','balanceSheet','trialBalance','bankSummary'];

/** Writes only the reviewed Xero summary.  Raw API responses never cross this boundary. */
export async function writeLocalXeroEvidenceSummary(path,summary,{fs={mkdir,rename,writeFile}}={}){
 if(typeof path!=='string'||!path.endsWith('.json')||!validSummary(summary))throw Error('Xero local evidence summary is invalid');
 const directory=dirname(path),temporary=`${path}.${randomBytes(12).toString('hex')}.tmp`;
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 await fs.writeFile(temporary,`${JSON.stringify(summary,null,2)}\n`,{encoding:'utf8',mode:0o600,flag:'wx'});
 await fs.rename(temporary,path);
 return Object.freeze({path,source:summary.source,reportDate:summary.reportDate,retrievedAt:summary.retrievedAt});
}

function validSummary(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||!hasExactKeys(value,['source','tenantId','reportDate','retrievedAt','baseCurrency','reports','shopifyComparison']))return false;
 if(value.source!=='xero'||typeof value.tenantId!=='string'||!value.tenantId||!date(value.reportDate)||!timestamp(value.retrievedAt)||typeof value.baseCurrency!=='string'||!value.baseCurrency||value.shopifyComparison!=='not_requested')return false;
 if(!value.reports||Object.getPrototypeOf(value.reports)!==Object.prototype||!hasExactKeys(value.reports,reports))return false;
 return reports.every(key=>typeof value.reports[key]==='string'&&value.reports[key].trim().length>0);
}
const hasExactKeys=(value,expected)=>Object.keys(value).sort().join(',')===expected.slice().sort().join(',');
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
