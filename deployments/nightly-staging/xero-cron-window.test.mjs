import test from 'node:test';
import assert from 'node:assert/strict';
import {xeroCronWindow,runXeroDailyCron} from './xero-cron-window.mjs';

test('London 02:00 inclusive through 02:14:59 is accepted in BST and GMT',()=>{
 for(const [date,hour] of [['2026-07-10','01'],['2026-12-10','02']]){
  assert.equal(xeroCronWindow(new Date(`${date}T${hour}:00:00.000Z`)).state,'admitted');
  assert.equal(xeroCronWindow(new Date(`${date}T${hour}:14:59.999Z`)).state,'admitted');
  assert.equal(xeroCronWindow(new Date(`${date}T${hour}:15:00.000Z`)).state,'skipped');
 }
 for(const stamp of ['2026-07-10T00:59:59.999Z','2026-12-10T01:59:59.999Z'])assert.equal(xeroCronWindow(new Date(stamp)).state,'skipped');
});

test('two UTC triggers dispatch exactly once on days surrounding both DST changes',async()=>{
 for(const day of ['2026-03-28','2026-03-29','2026-03-30','2026-10-24','2026-10-25','2026-10-26']){
  let calls=0;
  for(const hour of ['01','02'])await runXeroDailyCron({now:new Date(`${day}T${hour}:00:00Z`),run:async()=>{calls++;}});
  assert.equal(calls,1,day);
 }
 assert.equal(xeroCronWindow(new Date('2026-03-29T01:00:00Z')).state,'admitted');
 assert.equal(xeroCronWindow(new Date('2026-03-29T02:00:00Z')).state,'skipped');
 assert.equal(xeroCronWindow(new Date('2026-10-25T01:00:00Z')).state,'skipped');
 assert.equal(xeroCronWindow(new Date('2026-10-25T02:00:00Z')).state,'admitted');
});

test('every minute outside the window skips without touching action',async()=>{
 for(const date of ['2026-03-29','2026-10-25','2026-07-10','2026-12-10']){
  let calls=0,admitted=0;
  for(let minute=0;minute<1440;minute++){
   const now=new Date(Date.parse(`${date}T00:00:00Z`)+minute*60000);
   const gate=xeroCronWindow(now);
   const before=calls;
   const result=await runXeroDailyCron({now,run:async()=>{calls++;}});
   if(gate.state==='admitted'){admitted++;assert.equal(calls,before+1);assert.equal(result.state,'dispatched');}
   else {assert.equal(calls,before);assert.equal(result.state,'skipped');}
  }
  assert.equal(calls,15);assert.equal(admitted,15);
 }
});

test('invalid clocks are metadata-only skips; admitted action errors propagate',async()=>{
 for(const now of [undefined,null,'2026-12-10T02:00:00Z',new Date(NaN),0,{}]){
  let called=false;
  assert.deepEqual(await runXeroDailyCron({now,run:()=>{called=true;}}),{state:'skipped',reason:'invalid_clock'});
  assert.equal(called,false);
 }
 const now=new Date('2026-12-10T02:00:00Z');
 await assert.rejects(runXeroDailyCron({now,run:async()=>{throw Error('unavailable');}}),/unavailable/);
 await assert.rejects(runXeroDailyCron({now}),/action unavailable/);
});
