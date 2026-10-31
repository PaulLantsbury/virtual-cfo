import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateProfitEvidence} from './profit-evidence.mjs';

// Independent F03/F04 worked amounts in integer GBP pence. No app/sample imports.
const storeId='synthetic-store',currency='GBP';
const proof={storeId,currency,basis:'actual',evidenceRef:'isolated source document',sourceRevision:'source-1',observedRevision:'source-1'};
function input(month='02') {
 const scope={storeId,currency,from:`2026-${month}-01`,to:`2026-${month}-${month==='02'?'28':month==='03'?'31':'30'}`};
 const sales=month==='02'?{grossProductSales:15000,discounts:1000,netProductSales:14000,netShipping:500,originalOrders:2,productRefundExVat:0,cashRefunded:0,aov:{value:7000,reason:null},hasActivity:true,hasRefundActivity:false}
  :month==='03'?{grossProductSales:0,discounts:0,netProductSales:-7000,netShipping:-500,originalOrders:0,productRefundExVat:7000,cashRefunded:8000,aov:{value:null,reason:'No original orders'},hasActivity:true,hasRefundActivity:true}
  :{grossProductSales:0,discounts:0,netProductSales:0,netShipping:0,originalOrders:0,productRefundExVat:0,cashRefunded:0,aov:{value:null,reason:'No original orders'},hasActivity:false,hasRefundActivity:false};
 const lines=[{...proof,id:'line-a',orderId:'order-a',soldOn:'2026-02-15',quantity:1,unitCostPence:4000,originalEligible:true,landedCostSupported:true},
  {...proof,id:'line-b',orderId:'order-b',soldOn:'2026-02-15',quantity:1,unitCostPence:2000,originalEligible:true,landedCostSupported:true}];
 const expense=(id,category,amountPence,daPence=null)=>({...proof,id,sourceId:`source-${id}`,from:scope.from,to:scope.to,category,amountPence,daPence});
 const expenses=month==='02'?[expense('variable','variableCosts',1500),expense('advertising','advertising',1000),expense('overhead','overheads',2500,500)]
  :month==='03'?[expense('return-handling','variableCosts',400),expense('overhead','overheads',2500,500)]:[];
 const result={version:'profit-evidence-v1',snapshotId:'snapshot-1',scope,sales:{snapshotId:'snapshot-1',value:{...sales,cogs:null,profitDataState:'incomplete',provenance:{...scope,coverageEvidence:'isolated complete sales'}}},costEvidence:{snapshotId:'snapshot-1',revision:'cost-1',lines,recoveries:[],expenses,coverage:{}}};
 cover(result);return result;
}
function cover(data) {
 const c=data.costEvidence;
 for(const component of ['productCosts','recoveries','variableCosts','advertising','overheads','da']){
  const records=component==='productCosts'?c.lines:component==='recoveries'?c.recoveries:c.expenses.filter(e=>e.category===(component==='da'?'overheads':component));
  c.coverage[component]={complete:true,revision:c.revision,snapshotId:data.snapshotId,...data.scope,evidenceRef:'independent fixture manifest',sourceIds:records.map(r=>r.id)};
 }
 return data;
}
function ready(result,expected){for(const [key,value]of Object.entries(expected)){assert.equal(result[key].state,'ready',`${key} ready`);assert.equal(result[key].value,value,`${key} exact amount`);}}
function unavailable(result,...keys){for(const key of keys){assert.equal(result[key].state,'unavailable',`${key} unavailable`);assert.equal(result[key].value,null,`${key} is not zero`);assert.ok(result[key].reason,`${key} explains missing evidence`);}}
const recovery=()=>({...proof,id:'restock-b',lineId:'line-b',recoveryOn:'2026-04-05',quantity:1,status:'saleable'});

test('F03 full-month source evidence reconciles the agreed profit bridge and denominator',()=>{
 const r=calculateProfitEvidence(input());
 ready(r,{cogs:6000,grossProfit:8000,variableCosts:1500,advertising:1000,overheads:2500,da:500,contributionBeforeMarketing:7000,contribution:6000,operatingProfit:3500,ebitda:4000});
 assert.equal(r.contributionMargin.value,6000/14500);assert.equal(r.operatingMargin.value,3500/14500);
});
test('Missing historical cost preserves sales and independently supported expenses',()=>{
 const d=input();d.costEvidence.lines[0].unitCostPence=null;const r=calculateProfitEvidence(d);
 unavailable(r,'cogs','grossProfit','contribution','operatingProfit','ebitda');ready(r,{variableCosts:1500,advertising:1000,overheads:2500});
 assert.deepEqual(r.sales,d.sales.value);
});
test('Missing advertising does not hide supported gross profit or before-marketing contribution',()=>{
 const d=input();d.costEvidence.coverage.advertising.complete=false;const r=calculateProfitEvidence(d);
 ready(r,{cogs:6000,grossProfit:8000,variableCosts:1500,contributionBeforeMarketing:7000});unavailable(r,'advertising','contribution','operatingProfit','ebitda');
});
test('Missing overhead evidence does not hide complete contribution',()=>{
 const d=input();d.costEvidence.coverage.overheads.complete=false;const r=calculateProfitEvidence(d);
 ready(r,{grossProfit:8000,contribution:6000});unavailable(r,'overheads','operatingProfit','ebitda');
});
test('Unknown D&A split permits evidenced operating profit but no guessed EBITDA',()=>{
 const d=input();d.costEvidence.expenses.find(e=>e.category==='overheads').daPence=null;const r=calculateProfitEvidence(d);
 ready(r,{overheads:2500,contribution:6000,operatingProfit:3500});unavailable(r,'da','ebitda');
});
test('D&A is deducted in overheads once and added back once, never accepted above total',()=>{
 const d=input();d.costEvidence.expenses.find(e=>e.category==='overheads').daPence=2600;const r=calculateProfitEvidence(d);
 unavailable(r,'da','ebitda');
});
test('Complete empty advertising is zero; absent coverage is unknown',()=>{
 const d=input();d.costEvidence.expenses=d.costEvidence.expenses.filter(e=>e.category!=='advertising');cover(d);
 ready(calculateProfitEvidence(d),{advertising:0,contribution:7000,operatingProfit:4500});
 delete d.costEvidence.coverage.advertising;unavailable(calculateProfitEvidence(d),'advertising','contribution');
});
test('Current catalogue cost does not replace evidenced historical line costs',()=>{
 const d=input();d.costEvidence.lines[0].currentCatalogueUnitCostPence=9900;ready(calculateProfitEvidence(d),{cogs:6000,grossProfit:8000});
});
test('March refunds reduce sales independently; April restock-only month reverses historical COGS',()=>{
 const march=input('03');ready(calculateProfitEvidence(march),{cogs:0,grossProfit:-7000,contribution:-7900,operatingProfit:-10400,ebitda:-9900});
 const april=input('04');april.costEvidence.recoveries=[recovery()];cover(april);
 const r=calculateProfitEvidence(april);ready(r,{cogs:-2000,grossProfit:2000,contribution:2000,operatingProfit:2000,ebitda:2000});
 assert.equal(r.sales.netProductSales,0);assert.equal(r.sales.hasRefundActivity,false);
 unavailable(r,'contributionMargin','operatingMargin');ready(calculateProfitEvidence(input()),{cogs:6000,operatingProfit:3500});
});
test('Missing recovery coverage blocks net COGS even with all original costs',()=>{
 const d=input();d.costEvidence.coverage.recoveries.complete=false;unavailable(calculateProfitEvidence(d),'cogs','grossProfit');
});
test('Duplicate and cumulative recovery events cannot reverse the same sold unit twice',()=>{
 for(const duplicate of [true,false]){
  const d=input('04');d.costEvidence.recoveries=[{...recovery(),recoveryOn:'2026-03-25'}, {...recovery(),id:duplicate?'restock-b':'second-restock'}];cover(d);
  unavailable(calculateProfitEvidence(d),'cogs','grossProfit','contribution');
 }
});
test('Orphan, non-saleable and impossible-date recovery evidence cannot become cost reversal',()=>{
 for(const change of [{lineId:'missing-line'},{status:'unknown'},{recoveryOn:'2026-04-31'}]){
  const d=input('04');d.costEvidence.recoveries=[{...recovery(),...change}];cover(d);unavailable(calculateProfitEvidence(d),'cogs');
 }
});
test('Expense identity cannot be counted twice by changing its category or ID',()=>{
 const d=input();const e=d.costEvidence.expenses[0];d.costEvidence.expenses.push({...e,id:'relabelled',category:'advertising'});cover(d);
 const r=calculateProfitEvidence(d);unavailable(r,'contribution','operatingProfit','ebitda');
});
test('Duplicate sale lines cannot inflate historical COGS',()=>{
 const d=input();d.costEvidence.lines.push({...d.costEvidence.lines[0]});cover(d);unavailable(calculateProfitEvidence(d),'cogs');
});
test('Stale source revisions and manifest omissions cannot certify component totals',()=>{
 for(const mutate of [d=>d.costEvidence.lines[0].observedRevision='old',d=>d.costEvidence.coverage.productCosts.sourceIds=['line-a'],d=>d.costEvidence.coverage.productCosts.revision='old']){
  const d=input();mutate(d);unavailable(calculateProfitEvidence(d),'cogs','grossProfit');
 }
});
test('Wrong store/currency and estimates are excluded from actual cost readiness',()=>{
 for(const change of [{storeId:'other-store'},{currency:'EUR'},{basis:'estimated'},{landedCostSupported:false}]){
  const d=input();Object.assign(d.costEvidence.lines[0],change);unavailable(calculateProfitEvidence(d),'cogs','grossProfit');
 }
 for(const change of [{storeId:'other-store'},{currency:'EUR'},{basis:'estimated'},{observedRevision:'old'}]){
  const d=input();Object.assign(d.costEvidence.expenses[0],change);const r=calculateProfitEvidence(d);ready(r,{grossProfit:8000});unavailable(r,'variableCosts','contribution');
 }
});
test('Cost/sales snapshot mismatch and non-month scope withhold profit without changing sales',()=>{
 for(const mutate of [d=>d.costEvidence.snapshotId='other-snapshot',d=>{d.scope.to='2026-02-15';d.sales.value.provenance.to=d.scope.to;}]){
  const d=input();mutate(d);const r=calculateProfitEvidence(d);assert.deepEqual(r.sales,d.sales.value);unavailable(r,'cogs','contribution','operatingProfit');
 }
});
test('Negative or fractional expense amounts are not silently rounded or netted',()=>{
 for(const amountPence of [-1,1.5,Number.NaN]){
  const d=input();d.costEvidence.expenses[0].amountPence=amountPence;unavailable(calculateProfitEvidence(d),'variableCosts','contribution');
 }
});

test('A matching cost manifest cannot hide a qualifying original order from verified sales',()=>{
 for(const retained of [[],['line-a']]){
  const d=input();d.costEvidence.lines=d.costEvidence.lines.filter(line=>retained.includes(line.id));cover(d);
  const r=calculateProfitEvidence(d);assert.deepEqual(r.sales,d.sales.value);
  unavailable(r,'originalCosts','cogs','grossProfit','contribution','operatingProfit','ebitda');
 }
});
