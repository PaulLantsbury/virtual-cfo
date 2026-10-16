import {open} from 'node:fs/promises';
import {validateReferenceFile} from './validate-reference-file.mjs';
// Local explicit file only. Fixed-size read prevents unbounded allocation.
let handle;
try{
 if(process.argv.length!==3)throw Error('usage');
 handle=await open(process.argv[2],'r');const stat=await handle.stat();if(!stat.isFile()||stat.size>1048576)throw Error('size');
 const buffer=Buffer.alloc(1048577);let used=0;
 while(used<buffer.length){const {bytesRead}=await handle.read(buffer,used,buffer.length-used,null);if(!bytesRead)break;used+=bytesRead;}
 if(used>1048576)throw Error('size');
 const contents=new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,used));const r=validateReferenceFile(contents);
 console.log(JSON.stringify({status:r.status,coverageCertified:false,eventCount:r.ledger?.events.length??null,issues:r.issues},null,2));process.exitCode=r.ledger?0:1;
}catch{console.error('Could not validate file. Provide one readable UTF-8 JSON file of at most 1 MiB.');process.exitCode=1;}finally{await handle?.close();}
