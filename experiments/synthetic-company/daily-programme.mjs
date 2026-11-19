/** Pure finite approval manifest. No clock, connection, source generation or catch-up loop. */
import {addDays,date} from './generator.mjs';
import {RESERVED_SYNTHETIC_IDENTITY} from './staging-payload.mjs';

export const DAILY_PROGRAMME_PURPOSE='night-scout-synthetic-daily-programme-v1';
export const DAILY_PROGRAMME_MAX_DAYS=366;
export const DAILY_PROGRAMME_MAX_REVIEW_REF=200;
export const DAILY_PROGRAMME_SCOPE=Object.freeze({
 storeId:RESERVED_SYNTHETIC_IDENTITY.storeId,profile:'uk-gifts-v2',
 edition:'synthetic-history-v2-2026-11',anchor:'2024-11-01',
 currency:'GBP',timezone:'Europe/London',
});
const ensure=(value,message)=>{if(!value)throw Error(message);};
function exactObject(value,keys,label){
 ensure(value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&[Object.prototype,null].includes(Object.getPrototypeOf(value)),`${label}: plain object required`);
 const actual=Reflect.ownKeys(value);
 ensure(actual.length===keys.length&&actual.every(key=>keys.includes(key)),`${label}: exact keys required`);
 ensure(actual.every(key=>Object.getOwnPropertyDescriptor(value,key)?.get===undefined
  &&Object.getOwnPropertyDescriptor(value,key)?.set===undefined),`${label}: data properties required`);
}
function businessDate(value,label){
 ensure(typeof value==='string',`${label}: ISO business date required`);date(value);return value;
}
/** Returns a defensive immutable copy; approval cannot change after validation. */
export function validateDailyProgramme(programme){
 exactObject(programme,['purpose','scope','initialThrough','ceiling','days'],'programme');
 ensure(programme.purpose===DAILY_PROGRAMME_PURPOSE,'Reviewed daily programme purpose required');
 exactObject(programme.scope,Object.keys(DAILY_PROGRAMME_SCOPE),'programme scope');
 ensure(Object.entries(DAILY_PROGRAMME_SCOPE).every(([key,value])=>programme.scope[key]===value),'Fixed synthetic programme scope required');
 const initialThrough=businessDate(programme.initialThrough,'initialThrough');
 const ceiling=businessDate(programme.ceiling,'ceiling');
 ensure(initialThrough>=DAILY_PROGRAMME_SCOPE.anchor&&ceiling>initialThrough,'Finite forward programme horizon required');
 ensure(Array.isArray(programme.days)&&programme.days.length>0
  &&programme.days.length<=DAILY_PROGRAMME_MAX_DAYS,'Finite nonempty approved days required');
 let expectedThrough=initialThrough;
 const days=[];
 for(const entry of programme.days){
  exactObject(entry,['day','expectedThrough','materialSha256','reviewRef'],'approved day');
  const day=businessDate(entry.day,'approved day');
  businessDate(entry.expectedThrough,'expectedThrough');
  ensure(entry.expectedThrough===expectedThrough&&day===addDays(expectedThrough,1),'Strictly contiguous ordered approved days required');
  ensure(day<=ceiling,'Approved day exceeds programme ceiling');
  ensure(typeof entry.materialSha256==='string'&&/^[0-9a-f]{64}$/.test(entry.materialSha256),'Exact lower-case material SHA256 required');
  ensure(typeof entry.reviewRef==='string'&&entry.reviewRef.length>0
   &&entry.reviewRef.length<=DAILY_PROGRAMME_MAX_REVIEW_REF
   &&entry.reviewRef.trim()===entry.reviewRef&&!/[\u0000-\u001f\u007f]/.test(entry.reviewRef),'Bounded nonempty review reference required');
  days.push(Object.freeze({day,expectedThrough:entry.expectedThrough,materialSha256:entry.materialSha256,reviewRef:entry.reviewRef}));
  expectedThrough=day;
 }
 ensure(expectedThrough===ceiling,'Approved days must end exactly at programme ceiling');
 return Object.freeze({purpose:DAILY_PROGRAMME_PURPOSE,scope:DAILY_PROGRAMME_SCOPE,
  initialThrough,ceiling,days:Object.freeze(days)});
}
/** Select ONLY yesterday from an already obtained trusted server London business date. */
export function selectReviewedDay(programme,trustedLondonDay){
 const reviewed=validateDailyProgramme(programme);
 const yesterday=addDays(businessDate(trustedLondonDay,'trusted London day'),-1);
 return reviewed.days.find(entry=>entry.day===yesterday)??null;
}
