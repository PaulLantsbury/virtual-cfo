import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMetaHistoryFromWire as build} from '../src/lib/metaHistoryWire.ts';
import {wire,wireLineage,wireDay,wireFixture} from './meta-history-wire.fixture.ts';
const present=(name='wire-current')=>{const p=wireFixture(name);return build(p.wire,p.requested,p.membershipAuthorized);};
test('actual current and expired wire preserve amount date run and observation with unknown freshness',()=>{
 const a=present(),b=present('wire-expired');assert.equal(a.state,'available');assert.equal(b.state,'available');assert.deepEqual(a.days,b.days);assert.equal(a.days[0].amountMinor,'1200');assert.equal(a.days[0].date,wireDay.date);assert.equal(a.days[0].observedAt,wireDay.observedAt);assert.equal(a.days[0].runId,wireDay.runId);assert.equal(a.subtotalMinor,'1200');assert.deepEqual(a.sourceDays,wire.days);assert.deepEqual(b.sourceDays,wire.days);assert.equal(a.evidenceLabel,b.evidenceLabel);assert.match(a.evidenceLabel,/unknown|not established/i);assert.equal(a.currency,'GBP');assert.equal(a.timeZone,'Europe/London');
});
for(const name of ['wire-disconnected','wire-revoked','wire-wrong-account'])test(name+' withholds',()=>{const result=present(name);assert.equal(result.state,'withheld');assert.deepEqual(result.days,[]);});
test('every requested wire lineage field mismatching authoritative source withholds',()=>{for(const key of Object.keys(wireLineage))assert.equal(build(wire,{...wireLineage,[key]:'wrong'},true).state,'withheld',key);});
test('wire all-unknown envelope is unavailable, not zero',()=>{const result=present('wire-all-unknown');assert.equal(result.state,'unavailable');assert.equal(result.subtotalMinor,null);assert.equal(result.days.length,2);assert.ok(result.days.every(d=>d.amountMinor===null));});
test('wire no-row partial and failed preserve original provenance and never invent amounts',()=>{
 for(const coverageState of ['no_row','partial','failed']){const result=build({...wire,evidenceAvailability:'unavailable',days:[{...wireDay,coverageState,spendMinor:null},wire.days[1]]},wireLineage,true);assert.equal(result.state,'unavailable');assert.equal(result.days[0].amountMinor,null);assert.equal(result.days[0].observedAt,wireDay.observedAt);assert.equal(result.days[0].runId,wireDay.runId);}
});
test('wire rejects invented freshness and invalid account connection digest coverage and provenance',()=>{
 for(const change of [v=>v.observationFreshness='current',v=>v.observationFreshness='stale',v=>v.account.providerAccountId='654321',v=>v.account.currency='invalid',v=>v.account.timeZone='invalid',v=>v.lineage.version='fixture-v1',v=>v.lineage.connectionId='bad',v=>v.connectionState='revoked',v=>v.reauthorizationRequired=true,v=>v.days[0].runId=null,v=>v.days[0].runStartedAt=null,v=>v.days[0].runStatus=null,v=>v.days[1].spendMinor='0',v=>v.days[1].runId=wireDay.runId,v=>v.credential='secret',v=>v.days[0].extra='secret']){const bad=structuredClone(wire);change(bad);assert.equal(build(bad,wireLineage,true).state,'withheld');}
});
