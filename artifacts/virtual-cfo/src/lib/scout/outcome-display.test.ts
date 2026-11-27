import test from 'node:test';import assert from 'node:assert/strict';
import {scoutOutcomeDisplay} from './outcome-display.ts';
const outcome={id:'sales' as const,label:'Sales',value:20000,previous:15000,delta:5000,changePct:33,note:'',kind:'flow' as const,comparisonLabel:'prior',tone:'good' as const};
test('increased total sales can be lower per order using each period denominator',()=>{
 const display=scoutOutcomeDisplay(outcome,{perOrder:true,currentOrders:20,previousOrders:10});
 assert.equal(display.value,1000);assert.equal(display.previous,1500);assert.equal(display.delta,-500);
});
test('missing order denominators withhold ratios and do not invent zeros',()=>{
 assert.equal(scoutOutcomeDisplay(outcome,{perOrder:true,currentOrders:0,previousOrders:10}).value,null);
 assert.equal(scoutOutcomeDisplay(outcome,{perOrder:true,currentOrders:20,previousOrders:null}).delta,null);
});
test('cash and bank balances remain absolute under a global per-order preference',()=>{
 for(const id of ['operatingCash','bank'] as const){const d=scoutOutcomeDisplay({...outcome,id},{perOrder:true,currentOrders:20,previousOrders:10});assert.equal(d.value,20000);assert.equal(d.delta,5000);assert.equal(d.perOrder,false);}
});
