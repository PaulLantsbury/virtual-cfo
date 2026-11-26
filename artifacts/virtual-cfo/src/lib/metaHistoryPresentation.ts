/** UI-only adapter for the offline history proposal; not a network or authorization boundary. */
export type MetaHistoryLineage=Readonly<{storeId:string;accountId:string;connectionId:string;from:string;to:string;version:string}>;
export type MetaHistoryDisplayContext=Readonly<{lineage:MetaHistoryLineage;currency:string;timeZone:string}>;
export type MetaHistoryDay=Readonly<{date:string;amountMinor:string|null;observedAt:string|null;runId:string|null;coverage:'reported'|'unknown'}>;
type Withheld=Readonly<{state:'withheld';connectionLabel:string;evidenceLabel:string;days:readonly MetaHistoryDay[];subtotalMinor:null}>;
type Accepted=Readonly<{state:'available'|'unavailable';connectionLabel:string;evidenceLabel:string;lineage:MetaHistoryLineage;currency:string;timeZone:string;days:readonly MetaHistoryDay[];subtotalMinor:string|null}>;
export type MetaHistoryPresentation=Withheld|Accepted;
const lineageKeys=['storeId','accountId','connectionId','from','to','version'] as const;
const withheld=():Withheld=>Object.freeze({state:'withheld',connectionLabel:'Meta connection not confirmed for this selection',evidenceLabel:'Saved spend withheld',days:Object.freeze([]),subtotalMinor:null});
function record(value:unknown,keys:readonly string[]):Record<string,unknown>|null{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)return null;
 const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(value);
 if(actual.length!==keys.length||actual.some(key=>typeof key!=='string'||!keys.includes(key)||!('value' in descriptors[key])))return null;
 return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
}
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=256&&!/[\x00-\x1f\x7f]/.test(v);
const day=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const instant=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.test(v)&&day(v.slice(0,10))&&Number.isFinite(Date.parse(v));
function lineage(value:unknown):MetaHistoryLineage|null{
 const r=record(value,lineageKeys);if(!r||!lineageKeys.every(k=>text(r[k]))||!day(r.from)||!day(r.to)||r.from>r.to)return null;
 return Object.freeze(r as MetaHistoryLineage);
}
function same(a:MetaHistoryLineage,b:MetaHistoryLineage){return lineageKeys.every(k=>a[k]===b[k]);}
function rows(value:unknown,scope:MetaHistoryLineage):readonly MetaHistoryDay[]|null{
 if(!Array.isArray(value))return null;
 const first=Date.parse(scope.from+'T00:00:00Z'),count=(Date.parse(scope.to+'T00:00:00Z')-first)/86400000+1;
 if(count<1||count>93||value.length!==count||Reflect.ownKeys(value).length!==count+1)return null;
 const result:MetaHistoryDay[]=[];
 for(let i=0;i<count;i++){
  const descriptor=Object.getOwnPropertyDescriptor(value,String(i));if(!descriptor||!('value' in descriptor))return null;
  const r=record(descriptor.value,['date','amountMinor','observedAt','runId','coverage']);
  if(!r||r.date!==new Date(first+i*86400000).toISOString().slice(0,10)||!(r.coverage==='reported'||r.coverage==='unknown'))return null;
  if(r.coverage==='reported'){
   if(typeof r.amountMinor!=='string'||!/^(0|[1-9]\d{0,29})$/.test(r.amountMinor)||!instant(r.observedAt)||!text(r.runId))return null;
  }else if(r.amountMinor!==null||!((r.observedAt===null&&r.runId===null)||(instant(r.observedAt)&&text(r.runId))))return null;
  result.push(Object.freeze(r as MetaHistoryDay));
 }
 return Object.freeze(result);
}
/** membershipAuthorized is supplied by the caller's trusted access gate, never a browser input. */
export function buildMetaHistoryPresentation(result:unknown,requested:unknown,displayContext:unknown,membershipAuthorized:boolean):MetaHistoryPresentation{
 if(membershipAuthorized!==true)return withheld();
 const response=record(result,['connection','reauthorizationRequired','evidenceAvailability','lineage','observationFreshness','days']);
 const expected=lineage(requested),context=record(displayContext,['lineage','currency','timeZone']);
 if(!response||!expected||!context||!(response.connection==='current'||response.connection==='expired')||response.reauthorizationRequired!==(response.connection==='expired')||!(response.evidenceAvailability==='available'||response.evidenceAvailability==='unavailable')||!(response.observationFreshness==='current'||response.observationFreshness==='stale'||response.observationFreshness==='unknown'))return withheld();
 const selected=lineage(response.lineage),display=lineage(context.lineage);
 if(!selected||!display||!same(expected,selected)||!same(expected,display)||typeof context.currency!=='string'||!/^[A-Z]{3}$/.test(context.currency)||!text(context.timeZone))return withheld();
 try{new Intl.DateTimeFormat('en-GB',{timeZone:context.timeZone});new Intl.NumberFormat('en-GB',{style:'currency',currency:context.currency});}catch{return withheld();}
 const days=rows(response.days,selected);if(!days)return withheld();
 const reported=days.filter(d=>d.coverage==='reported');
 if((response.evidenceAvailability==='available')!==(reported.length>0))return withheld();
 return Object.freeze({state:reported.length?'available':'unavailable',connectionLabel:response.connection==='expired'?'Meta access expired — reconnect required':'Meta access current',evidenceLabel:response.observationFreshness==='current'?'Saved observations marked current':response.observationFreshness==='stale'?'Saved observations are stale':'Observation freshness unknown',lineage:selected,currency:context.currency,timeZone:context.timeZone,days,subtotalMinor:reported.length?reported.reduce((sum,r)=>sum+BigInt(r.amountMinor!),0n).toString():null});
}
