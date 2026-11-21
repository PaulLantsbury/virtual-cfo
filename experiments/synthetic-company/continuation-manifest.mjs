/** Pure offline manifest assembly. Supplied readback proofs are assertions to validate,
 * not newly observed receipts. No generator clock, SQL, network, activation or replay. */
import {createHash} from 'node:crypto';
import {RESERVED_SYNTHETIC_IDENTITY} from './staging-payload.mjs';
const fail=(ok,message)=>{if(!ok)throw Error(message);};
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
function boundedJSON(value){
 let nodes=0;const path=new Set();
 function visit(v,depth){fail(++nodes<=100000&&depth<=16,'Manifest JSON exceeds bounds');if(v===null||typeof v==='boolean')return;if(typeof v==='string'){fail(v.length<=5000000,'Manifest string bound exceeded');return;}
 if(typeof v==='number'){fail(Number.isSafeInteger(v)&&!Object.is(v,-0),'Unsafe manifest number');return;}
 const array=Array.isArray(v);fail(typeof v==='object'&&!path.has(v)&&(array?Object.getPrototypeOf(v)===Array.prototype:Object.getPrototypeOf(v)===Object.prototype),'Non-JSON manifest input');
 fail(Object.getOwnPropertySymbols(v).length===0,'Symbol manifest input');const descriptors=Object.getOwnPropertyDescriptors(v);
 if(array)fail(v.length<=100000,'Manifest array bound exceeded');
 if(array)fail(Object.keys(descriptors).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.hasOwn(descriptors,String(i))).every(Boolean),'Sparse/extended manifest array');
 path.add(v);for(const [key,d]of Object.entries(descriptors)){if(array&&key==='length')continue;fail(d.enumerable&&Object.hasOwn(d,'value'),'Accessor/nonenumerable manifest input');visit(d.value,depth+1);}path.delete(v);
 }
 visit(value,0);const text=JSON.stringify(value);fail(text.length<=5000000,'Manifest byte bound exceeded');return text;
}
const deepFreeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const plusDay=v=>new Date(Date.parse(v+'T12:00:00Z')+86400000).toISOString().slice(0,10);
const endOf=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).toISOString().slice(0,10);
const nextMonth=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),1)).toISOString().slice(0,7);
export const CONTINUATION_MANIFEST_BOUNDARY=Object.freeze({storeId:RESERVED_SYNTHETIC_IDENTITY.storeId,company:'fictional-uk-gifts',profile:'uk-gifts-v2',currency:'GBP',timezone:'Europe/London',from:'2026-12-20',through:'2027-03-19',dayCount:90,
 dailyHash:'1cf5ec6dd9c128fe4209642637d56df049505cb31421fdc9e14592ec3f54e5a8',eventHash:'28d60972176cd93255eeea7cf2acb593ccd3dcd3d88af80e4fd7143304c37d29',
 prefixDailyHash:'164a189f01a1913ec192533ee1aa5de553cdaaee3e583810f749d3884e559a3c',prefixEventHash:'47112998f85c7edfa532bf46d7c796d3e5e2dc9e0555d7f47b508590c620d570'});
const scope=s=>!!s&&s.storeId===CONTINUATION_MANIFEST_BOUNDARY.storeId&&s.currency==='GBP'&&s.timezone==='Europe/London';
/** Existing rows must carry independently read back body hashes. No placeholder inventory or rewrite. */
export function prepareContinuationManifest(input={}){
 const {continuation,observedThroughLondon,existingRows,expectedInventoryHash,refreshMonths=[]}=JSON.parse(boundedJSON(input));
 const b=CONTINUATION_MANIFEST_BOUNDARY;
 fail(date(observedThroughLondon),'Explicit observed London date required');
 fail(continuation&&continuation.contract==='synthetic-continuation-proposal-v1'&&continuation.state==='prepared-only'&&continuation.observed===false&&continuation.remoteApplied===false,'Offline continuation proposal required');
 fail(['company','profile','currency','timezone','from','through','dayCount'].every(k=>continuation[k]===b[k])&&continuation.asOf==='2027-03-20'&&continuation.eventCount===10947&&continuation.publishedThrough==='2026-11-19'&&continuation.previouslyReviewedThrough==='2026-12-19','Exact finite continuation boundary required');
 fail(continuation.candidate?.dailyHash===b.dailyHash&&continuation.candidate?.eventHash===b.eventHash&&continuation.candidate?.futureDated===true&&continuation.candidate?.sourceMode==='offline-synthetic-fixture','Continuation source hashes differ');
 fail(continuation.protectedPrefix?.through==='2026-11-19'&&continuation.protectedPrefix.dailyRows===749&&continuation.protectedPrefix.events===95338&&continuation.protectedPrefix.dailyHash===b.prefixDailyHash&&continuation.protectedPrefix.eventHash===b.prefixEventHash,'Protected generated prefix differs');
 fail(Array.isArray(existingRows)&&existingRows.length===48&&sha(expectedInventoryHash),'Exact protected inventory with readback hash required');
 const inventory=existingRows.map(r=>{fail(r&&scope(r)&&typeof r.month==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)&&['cash','acquisition'].includes(r.kind)&&id(r.financialVersionId)&&sha(r.bodyHash),'Malformed protected summary identity');return {storeId:r.storeId,currency:r.currency,timezone:r.timezone,month:r.month,kind:r.kind,financialVersionId:r.financialVersionId,bodyHash:r.bodyHash};}).sort((a,b)=>a.month.localeCompare(b.month)||a.kind.localeCompare(b.kind));
 const keys=new Set(inventory.map(r=>r.month+':'+r.kind));
 fail(keys.size===48,'Duplicate protected summary');
 for(let m='2024-11';m<='2026-10';m=nextMonth(m))for(const kind of ['cash','acquisition'])fail(keys.has(m+':'+kind),'Original 48 summaries must remain exact');
 fail(digest(inventory)===expectedInventoryHash,'Protected inventory readback hash mismatch');
 fail(Array.isArray(refreshMonths)&&refreshMonths.length<=4,'At most November–February closed-month refresh candidates');
 const refresh=[];let next='2026-11';const seenReceipts=new Set();
 for(const m of refreshMonths){
  fail(m&&m.month===next,'Refresh cannot skip an unpublished or unknown month');
  const from=next+'-01',to=endOf(next);
  fail(to<observedThroughLondon&&to<=b.through,'Open or beyond-ceiling month cannot refresh');
  fail(scope(m)&&m.from===from&&m.to===to&&m.state==='verified'&&m.completeCoverage===true&&id(m.financialVersionId)&&sha(m.salesRevision)&&sha(m.costRevision)&&sha(m.cashHash)&&sha(m.acquisitionHash),'Exact closed-month financial and compiled source bindings required');
  fail(Array.isArray(m.coverageProofs)&&m.coverageProofs.length<=31,'Bounded daily coverage proofs required');
  const proofs=[];let day=from;
  for(const r of m.coverageProofs){
   fail(r&&r.date===day&&scope(r)&&r.state==='verified'&&id(r.proofId)&&!seenReceipts.has(r.proofId)&&sha(r.proofHash)&&sha(r.sourceHash)&&id(r.financialVersionId)&&r.financialVersionId===m.financialVersionId,'Missing, duplicate, unknown or out-of-order daily coverage');
   const expectedMode=day<='2026-11-04'?'sealed-prefix':day<='2026-11-19'?'approved-historical-publication':'genuine-scheduled';
   fail(r.sourceMode===expectedMode,'Historical coverage must retain its actual provenance; future coverage requires scheduled evidence');
   let references;
   if(expectedMode==='sealed-prefix'){fail(sha(r.sealHash),'Sealed prefix witness required');references={sealHash:r.sealHash};}
   else if(expectedMode==='approved-historical-publication'){fail(typeof r.approvalRef==='string'&&r.approvalRef.trim().length>0&&r.approvalRef.length<=256&&id(r.publicationId)&&sha(r.publicationHash),'Approved historical publication references required');references={approvalRef:r.approvalRef,publicationId:r.publicationId,publicationHash:r.publicationHash};}
   else{fail(id(r.runId)&&sha(r.runReceiptHash),'Genuine scheduled run receipt reference required');references={runId:r.runId,runReceiptHash:r.runReceiptHash};}
   seenReceipts.add(r.proofId);proofs.push({date:r.date,proofId:r.proofId,proofHash:r.proofHash,sourceHash:r.sourceHash,financialVersionId:r.financialVersionId,sourceMode:r.sourceMode,...references});day=plusDay(day);
  }
  fail(day===plusDay(to),'Every closed-month day requires exact classified coverage readback');
  refresh.push({month:next,from,to,financialVersionId:m.financialVersionId,salesRevision:m.salesRevision,costRevision:m.costRevision,cashHash:m.cashHash,acquisitionHash:m.acquisitionHash,coverageProofsHash:digest(proofs),coverageProofs:proofs});next=nextMonth(next);
 }
 const manifest={contract:'synthetic-continuation-manifest-v1',state:'offline-review-only',remoteApplied:false,observedReceiptsByThisModule:false,scope:{storeId:b.storeId,company:b.company,profile:b.profile,currency:b.currency,timezone:b.timezone},continuation:{from:b.from,through:b.through,dayCount:90,eventCount:10947,dailyHash:b.dailyHash,eventHash:b.eventHash,generatedPrefixThrough:'2026-11-19',prefixDailyHash:b.prefixDailyHash,prefixEventHash:b.prefixEventHash},observedThroughLondon,protectedInventory:{rows:48,hash:expectedInventoryHash,updateAllowed:false,invalidateAllowed:false,recreateAllowed:false},refresh,nextUnpublishedMonth:next,activationAllowed:false};
 return deepFreeze({...manifest,manifestHash:digest(manifest)});
}
export function continuationInventoryHash(input){const rows=JSON.parse(boundedJSON(input));fail(Array.isArray(rows)&&rows.length===48,'Exact inventory count required');return digest(rows.map(r=>({storeId:r.storeId,currency:r.currency,timezone:r.timezone,month:r.month,kind:r.kind,financialVersionId:r.financialVersionId,bodyHash:r.bodyHash})).sort((a,b)=>a.month.localeCompare(b.month)||a.kind.localeCompare(b.kind)));}
