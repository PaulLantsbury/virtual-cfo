import {buildMetaHistoryPresentation,type MetaHistoryPresentation} from './metaHistoryPresentation.ts';

export type MetaHistorySourceDay=Readonly<{date:string;coverageState:'provider_row'|'no_row'|'partial'|'failed'|'not_collected';spendMinor:string|null;observedAt:string|null;runId:string|null;runStatus:'complete'|'partial'|null;runStartedAt:string|null}>;
export type MetaHistoryWirePresentation=MetaHistoryPresentation&Readonly<{sourceDays?:readonly MetaHistorySourceDay[]}>;
const deny=()=>buildMetaHistoryPresentation(null,null,null,false);
function record(value:unknown,keys:readonly string[]):Record<string,unknown>|null{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)return null;
 const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(value);
 if(actual.length!==keys.length||actual.some(k=>typeof k!=='string'||!keys.includes(k)||!('value' in descriptors[k])))return null;
 return Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));
}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const instant=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)===v.slice(0,10);
/** Pure adapter for the additive read-only wire contract. No fetch, mount or provider action. */
export function buildMetaHistoryFromWire(wire:unknown,requested:unknown,membershipAuthorized:boolean):MetaHistoryWirePresentation{
 if(membershipAuthorized!==true)return deny();
 const r=record(wire,['status','storeId','from','to','account','days','lineage','connectionState','reauthorizationRequired','evidenceAvailability','observationFreshness']);
 if(!r||r.status!=='available'||!(r.connectionState==='current'||r.connectionState==='expired')||r.observationFreshness!=='unknown')return deny();
 const scope=record(r.lineage,['storeId','accountId','connectionId','from','to','version']),account=record(r.account,['providerAccountId','currency','timeZone']);
 if(!scope||!account||!uuid(scope.storeId)||!uuid(scope.connectionId)||typeof scope.accountId!=='string'||!/^\d{5,32}$/.test(scope.accountId)||typeof scope.version!=='string'||!/^sha256:[a-f0-9]{64}$/.test(scope.version)||scope.storeId!==r.storeId||scope.from!==r.from||scope.to!==r.to||scope.accountId!==account.providerAccountId||typeof account.timeZone!=='string'||account.timeZone.length>128)return deny();
 if(!Array.isArray(r.days)||r.days.length>93||Reflect.ownKeys(r.days).length!==r.days.length+1)return deny();
 const sourceDays:MetaHistorySourceDay[]=[];
 for(let i=0;i<r.days.length;i++){
  const descriptor=Object.getOwnPropertyDescriptor(r.days,String(i));if(!descriptor||!('value' in descriptor))return deny();
  const d=record(descriptor.value,['date','coverageState','spendMinor','observedAt','runId','runStatus','runStartedAt']);
  if(!d||!(d.coverageState==='provider_row'||d.coverageState==='no_row'||d.coverageState==='partial'||d.coverageState==='failed'||d.coverageState==='not_collected'))return deny();
  if(d.coverageState==='not_collected'){
   if(d.spendMinor!==null||d.observedAt!==null||d.runId!==null||d.runStatus!==null||d.runStartedAt!==null)return deny();
  }else if(!instant(d.observedAt)||!instant(d.runStartedAt)||!uuid(d.runId)||!(d.runStatus==='complete'||d.runStatus==='partial'))return deny();
  if(d.coverageState!=='provider_row'&&d.spendMinor!==null)return deny();
  sourceDays.push(Object.freeze(d as MetaHistorySourceDay));
 }
 const view=buildMetaHistoryPresentation({connection:r.connectionState,reauthorizationRequired:r.reauthorizationRequired,evidenceAvailability:r.evidenceAvailability,lineage:scope,observationFreshness:r.observationFreshness,days:sourceDays.map(d=>({date:d.date,amountMinor:d.spendMinor,observedAt:d.observedAt,runId:d.runId,coverage:d.coverageState==='provider_row'?'reported':'unknown'}))},requested,{lineage:scope,currency:account.currency,timeZone:account.timeZone},true);
 if(view.state==='withheld')return view;
 return Object.freeze({...view,sourceDays:Object.freeze(sourceDays)});
}
