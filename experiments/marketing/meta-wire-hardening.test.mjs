import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
// Explicit override supports reproducing defects on a read-only pinned predecessor.
const moduleUrl=process.env.NIGHT_SCOUT_META_TEST_PREDECESSOR
 ? pathToFileURL(process.env.NIGHT_SCOUT_META_TEST_PREDECESSOR).href
 : new URL('./meta-spend-report-contract.mjs',import.meta.url).href;
const {parseMetaSpendReport}=await import(moduleUrl);
const storeId='11111111-1111-4111-8111-111111111111',from='2026-10-01',to=from;
const uuid='22222222-2222-4222-8222-222222222222';
const fixture=()=>({status:'available',storeId,from,to,account:{providerAccountId:'123456',currency:'GBP',timeZone:'Europe/London'},days:[{date:from,coverageState:'provider_row',spendMinor:'1200',observedAt:'2026-10-02T09:00:00Z',runId:uuid,runStatus:'complete',runStartedAt:'2026-10-02T08:59:00Z'}],lineage:{storeId,accountId:'123456',connectionId:uuid,from,to,version:'sha256:'+'a'.repeat(64)},connectionState:'current',reauthorizationRequired:false,evidenceAvailability:'available',observationFreshness:'unknown'});
const parse=value=>parseMetaSpendReport(value,storeId,from,to);
test('state must be a literal and cannot invoke coercion',()=>{
 let invoked=0;
 for(const state of [new String('current'),{toString(){invoked++;return 'current';}}]){
  assert.throws(()=>parse({...fixture(),connectionState:state}));
 }
 assert.equal(invoked,0);
});
test('reject calendar, time, offset and precision rollovers for both observation instants',()=>{
 for(const key of ['observedAt','runStartedAt'])for(const value of ['2026-10-02T24:00:00Z','2026-02-30T09:00:00Z','2025-02-29T09:00:00Z','2026-10-02T09:60:00Z','2026-10-02T09:00:60Z','2026-10-02T09:00:00+14:01','2026-10-02T09:00:00+15:00','2026-10-02T09:00:00.1234567Z']){
  const input=fixture();input.days[0][key]=value;assert.throws(()=>parse(input),`${key}: ${value}`);
 }
});
test('valid leap, fractional and explicit offset instants retain original source text',()=>{
 for(const value of ['2024-02-29T09:00:00Z','2026-10-02T09:00:00.123456Z','2026-10-02T09:00:00+14:00','2026-10-02T09:00:00-05:30']){
  const input=fixture();input.days[0].observedAt=value;input.days[0].runStartedAt=value;
  assert.equal(parse(input).days[0].observedAt,value);
 }
});
test('reject symbols and accessor records without reading accessors',()=>{
 for(const select of [x=>x,x=>x.account,x=>x.lineage,x=>x.days[0]]){
  const symbolInput=fixture();select(symbolInput)[Symbol('hidden')]='private';assert.throws(()=>parse(symbolInput));
  const getterInput=fixture();const object=select(getterInput),key=Object.keys(object)[0],value=object[key];let calls=0;
  Object.defineProperty(object,key,{enumerable:true,get(){calls++;return value;}});
  assert.throws(()=>parse(getterInput));assert.equal(calls,0);
 }
});
test('reject sparse, decorated and accessor arrays without invoking element getters',()=>{
 for(const decorate of [a=>{delete a[0];},a=>{a.extra='hidden';},a=>{a[Symbol('hidden')]='hidden';}]){
  const input=fixture();decorate(input.days);assert.throws(()=>parse(input));
 }
 const input=fixture(),value=input.days[0];let calls=0;
 Object.defineProperty(input.days,'0',{enumerable:true,get(){calls++;return value;}});
 assert.throws(()=>parse(input));assert.equal(calls,0);
});
