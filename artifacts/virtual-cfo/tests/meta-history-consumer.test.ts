import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMetaHistoryPresentation as build} from '../src/lib/metaHistoryPresentation.ts';
import {lineage,displayContext,days,saved,fixtureProps} from './meta-history.fixture.ts';
const present=(name='current')=>{const p=fixtureProps(name);return build(p.result,p.requested,p.displayContext,p.membershipAuthorized);};
test('current and expired preserve exact original day evidence and independent stale status',()=>{
 const current=present(),expired=present('expired');
 assert.equal(current.state,'available');assert.equal(expired.state,'available');
 assert.deepEqual(current.days,days);assert.deepEqual(expired.days,days);
 assert.equal(current.subtotalMinor,expired.subtotalMinor);assert.equal(current.subtotalMinor,'1200');
 assert.match(current.connectionLabel,/current/i);assert.match(expired.connectionLabel,/expired|reconnect/i);
 assert.equal(current.evidenceLabel,expired.evidenceLabel);assert.match(current.evidenceLabel,/stale/i);
});
for(const scenario of ['disconnected','superseded','revoked','membership-revoked',...Object.keys(lineage).map(key=>'wrong-'+key)])test(scenario+' withholds every amount and lineage',()=>{
 const result=present(scenario);assert.equal(result.state,'withheld');assert.deepEqual(result.days,[]);assert.equal(result.subtotalMinor,null);assert.equal('lineage' in result,false);
});
test('unknown day is not a zero and all-unknown remains unavailable',()=>{
 const mixed=present();assert.equal(mixed.days[1].amountMinor,null);assert.equal(mixed.days[1].observedAt,null);assert.equal(mixed.days[1].runId,null);
 const unknown=present('all-unknown');assert.equal(unknown.state,'unavailable');assert.equal(unknown.subtotalMinor,null);assert.equal(unknown.days.length,2);assert.ok(unknown.days.every(d=>d.amountMinor===null));
});
test('reported zero is preserved as reported evidence distinct from missing',()=>{
 const result=build({...saved,days:[{...days[0],amountMinor:'0'},days[1]]},lineage,displayContext,true);assert.equal(result.state,'available');assert.equal(result.subtotalMinor,'0');assert.equal(result.days[0].amountMinor,'0');assert.equal(result.days[1].amountMinor,null);
});
test('no display metadata or mismatched metadata is withheld',()=>{
 for(const display of [null,{}, {...displayContext,lineage:{...lineage,version:'other'}},{...displayContext,currency:'invalid'},{...displayContext,timeZone:'invalid'}])assert.equal(build(saved,lineage,display,true).state,'withheld');
});
test('incomplete duplicate out-of-window and malformed source days are withheld',()=>{
 for(const malformed of [[days[0]],[days[0],days[0]],[{...days[0],date:'2026-09-30'},days[1]],[{...days[0],amountMinor:'12.00'},days[1]],[{...days[0],amountMinor:'-1'},days[1]],[{...days[0],observedAt:null},days[1]],[days[0],{...days[1],amountMinor:'0'}]])assert.equal(build({...saved,days:malformed},lineage,displayContext,true).state,'withheld');
});
test('freshness cannot be inferred from access state',()=>{
 for(const freshness of ['current','stale','unknown']){
  const a=build({...saved,observationFreshness:freshness},lineage,displayContext,true),b=build({...saved,connection:'expired',reauthorizationRequired:true,observationFreshness:freshness},lineage,displayContext,true);
  assert.equal(a.state,'available');assert.equal(a.evidenceLabel,b.evidenceLabel);assert.deepEqual(a.days,b.days);
 }
});
test('malformed and accessor-backed objects fail closed without calling getters',()=>{
 let reads=0;const accessor={...saved};Object.defineProperty(accessor,'days',{get(){reads++;throw Error('must not read getter');},enumerable:true});
 for(const result of [null,[],{},accessor,{...saved,reauthorizationRequired:true},{...saved,evidenceAvailability:'withheld'}])assert.equal(build(result,lineage,displayContext,true).state,'withheld');assert.equal(reads,0);
});
test('enum objects cannot execute coercion hooks',()=>{
 let calls=0;const bad={toString(){calls++;throw Error('must not coerce');}};
 for(const field of ['connection','evidenceAvailability','observationFreshness'])assert.equal(build({...saved,[field]:bad},lineage,displayContext,true).state,'withheld');
 assert.equal(build({...saved,days:[{...days[0],coverage:bad},days[1]]},lineage,displayContext,true).state,'withheld');assert.equal(calls,0);
});
test('timestamp rollover invalid minutes seconds and offsets are withheld',()=>{
 for(const observedAt of ['2026-10-03T24:00:00Z','2026-10-03T09:60:00Z','2026-10-03T09:00:60Z','2026-10-03T09:00:00+14:01','2026-10-03T09:00:00+15:00'])assert.equal(build({...saved,days:[{...days[0],observedAt},days[1]]},lineage,displayContext,true).state,'withheld');
});
test('exact large minor-unit subtotal and unknown original provenance remain intact',()=>{
 const large='90071992547409931234',unknown={...days[1],observedAt:'2026-10-03T09:00:00Z',runId:'fixture-original-run'};
 const result=build({...saved,days:[{...days[0],amountMinor:large},unknown]},lineage,displayContext,true);assert.equal(result.state,'available');assert.equal(result.subtotalMinor,large);assert.deepEqual(result.days[1],unknown);
});
