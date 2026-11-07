import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCashDemo } from './cashDemoModel.ts';

test('sample monthly cash reconciles to £186000 with September £14000 movement',()=>{
 const model=buildCashDemo({granularity:'monthly',months:3});
 assert.equal(model.currentCash,18600000);
 const september=model.history.at(-1)!;
 assert.equal(september.from,'2026-09-01');assert.equal(september.opening,17200000);assert.equal(september.net,1400000);assert.equal(september.closing,18600000);
});
test('every historical range and bridge conserves integer-pence cash; comparisons are balances',()=>{
 for(const granularity of ['weekly','monthly'] as const)for(const months of [3,6,12] as const){
  const model=buildCashDemo({granularity,months});
  for(const [i,row] of model.history.entries()){
   assert.equal(row.net,row.receipts+row.financing-row.stock-row.payroll-row.tax-row.other);
   assert.equal(row.opening+row.net,row.closing);
   assert.ok(Number.isSafeInteger(row.closing));assert.ok(Number.isFinite(row.priorYearClosing));assert.ok(Number.isFinite(row.rollingAverageClosing));
   if(i)assert.equal(row.opening,model.history[i-1].closing);
  }
  assert.equal(model.historical.opening+model.historical.bridge.filter(row=>!row.subtotal).reduce((s,row)=>s+row.amount,0),model.historical.closing);
  assert.equal(model.history.at(-1)!.closing,model.currentCash);
 }
});
test('all forecast rows reconcile and action dates include later repayment without duplicate effects',()=>{
 const ids=['stock-order','supplier-deferral','overheads'] as const;
 const base=buildCashDemo(),model=buildCashDemo({selectedActionIds:[...ids,...ids]});
 assert.equal(model.forecast.length,13);
 for(const [i,row] of model.forecast.entries()){
  assert.equal(row.net,row.receipts+row.financing-row.stock-row.payroll-row.tax-row.other);
  assert.equal(row.closing,row.opening+row.net);assert.equal(row.withActions,row.withActionsOpening+row.net+row.actionEffect);
  if(i){assert.equal(row.opening,model.forecast[i-1].closing);assert.equal(row.withActionsOpening,model.forecast[i-1].withActions);}
  assert.equal(base.forecast[i].closing,row.closing);
 }
 const deferral=model.actions.find(a=>a.id==='supplier-deferral')!;
 assert.equal(deferral.effects.reduce((sum,e)=>sum+e.amount,0),0);
 assert.ok(deferral.effects[1].date>deferral.effects[0].date);
 assert.equal(model.forecastActionBenefit,2400000);
 assert.equal(model.forecast.at(-1)!.withActions-model.forecast.at(-1)!.closing,2400000);
 assert.ok(model.shortfall>0);assert.ok(model.withActionsShortfall>0);
 assert.equal(model.lowestForecast.balance,Math.min(...model.forecast.map(row=>row.closing)));
});
test('runway uses the last three complete months of genuine net cash rather than overheads',()=>{
 const model=buildCashDemo(),runway=model.runway;
 assert.equal(runway.from,'2026-07-01');assert.equal(runway.to,'2026-09-30');
 assert.equal(runway.averageMonthlyNet,runway.months.reduce((sum,row)=>sum+row.net,0)/3);
 assert.ok(runway.averageMonthlyNet>0);assert.equal(runway.monthsRemaining,null);assert.equal(runway.status,'Not currently burning cash');
});
test('invalid controls and unknown action IDs fail closed',()=>{
 for(const minimumBuffer of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>buildCashDemo({minimumBuffer}));
 assert.throws(()=>buildCashDemo({selectedActionIds:['invalid'] as never}));
});

test('cash chart sales match Profit exactly for every selected and prior-year period; receipts remain distinct',async()=>{
 const { buildProfitPreview, DAILY_SAMPLE, aggregateDays }=await import('./newProfitPreview.ts');
 for(const granularity of ['weekly','monthly'] as const)for(const months of [3,6,12] as const){
  const cash=buildCashDemo({granularity,months}),profit=buildProfitPreview({granularity,months});
  assert.equal(cash.history.length,profit.periods.length);
  cash.history.forEach((row,i)=>{
   assert.equal(row.from,profit.periods[i].from);assert.equal(row.to,profit.periods[i].to);
   assert.equal(row.sales,profit.periods[i].values.sales);assert.equal(row.priorYearSales,profit.periods[i].priorYear.sales);
   assert.notEqual(row.sales,row.receipts);
   assert.ok(Number.isFinite(row.rollingAverageSales));
  });
  const first=cash.history[0],selected=DAILY_SAMPLE.filter(row=>row.date>=first.from&&row.date<=first.to);
  assert.equal(first.sales,aggregateDays(selected).sales);
 }
});
test('stock schedule explains every forecast payment with week-ending assumptions, not verified commitments',()=>{
 const cash=buildCashDemo();
 for(const row of cash.forecast){
  assert.equal(row.stockPayments.reduce((sum,payment)=>sum+payment.amount,0),row.stock);
  for(const payment of row.stockPayments){assert.equal(payment.date,row.date);assert.equal(payment.timingBasis,'week-ending-assumption');assert.match(payment.evidence,/not verified/);}
 }
 assert.equal(cash.forecast[1].stockPayments.find(row=>row.actionId==='stock-order')!.amount,1500000);
 assert.equal(cash.forecast[2].stockPayments.find(row=>row.actionId==='supplier-deferral')!.amount,2000000);
});
