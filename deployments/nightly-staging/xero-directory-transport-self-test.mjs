/** Fictional transport proof only: no environment, files, database, credentials or network. */
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export function fictionalTransportLines(){
 const accounts=[{id:'fictional-account',name:'FICTIONAL transport test',type:'REVENUE',status:'ACTIVE'}];
 const sha256=createHash('sha256').update(JSON.stringify(accounts)).digest('hex');
 const bytes=Buffer.from(JSON.stringify({kind:'fictional_transport_fixture',retrievedAt:'2000-01-01T00:00:00.000Z',sha256,accounts})+'\n');
 const wireHash=createHash('sha256').update(bytes).digest('hex'),operationId='00000000-0000-4000-8000-000000000001';
 return Object.freeze([
  JSON.stringify({kind:'xero-directory-transport-self-test-v1',operationId,index:0,count:1,sha256:wireHash,data:bytes.toString('base64')}),
  JSON.stringify({state:'fictional-transport-self-test',operationId,snapshotFileSha256:wireHash,frameCount:1})
 ]);
}
export function runFictionalTransport(args,write){
 if(args.length!==2||args[0]!=='--transport-self-test'||args[1]!=='--private-render-log-snapshot')return 1;
 for(const line of fictionalTransportLines())write(line+'\n');return 0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){process.exitCode=runFictionalTransport(process.argv.slice(2),line=>process.stdout.write(line));}
