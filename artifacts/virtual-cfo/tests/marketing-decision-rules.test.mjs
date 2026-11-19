import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const path = new URL('../src/pages/marketing-efficiency.tsx', import.meta.url);
const source = fs.readFileSync(path, 'utf8');
const ast = ts.createSourceFile(path.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = ast.statements.filter(node => (ts.isFunctionDeclaration(node) && ['marketingDecision', 'incrementalSpend', 'businessCoverage', 'ordersToCloseGap'].includes(node.name?.text)) || (ts.isTypeAliasDeclaration(node) && ['MarketingInputs', 'Verdict'].includes(node.name.text))).map(node => node.getFullText(ast)).join('\n');
const js = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { marketingDecision, incrementalSpend, businessCoverage, ordersToCloseGap } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const valid = { revenue: 100000, beforeAds: 40000, spend: 16000, orders: 2000, newCustomers: 1000, firstOrderContribution: 20, acquisitionSpend: 10000, overheads: 15000, marginalCac: 12, cashConfirmed: true, stockConfirmed: true, stable: true };
test('missing, non-finite, invalid scopes and denominators cannot recommend spend', () => {
 assert.equal(marketingDecision(null).verdict, 'Needs evidence');
 for (const [key, value] of [['spend',0],['newCustomers',0],['beforeAds',NaN],['orders',-1],['acquisitionSpend',17000]]) assert.equal(marketingDecision({...valid,[key]:value}).verdict,'Needs evidence',key);
});
test('scale requires both profitability and funding/capacity', () => {
 assert.equal(marketingDecision(valid).verdict, 'Scale');
 for (const key of ['cashConfirmed','stockConfirmed']) assert.equal(marketingDecision({...valid,[key]:false}).verdict,'Needs evidence');
 assert.equal(marketingDecision({...valid,stable:false}).verdict,'Hold');
 assert.equal(marketingDecision({...valid,marginalCac:undefined}).verdict,'Hold');
 assert.equal(marketingDecision({...valid,overheads:undefined}).verdict,'Needs evidence');
});
test('positive incremental profit can justify a test below business break-even', () => {
 for (const spend of [25000,40000,45000]) assert.equal(marketingDecision({...valid,spend}).verdict,'Scale');
 for (const marginalCac of [20,24]) assert.equal(marketingDecision({...valid,marginalCac}).verdict,'Pull back');
});
test('first-order deficit needs mature evidence and must not silently scale', () => {
 const deficit = {...valid,spend:30000,acquisitionSpend:26000};
 assert.equal(marketingDecision(deficit).verdict,'Needs evidence');
 const supported = {...deficit,repeatStrategy:true,cohortContribution90:44,cohortCac:26,paybackDays:55,maxPaybackDays:60};
 assert.equal(marketingDecision(supported).verdict,'Hold');
 assert.equal(marketingDecision({...supported,paybackDays:61}).verdict,'Pull back');
 assert.equal(marketingDecision({...supported,cohortContribution90:25}).verdict,'Pull back');
 assert.equal(marketingDecision({...supported,paybackDays:NaN}).verdict,'Needs evidence');
});
test('marginal-spend model reconciles and exposes potential losses', () => {
 const result = incrementalSpend(1000,18,24,20);
 assert.ok(Math.abs(result.profitLow - (-166.66666666666663)) < 1e-9);
 assert.ok(Math.abs(result.profitHigh - 111.11111111111109) < 1e-9);
 assert.deepEqual(incrementalSpend(0,18,24,20),{customersLow:0,customersHigh:0,profitLow:0,profitHigh:0});
 for (const args of [[1000,0,24,20],[1000,24,18,20],[-1,18,24,20],[NaN,18,24,20]]) assert.equal(incrementalSpend(...args),null);
});

test('business overhead and profit thresholds reconcile to the approved example', () => {
 const c=businessCoverage(100000,40000,20000,15000,8000);
 assert.equal(c.operatingProfit,5000);assert.equal(c.gap,3000);
 assert.equal(c.breakEvenBudget,25000);assert.equal(c.targetBudget,17000);
 assert.equal(c.breakEvenPoas,1.6);assert.equal(c.breakEvenRoas,4);
 assert.ok(Math.abs(c.targetPoas-40000/17000)<1e-12);
 assert.ok(Math.abs(c.targetRoas-100000/17000)<1e-12);
});
test('overhead coverage distinguishes zero, missing, impossible and no-target states', () => {
 assert.equal(businessCoverage(100000,40000,20000,null,8000),null);
 assert.equal(businessCoverage(100000,40000,20000,NaN,8000),null);
 assert.equal(businessCoverage(100000,40000,20000,15000,-1),null);
 assert.equal(businessCoverage(0,40000,20000,15000,8000),null);
 const none=businessCoverage(100000,40000,20000,15000,null);
 assert.equal(none.gap,null);assert.equal(none.targetPoas,null);
 assert.equal(businessCoverage(100000,40000,20000,0,0).operatingProfit,20000);
 const impossible=businessCoverage(100000,40000,20000,45000,8000);
 assert.equal(impossible.breakEvenPoas,null);assert.equal(impossible.breakEvenRoas,null);assert.equal(impossible.targetPoas,null);
 assert.equal(impossible.operatingProfit,-25000);
 const exact=businessCoverage(100000,40000,20000,32000,8000);
 assert.equal(exact.targetBudget,0);assert.equal(exact.targetPoas,null);
});
test('gap closing orders use positive marginal contribution, with whole-order rounding', () => {
 assert.deepEqual(ordersToCloseGap(3000,20,12),{orders:375,adSpend:4500,addedProfit:3000});
 assert.equal(ordersToCloseGap(3001,20,12).orders,376);
 assert.equal(ordersToCloseGap(3000,20,20),null);
 assert.equal(ordersToCloseGap(3000,20,24),null);
 assert.equal(ordersToCloseGap(0,20,12).orders,0);
});
