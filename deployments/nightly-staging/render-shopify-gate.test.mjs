import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dispatchRenderShopify,renderShopifyWindow} from './render-shopify-gate.mjs';
const env={NIGHT_SCOUT_CLOUD_ENABLED:'true',NIGHT_SCOUT_REPORT_SCOPE:'rolling-31-completed-days'};
test('one of two UTC candidates admits across London DST transitions',async()=>{
 for(const date of ['2026-03-28','2026-03-29','2026-03-30','2026-10-24','2026-10-25','2026-10-26']){
  let calls=0;
  for(const hour of ['01','02'])await dispatchRenderShopify({now:new Date(`${date}T${hour}:00:00Z`),env,loadCollector:async()=>({runCloudNightly:async()=>{calls++;return {state:'completed'};}})});
  assert.equal(calls,1,date);
 }
});
test('window bounds include 02:14:59 but exclude 02:15 in winter and summer',()=>{
 for(const [date,hour,before] of [['2026-07-10','01','00'],['2026-12-10','02','01']]){
  assert.equal(renderShopifyWindow(new Date(`${date}T${hour}:00:00Z`)).state,'admitted');
  assert.equal(renderShopifyWindow(new Date(`${date}T${hour}:14:59.999Z`)).state,'admitted');
  assert.equal(renderShopifyWindow(new Date(`${date}T${hour}:15:00Z`)).state,'skipped');
  assert.equal(renderShopifyWindow(new Date(`${date}T${before}:59:59.999Z`)).state,'skipped');
 }
});
test('invalid/outside/disabled modes never import collector',async()=>{
 let imports=0;const loadCollector=()=>{imports++;throw Error('unexpected import');};
 for(const now of [undefined,null,0,'2026-10-16T01:00:00Z',new Date(NaN),new Date('2026-10-16T02:00:00Z')])assert.equal((await dispatchRenderShopify({now,env,loadCollector})).state,'skipped');
 for(const value of [undefined,'false','TRUE','garbage'])assert.equal((await dispatchRenderShopify({now:new Date('2026-10-16T01:00:00Z'),env:{...env,NIGHT_SCOUT_CLOUD_ENABLED:value},loadCollector})).state,'disabled');
 assert.equal(imports,0);
});
test('fixed/stale modes fail before imports; existing collector receives exact contract and returns receipt unchanged',async()=>{
 const now=new Date('2026-10-16T01:00:00Z');let imports=0;
 for(const changed of [{NIGHT_SCOUT_REPORT_SCOPE:undefined},{NIGHT_SCOUT_REPORT_SCOPE:'fixed'},{NIGHT_SCOUT_REPORT_FROM:'2026-09-17'},{NIGHT_SCOUT_REPORT_TO:''}])await assert.rejects(dispatchRenderShopify({now,env:{...env,...changed},loadCollector:()=>{imports++;}}),/Rolling/);
 assert.equal(imports,0);
 const receipt={state:'completed',financeImported:false};
 assert.equal(await dispatchRenderShopify({now,env,loadCollector:async()=>({runCloudNightly:async args=>{assert.deepEqual(args,{env,mode:'tick',confirmTarget:'bioalckltvkhlczusdvl/56d92f8a-746e-4b4f-b408-81fc98c4aa17'});return receipt;}})}),receipt);
 await assert.rejects(dispatchRenderShopify({now,env,loadCollector:async()=>{throw Error('unknown outcome');}}),/unknown outcome/);
});
test('CLI uses real clock, rejects arguments and has no eager collector import',async()=>{
 const source=await readFile(new URL('./render-shopify-daily.mjs',import.meta.url),'utf8');
 assert.match(source,/now:new Date\(\)/);assert.match(source,/process.argv.length!==2/);
 assert.match(source,/loadCollector:\(\)=>import\(/);assert.doesNotMatch(source,/^import .*cloud-nightly/m);
});
