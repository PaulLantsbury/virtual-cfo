import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cashResilience} from './cashResilience.ts';
const m=(n:number)=>({complete:true,operatingCash:n,tax:0,investment:0,otherBankMovements:0});
test('cover uses three complete months before funding, with buffer separately measured',()=>{assert.deepEqual(cashResilience({currentCash:600,minimumBuffer:200,months:[m(-100),m(-200),m(-300)]}),{state:'cash-used',aboveBuffer:400,monthlyMovement:-200,coverMonths:3});});
test('cash-positive and flat history never invent infinite cover',()=>{for(const n of [0,100])assert.equal(cashResilience({currentCash:600,minimumBuffer:700,months:[m(n),m(n),m(n)]}).coverMonths,null);});
test('gaps prevent a cover number and a negative bank balance gives zero cover',()=>{assert.equal(cashResilience({currentCash:600,minimumBuffer:0,months:[m(-100)]}).state,'unavailable');assert.equal(cashResilience({currentCash:-1,minimumBuffer:0,months:[m(-100),m(-100),m(-100)]}).coverMonths,0);assert.equal(cashResilience({currentCash:600,minimumBuffer:0,months:[m(-100),{...m(-100),complete:false},m(-100)]}).coverMonths,null);});

import {createCashReviewPlan} from './cashReviewPlan.ts';
import {buildCashPeriodView} from './cashPeriodView.ts';
test('current page reminder accepts date-only baseline with no forecast',()=>{const p=buildCashPeriodView();const baseline={asOf:p.asOf.slice(0,10),currentCash:p.currentBankCash,minimumBuffer:5000000,horizonDays:42,lowestCash:null,lowestDate:null,forecastStatus:'forecast-unavailable',gaps:['Future stock, tax and debt payment dates are not confirmed.']};assert.equal(createCashReviewPlan('check-stock','Me','2026-10-17',baseline,new Date('2026-10-15T12:00:00Z')).baseline.lowestDate,null);});
test('aggregate overflow does not create a misleading cover',()=>{assert.equal(cashResilience({currentCash:600,minimumBuffer:0,months:[m(Number.MAX_SAFE_INTEGER),m(Number.MAX_SAFE_INTEGER),m(Number.MAX_SAFE_INTEGER)]}).state,'unavailable');});
