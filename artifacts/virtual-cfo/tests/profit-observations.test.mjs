import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfitObservations } from '../src/lib/analytics/profitObservations.ts';
const scope = {storeId:'synthetic-store-d',currency:'GBP',from:'2026-02-01',to:'2026-02-28'};
const ready = value => ({state:'ready',value,reason:null});
const absent = reason => ({state:'unavailable',value:null,reason});
function report(values={},period=scope){
 return {scope:period,state:'complete',reason:null,sales:null,...Object.fromEntries(Object.entries({originalCosts:6000,recoveredCosts:0,cogs:6000,variableCosts:1500,advertising:1000,overheads:2500,da:500,revenueDenominator:14500,grossProfit:8000,contributionBeforeMarketing:7000,contribution:6000,operatingProfit:3500,ebitda:4000,contributionMargin:6000/14500,operatingMargin:3500/14500,...values}).map(([k,v])=>[k,typeof v==='object'?v:ready(v)]))};
}
const model = r => buildProfitObservations({report:r,scope:r.scope});
const text = r => JSON.stringify(model(r));
test('Store D February presents the independent worked amounts without recomputation',()=>{
 const cards=model(report()).cards;
 assert.equal(cards[0].observation,'Gross profit for the selected month is £80.00.');
 assert.equal(cards[1].observation,'Contribution after marketing for the selected month is £60.00.');
 assert.match(cards[1].driver,/Contribution before marketing: £70.00.*Advertising spend: £10.00/);
 assert.equal(cards[2].observation,'Operating profit for the selected month is £35.00.');
 assert.match(cards[2].driver,/EBITDA: £40.00/);
});
test('Store D refund-only March does not substitute February or describe negative profit as improvement',()=>{
 const r=report({originalCosts:0,cogs:0,variableCosts:0,advertising:0,overheads:0,da:0,revenueDenominator:-7500,grossProfit:-7000,contributionBeforeMarketing:-7500,contribution:-7500,operatingProfit:-7500,ebitda:-7500},{...scope,from:'2026-03-01',to:'2026-03-31'});
 const s=text(r);assert.match(s,/-£70.00/);assert.match(s,/-£75.00/);assert.match(s,/2026-03-01/);assert.doesNotMatch(s,/£80.00|improv|growth|up by/);
});
test('Store D April stock recovery is a dated cost component, not sales or cash',()=>{
 const s=text(report({originalCosts:0,recoveredCosts:4000,cogs:-4000,variableCosts:0,advertising:0,overheads:0,da:0,grossProfit:4000,contributionBeforeMarketing:4000,contribution:4000,operatingProfit:4000,ebitda:4000},{...scope,from:'2026-04-01',to:'2026-04-30'}));
 assert.match(s,/Saleable-stock cost recovery: £40.00/);assert.match(s,/Net cost of goods sold: -£40.00/);assert.match(s,/independently of the refund date/);assert.match(s,/not available cash/);
});
test('Missing overhead does not erase gross profit or contribution',()=>{
 const cards=model(report({overheads:absent('Overhead coverage incomplete'),operatingProfit:absent('Overhead coverage incomplete'),ebitda:absent('Overhead coverage incomplete')})).cards;
 assert.match(cards[0].observation,/£80.00/);assert.match(cards[1].observation,/£60.00/);assert.match(cards[2].observation,/unavailable/);assert.equal(cards[2].evidence,'Overhead coverage incomplete');
});
test('Missing advertising preserves the approved before-marketing contribution',()=>{
 const cards=model(report({advertising:absent('Advertising missing'),contribution:absent('Advertising missing'),operatingProfit:absent('Advertising missing'),ebitda:absent('Advertising missing')})).cards;
 assert.match(cards[1].driver,/Contribution before marketing: £70.00.*Advertising spend: unavailable/);assert.match(cards[1].observation,/unavailable/);
});
test('A supported zero remains zero; missing costs do not become zero',()=>{
 assert.match(model(report({grossProfit:0,contribution:0,operatingProfit:0})).cards[0].observation,/£0.00/);
 const card=model(report({grossProfit:absent('Historical cost missing'),originalCosts:absent('Historical cost missing'),cogs:absent('Historical cost missing')})).cards[0];
 assert.match(card.observation,/unavailable/);assert.doesNotMatch(card.impact,/£0.00/);
});
test('Wrong store, currency or date scopes suppress every observation',()=>{
 for(const change of [{storeId:'different'},{currency:'EUR'},{from:'2026-03-01'},{to:'2026-02-27'}])assert.deepEqual(buildProfitObservations({report:report(),scope:{...scope,...change}}).cards,[]);
});
test('Loading, failed and unsupported reports never retain prior observations',()=>{
 assert.deepEqual(buildProfitObservations({report:report(),scope,loading:true}).cards,[]);
 for(const reason of ['Read failed','Complete calendar month required','Access denied']){
  const result=buildProfitObservations({report:null,scope,reason});assert.deepEqual(result.cards,[]);assert.equal(result.status,reason);
 }
});
test('Unavailable or nonfinite values cannot enter a reported amount',()=>{
 const cards=model(report({grossProfit:NaN,contribution:Infinity,operatingProfit:absent('Missing')})).cards;
 assert.ok(cards.every(c=>c.observation.includes('unavailable')));assert.doesNotMatch(JSON.stringify(cards),/£NaN|£∞/);
});
