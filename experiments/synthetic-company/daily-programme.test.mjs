import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays} from './generator.mjs';
import {DAILY_PROGRAMME_PURPOSE,DAILY_PROGRAMME_SCOPE,DAILY_PROGRAMME_MAX_DAYS,
 DAILY_PROGRAMME_MAX_REVIEW_REF,validateDailyProgramme,selectReviewedDay} from './daily-programme.mjs';

function manifest(count=2){
 const initialThrough='2026-11-18';
 return {purpose:DAILY_PROGRAMME_PURPOSE,scope:{...DAILY_PROGRAMME_SCOPE},initialThrough,
  ceiling:addDays(initialThrough,count),days:Array.from({length:count},(_,i)=>({
   day:addDays(initialThrough,i+1),expectedThrough:addDays(initialThrough,i),
   materialSha256:(i%16).toString(16).repeat(64),reviewRef:`review-package:day-${i+1}`,
  }))};
}
function refuses(change,pattern){const p=manifest();change(p);assert.throws(()=>validateDailyProgramme(p),pattern);}

test('one unchanged finite programme selects two consecutive server-derived yesterday entries',()=>{
 const p=manifest();const before=JSON.stringify(p);
 assert.equal(selectReviewedDay(p,'2026-11-20').day,'2026-11-19');
 assert.equal(selectReviewedDay(p,'2026-11-21').day,'2026-11-20');
 assert.equal(selectReviewedDay(p,'2026-11-19'),null);
 assert.equal(selectReviewedDay(p,'2026-11-22'),null);
 assert.equal(JSON.stringify(p),before);
});
test('validation defensively freezes approval and exact selected entries',()=>{
 const p=manifest();const checked=validateDailyProgramme(p);
 p.days[0].materialSha256='f'.repeat(64);p.scope.currency='USD';
 assert.equal(checked.days[0].materialSha256,'0'.repeat(64));
 assert.equal(checked.scope.currency,'GBP');
 assert.ok(Object.isFrozen(checked)&&Object.isFrozen(checked.scope)&&Object.isFrozen(checked.days)&&Object.isFrozen(checked.days[0]));
 assert.throws(()=>{checked.days[0].day='2026-11-18';},TypeError);
});
test('duplicate, gap, reverse order and wrong predecessor cannot form an approval programme',()=>{
 refuses(p=>{p.days[1]={...p.days[0]};},/contiguous/);
 refuses(p=>{p.days[1].day='2026-11-21';},/contiguous/);
 refuses(p=>{p.days.reverse();},/contiguous/);
 refuses(p=>{p.days[0].expectedThrough='2026-11-17';},/contiguous/);
});
test('fixed scope and exact property shapes reject overrides and unknown authority',()=>{
 for(const key of Object.keys(DAILY_PROGRAMME_SCOPE))refuses(p=>{p.scope[key]='unexpected';},/scope/);
 refuses(p=>{p.extra='unapproved';},/exact keys/);
 refuses(p=>{delete p.scope.currency;},/exact keys/);
 refuses(p=>{p.days[0].sql='SELECT 1';},/exact keys/);
 refuses(p=>{p.days[0][Symbol('hidden')]=true;},/exact keys/);
 refuses(p=>{Object.defineProperty(p.days[0],'day',{get(){return '2026-11-19';},enumerable:true});},/data properties/);
 refuses(p=>{Object.setPrototypeOf(p.scope,{inherited:'authority'});},/plain object/);
 refuses(p=>{p.purpose='different';},/purpose/);
});
test('material digest and review reference require exact bounded approval values',()=>{
 for(const digest of ['A'.repeat(64),'0'.repeat(63),'g'.repeat(64),null,0])
  refuses(p=>{p.days[0].materialSha256=digest;},/SHA256/);
 for(const reviewRef of ['', ' ', ' padded ', 'line\nbreak', 'x'.repeat(DAILY_PROGRAMME_MAX_REVIEW_REF+1),null])
  refuses(p=>{p.days[0].reviewRef=reviewRef;},/review reference/);
});
test('finite programme must have every day through the exact reviewed ceiling and at most 366 days',()=>{
 assert.equal(validateDailyProgramme(manifest(DAILY_PROGRAMME_MAX_DAYS)).days.length,366);
 assert.throws(()=>validateDailyProgramme(manifest(DAILY_PROGRAMME_MAX_DAYS+1)),/Finite nonempty/);
 refuses(p=>{p.days=[];},/Finite nonempty/);
 refuses(p=>{p.ceiling='2026-11-21';},/end exactly/);
 refuses(p=>{p.ceiling='2026-11-19';},/ceiling/);
 refuses(p=>{p.ceiling=p.initialThrough;},/forward/);
 refuses(p=>{p.initialThrough='2024-10-31';},/forward/);
 refuses(p=>{p.days[0].day='2026-02-30';},/Invalid business date/);
 assert.throws(()=>selectReviewedDay(manifest(),new Date()),/ISO business date/);
 assert.throws(()=>selectReviewedDay(manifest(),'2026-11-19T02:00:00Z'),/ISO business date/);
});
test('business-date selection crosses month/year/leap boundaries without choosing first missing day',()=>{
 const p=manifest();p.initialThrough='2028-02-28';p.ceiling='2028-03-01';
 p.days=p.days.map((entry,i)=>({...entry,day:addDays(p.initialThrough,i+1),expectedThrough:addDays(p.initialThrough,i)}));
 assert.equal(selectReviewedDay(p,'2028-03-01').day,'2028-02-29');
 assert.equal(selectReviewedDay(p,'2028-03-02').day,'2028-03-01');
 assert.equal(selectReviewedDay(p,'2028-03-03'),null);
 const year=manifest(1);year.initialThrough='2026-12-30';year.ceiling='2026-12-31';
 year.days[0]={...year.days[0],day:year.ceiling,expectedThrough:year.initialThrough};
 assert.equal(selectReviewedDay(year,'2027-01-01').day,'2026-12-31');
});
