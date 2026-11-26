// Explicit offline cross-check. Requires a pinned local producer source path;
// never imports a provider runtime and never sends a request.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {buildMetaHistoryFromWire} from '../src/lib/metaHistoryWire.ts';
import {wireFixture} from './meta-history-wire.fixture.ts';
const path=process.env.NIGHT_SCOUT_META_PRODUCER_MODULE,expected=process.env.NIGHT_SCOUT_META_PRODUCER_SHA256;
if(!path||!expected)throw Error('Supply explicit local producer module path and SHA-256');
const actual=createHash('sha256').update(await readFile(path)).digest('hex');assert.equal(actual,expected,'Exact reviewed producer source');
const {parseMetaSpendReport}=await import(pathToFileURL(path).href);
for(const scenario of ['wire-current','wire-expired','wire-disconnected','wire-all-unknown'])test('producer/consumer agreement: '+scenario,()=>{
 const p=wireFixture(scenario),input=p.wire;const parsed=parseMetaSpendReport(input,input.storeId,input.from,input.to);assert.deepEqual(parsed,input);
 const result=buildMetaHistoryFromWire(parsed,p.requested,p.membershipAuthorized);
 if(scenario==='wire-disconnected'){assert.equal(result.state,'withheld');assert.deepEqual(result.days,[]);}
 else {assert.equal(result.state,scenario==='wire-all-unknown'?'unavailable':'available');assert.deepEqual(result.sourceDays,parsed.days);assert.equal(result.subtotalMinor,scenario==='wire-all-unknown'?null:'1200');}
});
