import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as calc from './calculations.mjs';

const fixtures = JSON.parse(readFileSync(new URL('../../tests/fixtures/financial-acceptance-v1.json', import.meta.url)));
const cases = Object.fromEntries(fixtures.cases.map(c => [c.id, c]));
const sum = object => Object.values(object).reduce((a,b) => a+b,0);
const matches = (actual, expected, keys) => keys.forEach(key => assert.deepEqual(actual[key], expected[key], key));
const scope = { storeId: 'test-store', currency: 'GBP', coverageComplete: true };
const sales = () => cases.F03.given.orders.map(o => ({ ...o, ...scope, orderId:o.id, type:'sale', date:'2026-02-15' }));
const refunds = () => cases.F04.given.refunds.map((r,i) => ({ ...r, ...scope, id:`refund-${i}`, orderId:r.originalOrder, type:'refund', date:'2026-03-05' }));
const trading = (events, month) => calc.tradingPeriod({ ...scope, events, from:`2026-${month}-01`, to:month==='02'?'2026-02-28':'2026-03-31' });
const februaryBridge = period => calc.profitBridge({ ...period, variableCosts:sum(cases.F03.given.variableCosts), advertising:cases.F03.given.advertising,
  overheadIncludingDA:sum(cases.F03.given.overheads), depreciationAmortisation:cases.F03.given.overheads.depreciationAmortisation });

test('F01: inclusive and exclusive tax sources yield identical sales and pre-refund AOV', () => {
  const {given:g,expected:e}=cases.F01;
  const inclusive=calc.normaliseSale({ gross:g.grossProductInclusive,grossVat:g.grossProductVat,discount:g.discountInclusive,discountVat:g.discountVat,shipping:g.shippingInclusive,shippingVat:g.shippingVat,basis:'inclusive' });
  const exclusive=calc.normaliseSale({ gross:10000,grossVat:2000,discount:1000,discountVat:200,shipping:500,shippingVat:100,basis:'exclusive' });
  assert.deepEqual(inclusive,exclusive);
  matches(inclusive,e,['grossProductExVat','discountExVat','netProductSales','netShipping','productVat','shippingVat','customerCharge']);
  assert.equal(inclusive.aov.value,e.aov);
  assert.equal(inclusive.discountRate.value,e.discountRateNumerator/e.discountRateDenominator);
});
test('F02: recorded zero VAT stays zero', () => {
  const {given:g,expected:e}=cases.F02;
  const r=calc.normaliseSale({gross:g.grossProduct,grossVat:g.recordedVat,discount:0,discountVat:0,shipping:0,shippingVat:0,basis:'inclusive'});
  assert.equal(r.netProductSales,e.netProductSales); assert.equal(r.aov.value,e.aov); assert.equal(r.productVat,e.vat);
});
test('F03: full profit bridge uses the combined revenue denominator and deducts costs once', () => {
  const e=cases.F03.expected, p=trading(sales(),'02'), b=februaryBridge(p);
  matches(p,e,['grossProductSales','discounts','netProductSales','originalOrders','netShipping','cogs']);
  assert.equal(p.aov.value,e.aov);
  matches(b,e,['revenueDenominator','grossProfit','contributionBeforeMarketing','contribution','operatingProfit','ebitda']);
  assert.equal(`${(b.contributionMargin.value*100).toFixed(2)}%`,e.contributionMarginDisplay);
  assert.equal(`${(b.operatingMargin.value*100).toFixed(2)}%`,e.operatingMarginDisplay);
  assert.equal(p.netProductSales+p.netShipping+sum(Object.fromEntries(sales().map(o=>[o.id,o.productVat+o.shippingVat]))),e.customerCharges);
});
test('F04: later partial/full refunds preserve February and recognise refund-only March', () => {
  const {given:g,expected:e}=cases.F04;
  const events=[...sales(),...refunds()], before=JSON.stringify(events);
  const feb=trading(events,'02'), march=trading(events,'03');
  const b=calc.profitBridge({...march,variableCosts:g.returnHandling,advertising:g.advertising,overheadIncludingDA:g.overheadIncludingDA,depreciationAmortisation:g.depreciationAmortisation});
  matches(march,e,['productRefundExVat','productRefundVat','shippingRefundExVat','shippingRefundVat','cashRefunded','netProductSales','netShipping','cogs','hasRefundActivity']);
  matches(b,e,['grossProfit','contributionBeforeMarketing','contribution','operatingProfit','ebitda']);
  assert.equal(feb.netProductSales,e.februaryNetProductSalesUnchanged);assert.equal(feb.aov.value,e.februaryAovUnchanged);assert.equal(feb.originalOrders,e.februaryOrderCountUnchanged);
  assert.equal(march.hasActivity,true);assert.equal(march.aov.value,null);assert.equal(b.contributionMargin.value,null);
  assert.equal(JSON.stringify(events),before);
});
test('F05: historic costs and saleable-return quantity drive COGS', () => {
  const {given:g,expected:e}=cases.F05;
  const r=calc.historicCogs(g);matches(r,e,['originalCogs','saleableCostReversal','netCogs']);
  assert.equal(calc.historicCogs({...g,currentUnitCost:99999}).originalCogs,e.originalCogs);
  assert.equal(calc.historicCogs({...g,saleableUnitsReturned:0}).saleableCostReversal,e.unrecoveredRefundCostReversal);
});
test('F06: missing COGS preserves sales but withholds profit', () => {
  const {given:g,expected:e}=cases.F06;
  const p=trading([{...sales()[0],grossProductExVat:g.netProductSales,discountExVat:0,netShipping:0,historicCost:g.historicCost}],'02');
  const b=februaryBridge(p);
  assert.equal(p.netProductSales,e.netProductSales);assert.equal(p.aov.value,e.aov);assert.equal(b.state,e.profitDataState);
  e.unavailableMetrics.forEach(key=>assert.equal(key==='cogs'?p[key]:b[key],null,key));
});
test('F07: calendar-day allocation spans January and February and reconciles monthly totals', () => {
  const {given:g,expected:e}=cases.F07;
  const months=[{month:'2026-01',amount:g.januaryOverhead},{month:'2026-02',amount:g.februaryOverhead}];
  const week=calc.allocateRecurringOverhead(months,'2026-01-26','2026-02-01');
  assert.equal(week.value,e.weekOverhead);assert.equal(week.allocated,e.allocationLabelRequired);
  assert.equal(calc.allocateRecurringOverhead(months,'2026-01-01','2026-01-31').value,g.januaryOverhead);
  assert.equal(calc.allocateRecurringOverhead(months,'2026-02-01','2026-02-28').value,g.februaryOverhead);
  assert.equal(calc.allocateRecurringOverhead(months,'2026-01-01','2026-01-01').value,e.januaryDailyAllocation);
});
const accounts=()=>{const g=cases.F08.given;return [ ['bank',g.bank,'unrestricted'],['processor',g.settledPaymentAccount,'unrestricted'],['restricted',g.restricted,'restricted'],['pending',g.unsettled,'unsettled'] ].map(([id,balance,kind])=>({id,balance,kind,date:g.asOf,currency:'GBP'}));};
const movements=()=>cases.F08.given.completeMonths.map(m=>({month:m.period,complete:true,exceptionalFlowsReviewed:true,netMovement:calc.cashMovement({externalInflows:m.externalInflows,externalOutflows:m.externalOutflows,internalTransfers:[],includedAccountIds:['bank','processor']}).netMovement}));
test('F08: dated cash excludes restricted/unsettled funds and transfers; runway uses actual burn', () => {
  const {given:g,expected:e}=cases.F08;
  const p=calc.cashPosition({accounts:accounts(),asOf:g.asOf,currency:'GBP',coverageComplete:true});
  assert.equal(p.availableCash,e.availableCash);assert.equal(p.restricted,e.restrictedShownSeparately);assert.equal(p.unsettled,e.unsettledShownSeparately);
  const m=calc.cashMovement({...g.completeMonths[2],internalTransfers:[{id:'transfer',from:'bank',to:'processor',amount:g.aprilInternalTransfer}],includedAccountIds:['bank','processor']});
  assert.equal(m.netMovement,e.monthlyNetMovement);assert.equal(m.internalTransferConsolidatedMovement,e.internalTransferConsolidatedMovement);
  assert.equal(g.aprilOpeningCash+m.netMovement,p.availableCash);
  const r=calc.cashRunway({availableCash:p.availableCash,months:movements(),throughMonth:'2026-04'});
  assert.equal(r.months,e.runwayMonths);assert.equal(r.averageMonthlyBurn,e.averageMonthlyBurn);
});
test('F09: generating cash has a nonnumeric runway state', () => {
  const {given:g,expected:e}=cases.F09;
  const net=calc.cashMovement({externalInflows:g.monthlyExternalInflows,externalOutflows:g.monthlyExternalOutflows,internalTransfers:[],includedAccountIds:[]}).netMovement;
  const r=calc.cashRunway({availableCash:g.availableCash,months:movements().map(m=>({...m,netMovement:net})),throughMonth:'2026-04'});
  assert.equal(net,e.monthlyNetGeneration);assert.equal(r.state,e.runwayState);assert.equal(r.months,null);
});
test('F10: forecast cash-release opportunities cannot alter actual cash or recurring contribution', () => {
  const {given:g,expected:e}=cases.F10;assert.deepEqual(calc.separateImpacts(g),e);
});
test('missing VAT, ambiguous basis and non-integer/overflow money are rejected', () => {
  assert.throws(()=>calc.excludingTax(120,null,'inclusive'));
  assert.throws(()=>calc.excludingTax(120,20,'unknown'));
  assert.throws(()=>calc.excludingTax(120,121,'inclusive'));
  assert.throws(()=>calc.excludingTax(1.5,0,'exclusive'));
  assert.throws(()=>calc.historicCogs({unitsSold:2,historicUnitCost:Number.MAX_SAFE_INTEGER,saleableUnitsReturned:0}));
});
test('store scoping, duplicate events, unknown eligibility and mixed currencies', () => {
  assert.equal(trading([...sales(),{...sales()[0],storeId:'other'}],'02').netProductSales,cases.F03.expected.netProductSales);
  assert.throws(()=>trading([...sales(),sales()[0]],'02'),/duplicate/i);
  assert.throws(()=>trading([{...sales()[0],eligible:null}],'02'),/eligibility/);
  assert.throws(()=>trading([{...sales()[0],currency:'USD'}],'02'),/Currency/);
  assert.throws(()=>trading([{...sales()[0],date:'2026-02-30'}],'02'),/date/);
  assert.throws(()=>calc.tradingPeriod({...scope,coverageComplete:false,events:[],from:'2026-02-01',to:'2026-02-28'}),/coverage/);
});
test('non-saleable cost reversal, over-return and unresolved recovery are rejected', () => {
  assert.throws(()=>trading([{...refunds()[0],costReversal:100}],'03'),/Unrecovered/);
  assert.throws(()=>trading([{...refunds()[0],saleableReturn:null}],'03'),/recovery/);
  assert.throws(()=>calc.historicCogs({unitsSold:1,historicUnitCost:10,saleableUnitsReturned:2}),/quantity/);
});
test('missing/partial/zero-burn cash cannot produce a runway', () => {
  assert.equal(calc.cashRunway({availableCash:100,months:movements().slice(1),throughMonth:'2026-04'}).state,'incomplete');
  for(const change of [{complete:false},{netMovement:0},{exceptionalFlowsReviewed:false},{month:'2026-01'}]) {
    assert.equal(calc.cashRunway({availableCash:100,months:movements().map(m=>({...m,...change})),throughMonth:'2026-04'}).state,'incomplete');
  }
  assert.throws(()=>calc.cashPosition({accounts:[{...accounts()[0],currency:'USD'}],asOf:'2026-04-30',currency:'GBP',coverageComplete:true}));
  assert.throws(()=>calc.cashPosition({accounts:accounts(),asOf:'2026-05-01',currency:'GBP',coverageComplete:true}));
  assert.throws(()=>calc.cashMovement({externalInflows:0,externalOutflows:0,internalTransfers:[{id:'x',from:'bank',to:'outside',amount:100}],includedAccountIds:['bank']}));
});
test('unknown overheads, fractional pennies and incomplete DA remain explicit', () => {
  assert.equal(calc.allocateRecurringOverhead([],'2026-02-01','2026-02-02').value,null);
  assert.equal(calc.allocateRecurringOverhead([{month:'2026-02',amount:100}],'2026-02-01','2026-02-01').value,null);
  assert.equal(calc.profitBridge({netProductSales:100,netShipping:0,cogs:10,variableCosts:0,advertising:0,overheadIncludingDA:null,depreciationAmortisation:null}).state,'incomplete');
  assert.throws(()=>calc.profitBridge({netProductSales:100,netShipping:0,cogs:10,variableCosts:0,advertising:0,overheadIncludingDA:10,depreciationAmortisation:20}));
});
