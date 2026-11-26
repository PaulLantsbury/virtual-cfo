// Explicit offline agreement test. Pages files remain externally owned/read-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {parseMetaSpendReport} from '../../../experiments/marketing/meta-spend-report-contract.mjs';
const root=process.env.NIGHT_SCOUT_META_PAGES_ROOT;
if(!root)throw Error('Supply explicit local pages candidate root pinned below');
const pins={
 'artifacts/virtual-cfo/src/lib/metaHistoryWire.ts':'9ad80194a991f24353dc152cc9501e466c89fc1bae57c06e2ecbec8372ef7702',
 'artifacts/virtual-cfo/src/lib/metaHistoryPresentation.ts':'1f0697cf06b39cde0d01d282b259536b49b7d499f76b5d847720a474b2d19405',
 'artifacts/virtual-cfo/tests/meta-history-wire.fixture.ts':'f8e4ad8a2ff0e165445566224d1da877240ab3594699ad8431cae2b801371a25',
};
for(const [file,hash] of Object.entries(pins))assert.equal(createHash('sha256').update(await readFile(join(root,file))).digest('hex'),hash,'Pages commit2a557ea exact file '+file);
const {buildMetaHistoryFromWire}=await import(pathToFileURL(join(root,'artifacts/virtual-cfo/src/lib/metaHistoryWire.ts')));
const {wireFixture}=await import(pathToFileURL(join(root,'artifacts/virtual-cfo/tests/meta-history-wire.fixture.ts')));
for(const scenario of ['wire-current','wire-expired','wire-disconnected','wire-all-unknown'])test('pinned pages agreement '+scenario,()=>{
 const p=wireFixture(scenario),wire=p.wire;
 const parsed=parseMetaSpendReport(wire,wire.storeId,wire.from,wire.to);
 const view=buildMetaHistoryFromWire(parsed,p.requested,p.membershipAuthorized);
 assert.deepEqual(parsed,wire);
 assert.equal(view.state,scenario==='wire-disconnected'?'withheld':scenario==='wire-all-unknown'?'unavailable':'available');
 if(view.state!=='withheld')assert.deepEqual(view.sourceDays,wire.days);
});
test('producer and pinned consumer both reject coercion, timestamp rollover, symbols and getters',()=>{
 const mutations=[
  x=>{x.connectionState=new String('current');},
  x=>{x.days[0].observedAt='2026-10-03T24:00:00Z';},
  x=>{x.days[0].runStartedAt='2026-02-30T08:59:00Z';},
  x=>{x[Symbol('extra')]='hidden';},
  x=>{x.days.extra='hidden';},
  x=>{x.days[Symbol('extra')]='hidden';},
  x=>{const value=x.days[0];Object.defineProperty(x.days,'0',{enumerable:true,get(){throw Error('must not invoke getter');}});},
  x=>{Object.defineProperty(x.account,'currency',{enumerable:true,get(){throw Error('must not invoke getter');}});},
 ];
 for(const mutate of mutations){const p=wireFixture('wire-current');mutate(p.wire);
  assert.throws(()=>parseMetaSpendReport(p.wire,p.wire.storeId,p.wire.from,p.wire.to),/Meta spend unavailable/);
  assert.equal(buildMetaHistoryFromWire(p.wire,p.requested,true).state,'withheld');
 }
});
test('pinned consumer denies valid wire after membership revocation and requested-context mismatch',()=>{
 const p=wireFixture('wire-current');const parsed=parseMetaSpendReport(p.wire,p.wire.storeId,p.wire.from,p.wire.to);
 assert.equal(buildMetaHistoryFromWire(parsed,p.requested,false).state,'withheld');
 for(const key of Object.keys(p.requested))assert.equal(buildMetaHistoryFromWire(parsed,{...p.requested,[key]:'wrong'},true).state,'withheld');
});
