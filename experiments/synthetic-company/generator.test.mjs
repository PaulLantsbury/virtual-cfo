import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PROFILE, HISTORICAL_PROFILE_V1, allocate, date, generate, replay, summarise } from './generator.mjs';
const fixture=generate();
const total=values=>values.reduce((a,b)=>a+b,0);

test('24 completed months plus current completed days; no clock or future actuals',()=>{
  assert.equal(fixture.from,'2024-11-01');assert.equal(fixture.to,'2026-11-04');
  assert.equal(fixture.daily.length,734);
  assert.ok(fixture.events.every(e=>e.date>=fixture.from&&e.date<=fixture.to));
  assert.equal(generate({asOf:'2026-11-01'}).to,'2026-10-31');
});
test('independently specified annual revenue/cost/employee budgets reconcile exactly',()=>{
  const t=summarise(fixture,'2025-01-01','2025-12-31');
  for(const [key,expected] of Object.entries({orders:19895,gross:79200000,discounts:3600000,refunds:3600000,productSales:75600000,netProduct:72000000,shipping:3000000,revenue:75000000,cogs:36000000,grossProfit:36000000,variableCosts:10028000,marketing:3000000,overheads:15747552,operatingProfit:10224448,ebitda:10464448})) assert.equal(t[key],expected,key);
  assert.ok(Math.abs(t.productSales/t.orders/100-38)<0.01);
  const payroll=fixture.events.filter(e=>e.kind==='payroll_accrual'&&e.date.startsWith('2025'));
  assert.equal(payroll.length,48);assert.equal(new Set(payroll.map(e=>e.refs.staffId)).size,4);
  assert.equal(total(payroll.map(e=>e.refs.gross)),11900000);
  assert.equal(total(payroll.map(e=>e.refs.employer)),1414685);
  assert.equal(total(payroll.map(e=>e.refs.pension)),332867);
});
test('every journal balances in safe integer pennies; independently rebuild every daily balance',()=>{
  const ledger={},ids=new Set();let index=0;
  for(const day of fixture.daily) {
    while(index<fixture.events.length&&fixture.events[index].date===day.date) {
      const e=fixture.events[index++];assert.ok(!ids.has(e.id));ids.add(e.id);
      assert.equal(total(e.postings.map(p=>p.amount)),0,e.id);
      for(const p of e.postings){assert.ok(Number.isSafeInteger(p.amount));ledger[p.account]=(ledger[p.account]||0)+p.amount;}
      assert.equal(e.company,'fictional-uk-gifts');assert.equal(e.provider,null);assert.equal(e.provenance,'synthetic-local');
    }
    assert.deepEqual(day.balances,ledger);assert.equal(total(Object.values(ledger)),0);
    assert.ok(ledger.inventory>=0,day.date);
  }
  assert.equal(index,fixture.events.length);
});
test('refunds retain original eligible orders and event dates; never refund more revenue/cost than original',()=>{
  const refunded=new Map();let opening=0,crossMonth=0;
  for(const e of fixture.events.filter(e=>e.kind==='refund')) {
    assert.ok(e.refs.originalDate<e.date);assert.equal((+date(e.date)-+date(e.refs.originalDate))/86400000,14);
    if(e.refs.openingCohort)opening++;
    if(e.refs.originalDate.slice(0,7)!==e.date.slice(0,7))crossMonth++;
    const old=refunded.get(e.refs.orderId)||[0,0];old[0]+=e.metrics.refunds;old[1]-=e.metrics.cogs;
    assert.ok(old[0]<=e.refs.originalProduct);assert.ok(old[1]<=e.refs.originalCogs);refunded.set(e.refs.orderId,old);
    assert.equal(e.metrics.cogs,-e.metrics.refunds/2);
    assert.ok(e.metrics.refundedVat<=Math.round(e.refs.originalProduct/5));
  }
  assert.ok(opening>0);assert.ok(crossMonth>0);
});
test('processor clearing equals only unsettled sales; fees are separately bank debited',()=>{
  const expected=new Map();
  for(const e of fixture.events) {
    if(e.kind==='sale') expected.set(e.refs.orderId,e.postings.find(p=>p.account==='processor').amount);
    if(e.kind==='processor_payout') {assert.equal(e.postings.find(p=>p.account==='bank').amount,expected.get(e.refs.orderId));expected.delete(e.refs.orderId);}
    if(e.kind==='processor_fee') {assert.ok(e.postings.some(p=>p.account==='bank'));assert.ok(!e.postings.some(p=>p.account==='processor'));}
  }
  assert.equal(fixture.daily.at(-1).balances.processor,total([...expected.values()]));
  assert.ok(expected.size>0,'horizon retains unsettled future payouts');
});
test('VAT control reconciles computed line tax and actual dated settlements; never revenue',()=>{
  let control=0;
  for(const e of fixture.events) {
    const amount=e.postings.find(p=>p.account==='vat_control')?.amount||0;
    if(e.kind==='sale')assert.equal(-amount,e.metrics.outputVat);
    if(e.kind==='refund')assert.equal(amount,e.metrics.refundedVat);
    if(e.kind==='stock_receipt'||e.kind==='expense_accrual')assert.equal(amount,e.metrics.inputVat);
    if(e.kind==='vat_settlement') {assert.ok(e.date>e.refs.quarterEnd);assert.equal((+date(e.date)-+date(e.refs.quarterEnd))/86400000,37);}
    control+=amount;
  }
  assert.equal(control,fixture.daily.at(-1).balances.vat_control);
});
test('seasonal history peaks Christmas and Q4; accounting and cash are distinct',()=>{
  const november=summarise(fixture,'2025-11-01','2025-11-30');const december=summarise(fixture,'2025-12-01','2025-12-31');const january=summarise(fixture,'2025-01-01','2025-01-31');
  assert.equal(december.revenue,13500000);assert.equal(november.revenue,9750000);assert.equal(january.revenue,4500000);
  assert.equal(summarise(fixture,'2025-10-01','2025-12-31').revenue,30000000);
  const bank=fixture.daily.at(-1).balances.bank-6000000;
  assert.notEqual(bank,summarise(fixture).operatingProfit);
});
test('exact deterministic rerun and immutable replay; future extension preserves all prior events with pinned from',()=>{
  const original=generate({asOf:'2026-01-31',from:'2024-01-01'}), extended=generate({asOf:'2026-02-05',from:'2024-01-01'});
  assert.equal(generate({asOf:'2026-01-31',from:'2024-01-01'}).fingerprint,original.fingerprint);
  const first=replay(new Map(),original);assert.equal(first.inserted,original.events.length);
  assert.equal(replay(first.events,original).inserted,0);
  assert.equal(replay(first.events,extended).inserted,extended.events.length-original.events.length);
  const corrupted=structuredClone(original);corrupted.events[1].metrics.orders=999;
  assert.throws(()=>replay(first.events,corrupted),/immutable/);
});
test('allocation conserves pennies; invalid dates, history and company scopes rejected',()=>{
  assert.deepEqual(allocate(5,[1,1,1]),[2,2,1]);
  assert.equal(total(allocate(9007199254740000,[3,7,9])),9007199254740000);
  for(const input of [{asOf:'2026-02-30'},{asOf:'2026-2-01'},{months:0},{months:1.5},{company:'existing-store'},{from:'2024-01-02'},{from:'2027-01-01'},{profile:'unknown'},{profile:'__proto__'}])assert.throws(()=>generate(input));
});
test('CLI output is byte equivalent; rejects unknown options without producing data',()=>{
  const cli=fileURLToPath(new URL('./cli.mjs',import.meta.url));
  const args=[cli,'--as-of','2026-11-05','--months','1'];
  assert.deepEqual(execFileSync(process.execPath,args),execFileSync(process.execPath,args));
  assert.throws(()=>execFileSync(process.execPath,[cli,'--unknown'],{stdio:'pipe'}));
});
test('quarterly remittance equals independent event-tax totals for that quarter',()=>{
  for(const settlement of fixture.events.filter(e=>e.kind==='vat_settlement')) {
    const q=settlement.refs.quarterEnd, year=Number(q.slice(0,4)), month=Number(q.slice(5,7));
    const from=`${year}-${String(month-2).padStart(2,'0')}-01`;
    const events=fixture.events.filter(e=>e.date>=from&&e.date<=q);
    const expected=total(events.map(e=>(e.metrics.outputVat||0)-(e.metrics.refundedVat||0)-(e.metrics.inputVat||0)));
    assert.equal(settlement.postings.find(p=>p.account==='vat_control')?.amount||0,expected,q);
  }
});
test('payroll net/deduction/employer liabilities preserve accrual versus cash timing',()=>{
  const accruals=fixture.events.filter(e=>e.kind==='payroll_accrual');
  const paidNet=total(fixture.events.filter(e=>e.kind==='payroll_payment').map(e=>e.postings.find(p=>p.account==='net_payable').amount));
  const remitted=total(fixture.events.filter(e=>e.kind==='payroll_remittance').map(e=>e.postings.find(p=>p.account==='payroll_liability').amount));
  const expectedNet=total(accruals.map(e=>e.refs.net))-paidNet;
  const expectedOther=total(accruals.map(e=>e.refs.deduction+e.refs.employer+e.refs.pension))-remitted;
  assert.equal(fixture.daily.at(-1).balances.net_payable,0-expectedNet);
  assert.equal(fixture.daily.at(-1).balances.payroll_liability,0-expectedOther);
  for(const e of accruals)assert.equal(e.refs.gross,e.refs.net+e.refs.deduction);
});
test('leap-year annual allocation and London DST calendar retain every business date',()=>{
  const f=generate({asOf:'2025-01-01',from:'2024-01-01'});
  assert.equal(f.daily.length,366);assert.equal(summarise(f).revenue,75000000);
  for(const day of ['2024-02-29','2024-03-31','2024-10-27'])assert.equal(f.daily.filter(d=>d.date===day).length,1);
  assert.throws(()=>{PROFILE.salaries[0]=1;},TypeError);
  assert.throws(()=>{PROFILE.costs.marketing=0;},TypeError);
});

test('sale tax is recorded separately for product and shipping; full product refunds cannot exceed original component tax',()=>{
  for(const e of fixture.events.filter(e=>e.kind==='sale')) {
    assert.equal(e.metrics.productVat,Math.round(e.metrics.productSales/5));
    assert.equal(e.metrics.shippingVat,Math.round(e.metrics.shipping/5));
    assert.equal(e.metrics.outputVat,e.metrics.productVat+e.metrics.shippingVat);
  }
});

test('v1 pressure scenario remains immutable and separate from revised profitable profile',()=>{
  const old=generate({asOf:'2026-01-01',from:'2025-01-01',profile:'uk-gifts-v1'});
  const t=summarise(old);
  assert.equal(old.scope.profile,'uk-gifts-v1');assert.equal(fixture.scope.profile,'uk-gifts-v2');
  assert.equal(t.revenue,50000000);assert.equal(t.operatingProfit,-2425200);assert.equal(t.ebitda,-2185200);
  assert.equal(HISTORICAL_PROFILE_V1.salaries.length,5);assert.equal(PROFILE.salaries.length,4);
  assert.equal(HISTORICAL_PROFILE_V1.costs.processor,900000);assert.equal(PROFILE.costs.processor,1350000);
  const ids=new Set(fixture.events.map(e=>e.id));assert.ok(old.events.every(e=>!ids.has(e.id)));
  assert.throws(()=>{HISTORICAL_PROFILE_V1.salaries.pop();},TypeError);
});
