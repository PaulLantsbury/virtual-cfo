import test from 'node:test';
import assert from 'node:assert/strict';
import {CashWindowUnavailable,cashWindowResult,readCashWindow} from './reviewedCashWindow.ts';
const months=['v1','v2','v3'];
const points=months.map((version,i)=>({version,cash:{openingBankCash:i*100,closingBankCash:(i+1)*100}}));
const validate=(raw:unknown,version:string)=>{const p=raw as typeof points[number];return p?.version===version?p:null;};
const signal=()=>new AbortController().signal;
test('failed third-month read rejects atomically; retry checks the same exact versions',async()=>{
 let fail=true;const reads:string[]=[];
 const read=async(v:string)=>{reads.push(v);if(v==='v3'&&fail)throw Error('HTTP unavailable');return points[months.indexOf(v)];};
 await assert.rejects(readCashWindow(months,read,validate,signal()),/HTTP unavailable/);
 fail=false;assert.deepEqual(await readCashWindow(months,read,validate,signal()),points);
 assert.deepEqual(reads,[...months,...months]);
});
test('missing matched evidence differs from read or reconciliation failure',async()=>{
 await assert.rejects(readCashWindow(months,async()=>({state:'unavailable',contract:'reviewed-supplement-v1'}),validate,signal()),CashWindowUnavailable);
 await assert.rejects(readCashWindow(months,async()=>points[0],validate,signal()),/could not be verified/);
 await assert.rejects(readCashWindow(months,async(v)=>({...points[months.indexOf(v)],cash:{openingBankCash:0,closingBankCash:100}}),validate,signal()),/roll forward/);
 await assert.rejects(readCashWindow(months.slice(0,2),async()=>points[0],validate,signal()),CashWindowUnavailable);
});
test('cached window withheld while pending, failed or disabled, then restored after success',()=>{
 const cached={isFetching:false,isError:false,isSuccess:true,error:null,data:points};
 assert.deepEqual(cashWindowResult(true,cached).months,points);
 for(const result of [cashWindowResult(false,cached),cashWindowResult(true,{...cached,isFetching:true}),cashWindowResult(true,{...cached,isError:true,error:Error('failed')})])assert.deepEqual(result.months,[]);
 assert.equal(cashWindowResult(true,{...cached,isError:true,error:new CashWindowUnavailable()}).status,'unavailable');
 assert.equal(cashWindowResult(true,{...cached,isError:true,error:Error('invalid')}).status,'error');
});
test('aborted read never publishes a partial window or continues reading',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(readCashWindow(months,async()=>{calls++;controller.abort();return points[0];},validate,controller.signal));assert.equal(calls,1);
});
