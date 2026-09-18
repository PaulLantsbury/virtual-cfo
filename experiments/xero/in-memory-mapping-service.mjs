import {validXeroMappingConfirmation,parseXeroMappingView} from './mapping-api-contract.mjs';
import {assessXeroMappingReadiness} from './mapping-readiness.mjs';
import {createHash} from 'node:crypto';

/** Disposable service model for authenticated mapping behaviour; it has no I/O. */
export function createInMemoryXeroMappingService({memberships=[],connections=[],directories=[],now=()=>new Date().toISOString()}={}){
 memberships=memberships.map(value=>Object.freeze({...value}));connections=connections.map(value=>Object.freeze({...value}));directories=directories.map(value=>Object.freeze({...value,accounts:Object.freeze(value.accounts?.map(account=>Object.freeze({...account}))??[])}));
 const versions=[],audits=[];
 const member=(userId,storeId)=>memberships.some(x=>x.userId===userId&&x.storeId===storeId);
 const connection=(storeId,connectionId)=>connections.find(x=>x.storeId===storeId&&x.id===connectionId&&x.retired!==true);
 const latestDirectory=connectionId=>directories.filter(x=>x.connectionId===connectionId&&validTimestamp(x.retrievedAt)).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt))[0];
 const requireAccess=(context,storeId)=>{if(!context?.userId)throw Error('Sign-in required');if(!member(context.userId,storeId))throw Error('Mapping access unavailable');};
 function confirmMapping(context,command){
  if(!validXeroMappingConfirmation(command))throw Error('Invalid mapping request');requireAccess(context,command.storeId);
  const conn=connection(command.storeId,command.connectionId);if(!conn)throw Error('Xero connection unavailable');
  const directory=latestDirectory(conn.id);if(!directory)throw Error('Xero directory review required');
  const readiness=assessXeroMappingReadiness({accounts:directory.accounts,mapping:command.mapping});if(!readiness.available)throw Error('Xero mapping review required');
  const confirmedAt=now();if(!validTimestamp(confirmedAt))throw Error('Mapping service unavailable');const lineage=versions.filter(x=>x.connectionId===conn.id),prior=lineage.at(-1);if(lineage.some(x=>x.effectiveFrom>=command.effectiveFrom))throw Error('Xero mapping changed');const version={id:versionId(versions.length+1),version:lineage.length+1,storeId:command.storeId,connectionId:conn.id,tenantId:conn.tenantId,effectiveFrom:command.effectiveFrom,confirmedAt,confirmedBy:context.userId,mapping:freezeMapping(command.mapping),directoryRetrievedAt:directory.retrievedAt,directorySnapshotId:snapshotId(directory),supersedesId:prior?.id??null};
  versions.push(Object.freeze(version));audits.push(Object.freeze({connectionId:conn.id,mappingVersionId:version.id,action:'confirmed',actorId:context.userId,occurredAt:version.confirmedAt}));return view(version,readiness);
 }
 function readCurrentMapping(context,{storeId,connectionId,asOf=now().slice(0,10)}={}){if(!validDate(asOf))throw Error('Invalid mapping request');requireAccess(context,storeId);const conn=connection(storeId,connectionId);if(!conn)throw Error('Xero connection unavailable');const version=versions.filter(x=>x.connectionId===conn.id&&x.effectiveFrom<=asOf).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)||a.version-b.version).at(-1);if(!version)return null;const directory=latestDirectory(conn.id);const readiness=directory?assessXeroMappingReadiness({accounts:directory.accounts,mapping:version.mapping}):{available:false,reason:'account_directory_unavailable'};return view(version,readiness);}
 return Object.freeze({confirmMapping,readCurrentMapping,inspect:()=>Object.freeze({versions:Object.freeze([...versions]),audits:Object.freeze([...audits])})});
}
function view(version,readiness){return parseXeroMappingView({storeId:version.storeId,connectionId:version.connectionId,tenantId:version.tenantId,mappingVersionId:version.id,effectiveFrom:version.effectiveFrom,confirmedAt:version.confirmedAt,mapping:version.mapping,readiness:{available:readiness.available,reason:readiness.reason},shopifyComparison:'not_requested'});}
function freezeMapping(mapping){return Object.freeze(Object.fromEntries(Object.entries(mapping).map(([key,value])=>[key,Object.freeze(Array.isArray(value)?[...value]:[value])])));}
function versionId(n){return `90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;}
const validTimestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(`${value}T00:00:00.000Z`).toISOString().slice(0,10)===value;
const snapshotId=directory=>createHash('sha256').update(JSON.stringify({connectionId:directory.connectionId,retrievedAt:directory.retrievedAt,accounts:directory.accounts.map(({id,name,type,status})=>({id,name,type,status}))})).digest('hex');
