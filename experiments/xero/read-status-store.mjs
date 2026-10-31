import {mkdir,rename,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomBytes} from 'node:crypto';

const phases=new Set(['token_exchange','tenant_discovery','account_directory','report_snapshot','evidence_summary']);

/** Persists a non-sensitive status marker for local diagnosis of a read-only run. */
export async function writeLocalXeroReadStatus(path,status,{fs={mkdir,rename,writeFile}}={}){
 const keys=status&&Object.getPrototypeOf(status)===Object.prototype?Object.keys(status).sort().join(','):'';
 if(typeof path!=='string'||!path.endsWith('.json')||!status||!['phase,recordedAt','phase,reason,recordedAt'].includes(keys)||!phases.has(status.phase)||typeof status.recordedAt!=='string'||!Number.isFinite(Date.parse(status.recordedAt))||(status.reason!==undefined&&!['invalid_request','network_failure','upstream_refused','malformed_response'].includes(status.reason)))throw Error('Xero read status is invalid');
 const {phase,recordedAt,reason}=status;
 const directory=dirname(path),temporary=`${path}.${randomBytes(12).toString('hex')}.tmp`,body={source:'xero',phase,recordedAt,...(reason?{reason}:{})};
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 await fs.writeFile(temporary,`${JSON.stringify(body)}\n`,{encoding:'utf8',mode:0o600,flag:'wx'});
 await fs.rename(temporary,path);
 return Object.freeze(body);
}
