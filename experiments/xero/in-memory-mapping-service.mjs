import {validXeroMappingConfirmation,parseXeroMappingView} from './mapping-api-contract.mjs';
import {assessXeroMappingReadiness} from './mapping-readiness.mjs';
import {createHash} from 'node:crypto';

/** Disposable service model for authenticated mapping behaviour; it has no I/O. */
export function createInMemoryXeroMappingService({memberships=[],connections=[],directories=[],now=()=>new Date().toISOString()}={}){
 memberships=memberships.map(value=>Object.freeze({...value}));connections=connections.map(value=>Object.freeze({...value}));directories=directories.map(canonicalDirectory);
 assertUniqueDirectoryTimestamps(directories);
 const versions=[],audits=[];
 const member=(userId,storeId)=>memberships.some(x=>x.userId===userId&&x.storeId===storeId);
 const owner=(userId,storeId)=>memberships.some(x=>x.userId===userId&&x.storeId===storeId&&x.role==='owner');
 const connection=(storeId,connectionId)=>connections.find(x=>x.storeId===storeId&&x.id===connectionId&&x.retired!==true);
 const latestDirectory=connectionId=>directories.filter(x=>x.connectionId===connectionId).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt))[0];
 const requireAccess=(context,storeId)=>{if(!context?.userId)throw Error('Sign-in required');if(!member(context.userId,storeId))throw Error('Mapping access unavailable');};
 function confirmMapping(context,command){
  if(!validXeroMappingConfirmation(command))throw Error('Invalid mapping request');requireAccess(context,command.storeId);if(!owner(context.userId,command.storeId))throw Error('Mapping access unavailable');
  const conn=connection(command.storeId,command.connectionId);if(!conn)throw Error('Xero connection unavailable');
  const directory=latestDirectory(conn.id);if(!directory)throw Error('Xero directory review required');
  const readiness=assessXeroMappingReadiness({accounts:directory.accounts,mapping:command.mapping});if(!readiness.available)throw Error('Xero mapping review required');
  const confirmedAt=canonicalTimestamp(now());if(!confirmedAt)throw Error('Mapping service unavailable');const lineage=versions.filter(x=>x.connectionId===conn.id),prior=lineage.at(-1);if(lineage.some(x=>x.effectiveFrom>=command.effectiveFrom))throw Error('Xero mapping changed');const version={id:versionId(versions.length+1),version:lineage.length+1,storeId:command.storeId,connectionId:conn.id,tenantId:conn.tenantId,effectiveFrom:command.effectiveFrom,confirmedAt,confirmedBy:context.userId,mapping:freezeMapping(command.mapping),directoryRetrievedAt:directory.retrievedAt,directorySnapshotId:snapshotId(directory),supersedesId:prior?.id??null};
  versions.push(Object.freeze(version));audits.push(Object.freeze({connectionId:conn.id,mappingVersionId:version.id,action:'confirmed',actorId:context.userId,occurredAt:version.confirmedAt}));return view(version,readiness);
 }
 function readCurrentMapping(context,{storeId,connectionId,asOf=now().slice(0,10)}={}){if(!validDate(asOf))throw Error('Invalid mapping request');requireAccess(context,storeId);const conn=connection(storeId,connectionId);if(!conn)throw Error('Xero connection unavailable');const version=versions.filter(x=>x.connectionId===conn.id&&x.effectiveFrom<=asOf).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)||a.version-b.version).at(-1);if(!version)return null;const directory=latestDirectory(conn.id);const readiness=!directory?{available:false,reason:'account_directory_unavailable'}:snapshotId(directory)!==version.directorySnapshotId?{available:false,reason:'account_directory_changed'}:assessXeroMappingReadiness({accounts:directory.accounts,mapping:version.mapping});return view(version,readiness);}
 /**
  * A member may inspect their connection's confirmed history before choosing a
  * replacement mapping. This deliberately returns the same value-free view as
  * the current read: no directory payload, audit actor, snapshot identifier,
  * or internal lineage fields escape this disposable boundary.
  */
 function readMappingHistory(context,{storeId,connectionId}={}){
  requireAccess(context,storeId);
  const conn=connection(storeId,connectionId);if(!conn)throw Error('Xero connection unavailable');
  const directory=latestDirectory(conn.id);
  const history=versions.filter(x=>x.connectionId===conn.id).sort((a,b)=>a.version-b.version).map(version=>{
   const readiness=!directory?{available:false,reason:'account_directory_unavailable'}:snapshotId(directory)!==version.directorySnapshotId?{available:false,reason:'account_directory_changed'}:assessXeroMappingReadiness({accounts:directory.accounts,mapping:version.mapping});
   return view(version,readiness);
  });
  return Object.freeze(history);
 }
 function recordDirectorySnapshot(directory){
  const canonical=canonicalDirectory(directory);if(!connections.some(x=>x.id===canonical.connectionId))throw Error('Xero connection unavailable');
  const latest=latestDirectory(canonical.connectionId);if(latest&&canonical.retrievedAt<=latest.retrievedAt)throw Error('Xero directory timestamp changed');
  directories.push(canonical);return Object.freeze({connectionId:canonical.connectionId,retrievedAt:canonical.retrievedAt,directorySnapshotId:snapshotId(canonical)});
 }
 return Object.freeze({confirmMapping,readCurrentMapping,readMappingHistory,recordDirectorySnapshot,inspect:()=>Object.freeze({versions:Object.freeze([...versions]),audits:Object.freeze([...audits])})});
}
function view(version,readiness){return parseXeroMappingView({storeId:version.storeId,connectionId:version.connectionId,tenantId:version.tenantId,mappingVersionId:version.id,effectiveFrom:version.effectiveFrom,confirmedAt:version.confirmedAt,mapping:version.mapping,readiness:{available:readiness.available,reason:readiness.reason},shopifyComparison:'not_requested'});}
function freezeMapping(mapping){return Object.freeze(Object.fromEntries(Object.entries(mapping).map(([key,value])=>[key,Object.freeze(Array.isArray(value)?[...value]:[value])])));}
function versionId(n){return `90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;}
// Source timestamps are normalized at this value-free boundary.  Lexical
// comparisons are used to choose the latest directory, so accepting two
// spellings of one instant (or a Date.parse-normalized impossible date) would
// make history ordering and duplicate detection unreliable.
function canonicalTimestamp(value){
 const match=typeof value==='string'&&value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,3})?Z$/);
 if(!match)return null;
 const parsed=new Date(value);
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19)===match[1]?parsed.toISOString():null;
}
const validTimestamp=value=>canonicalTimestamp(value)!==null;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(`${value}T00:00:00.000Z`).toISOString().slice(0,10)===value;
function canonicalDirectory(directory){
 if(!directory||typeof directory!=='object'||typeof directory.connectionId!=='string'||!validTimestamp(directory.retrievedAt)||!Array.isArray(directory.accounts))throw Error('Invalid Xero directory');
 const ids=new Set();const accounts=directory.accounts.map(account=>{
  if(!account||typeof account!=='object'||!['id','name','type','status'].every(key=>typeof account[key]==='string'&&account[key].length>0))throw Error('Invalid Xero directory');
  if(ids.has(account.id))throw Error('Duplicate Xero account');ids.add(account.id);return Object.freeze({id:account.id,name:account.name,type:account.type,status:account.status});
 }).sort((left,right)=>left.id.localeCompare(right.id)||left.name.localeCompare(right.name)||left.type.localeCompare(right.type)||left.status.localeCompare(right.status));
 return Object.freeze({connectionId:directory.connectionId,retrievedAt:canonicalTimestamp(directory.retrievedAt),accounts:Object.freeze(accounts)});
}
function assertUniqueDirectoryTimestamps(directories){const seen=new Set();for(const directory of directories){const key=`${directory.connectionId}\u0000${directory.retrievedAt}`;if(seen.has(key))throw Error('Duplicate Xero directory timestamp');seen.add(key);}}
const snapshotId=directory=>createHash('sha256').update(JSON.stringify({connectionId:directory.connectionId,retrievedAt:directory.retrievedAt,accounts:directory.accounts.map(({id,name,type,status})=>({id,name,type,status}))})).digest('hex');
