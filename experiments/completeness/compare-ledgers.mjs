import {eventDay} from '../financial-v1/event-evidence.mjs';
const fields=['orderId','timestamp','date','productExVat','shippingExVat','vat','cash'];
const check=(ok,message)=>{if(!ok)throw Error(message);};
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
/** Pure comparison of supplied normalized ledgers. A match is not proof of
 * independent provenance, collection completeness, eligibility or permission.
 * Amounts are nonnegative integer minor-unit magnitudes; type gives direction.
 */
export function compareLedgers({scope,reference,imported}){
 try{
  check(scope&&typeof scope.storeId==='string'&&scope.storeId.trim()&&/^[A-Z]{3}$/.test(scope.currency)&&day(scope.from)&&day(scope.to)&&scope.from<=scope.to,'INVALID_SCOPE');
  eventDay(`${scope.from}T00:00:00Z`,scope.timezone);
  const read=(ledger,label)=>{
   check(ledger&&typeof ledger.evidenceRef==='string'&&ledger.evidenceRef.trim()&&Array.isArray(ledger.events),'INVALID_LEDGER');
   check(['storeId','currency','timezone','from','to'].every(k=>ledger.scope?.[k]===scope[k]),'SCOPE_MISMATCH');
   const map=new Map(),duplicates=[];
   for(const row of ledger.events){
    check(row&&['sale','refund'].includes(row.type)&&typeof row.id==='string'&&row.id.trim()&&typeof row.orderId==='string'&&row.orderId.trim(),'INVALID_EVENT');
    check(row.storeId===scope.storeId&&row.currency===scope.currency,'EVENT_SCOPE_MISMATCH');
    check(['productExVat','shippingExVat','vat','cash'].every(k=>Number.isSafeInteger(row[k])&&row[k]>=0),'INVALID_AMOUNT');
    check(Number.isSafeInteger(row.productExVat+row.shippingExVat+row.vat)&&row.cash===row.productExVat+row.shippingExVat+row.vat,'COMPONENTS_DO_NOT_RECONCILE');
    const normalized={...row,date:eventDay(row.timestamp,scope.timezone),timestamp:new Date(row.timestamp).toISOString()};
    const key=JSON.stringify([row.type,row.id]);
    if(map.has(key))duplicates.push({kind:'duplicate_event',ledger:label,type:row.type,id:row.id});
    else map.set(key,normalized);
   }
   return {map,duplicates};
  };
  check(reference?.evidenceRef?.trim()!==imported?.evidenceRef?.trim(),'DISTINCT_EVIDENCE_REFERENCES_REQUIRED');
  const a=read(reference,'reference'),b=read(imported,'imported');
  const issues=[...a.duplicates,...b.duplicates];let comparedEvents=0;
  const selected=e=>e&&e.date>=scope.from&&e.date<=scope.to;
  // Include identities falling inside the period on EITHER side. A moved date
  // must not disappear from comparison merely because the import moved it out.
  for(const key of [...new Set([...a.map.keys(),...b.map.keys()])].sort()){
   const expected=a.map.get(key),actual=b.map.get(key);
   if(!selected(expected)&&!selected(actual))continue;
   comparedEvents++;
   const event=expected??actual,identity={type:event.type,id:event.id};
   if(!actual)issues.push({kind:'missing_imported_event',...identity});
   else if(!expected)issues.push({kind:'unexpected_imported_event',...identity});
   else{const changed=fields.filter(k=>expected[k]!==actual[k]);if(changed.length)issues.push({kind:'event_mismatch',...identity,fields:changed});}
  }
  return {status:issues.length?'differences_found':'matched_supplied_evidence',coverageCertified:false,comparedEvents,issues,
   reference:reference.evidenceRef,imported:imported.evidenceRef};
 }catch(e){return {status:'blocked',coverageCertified:false,issues:[{kind:e.message}]};}
}
