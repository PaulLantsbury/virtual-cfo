import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const path = new URL('../src/pages/marketing-efficiency.tsx', import.meta.url);
const source = fs.readFileSync(path, 'utf8');
const ast = ts.createSourceFile(path.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = ast.statements.filter(node => (ts.isFunctionDeclaration(node) && ['marketingDecision', 'incrementalSpend'].includes(node.name?.text)) || (ts.isTypeAliasDeclaration(node) && ['MarketingInputs', 'Verdict'].includes(node.name.text))).map(node => node.getFullText(ast)).join('\n');
const js = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { marketingDecision, incrementalSpend } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const valid = { revenue: 100000, beforeAds: 40000, spend: 16000, orders: 2000, newCustomers: 1000, firstOrderContribution: 20, acquisitionSpend: 10000, targetPoas: 1.8, cashConfirmed: true, stockConfirmed: true, stable: true };
test('missing, non-finite, invalid scopes and denominators cannot recommend spend', () => {
 assert.equal(marketingDecision(null).verdict, 'Needs evidence');
 for (const [key, value] of [['spend',0],['newCustomers',0],['beforeAds',NaN],['orders',-1],['targetPoas',1],['acquisitionSpend',17000]]) assert.equal(marketingDecision({...valid,[key]:value}).verdict,'Needs evidence',key);
});
test('scale requires both profitability and funding/capacity', () => {
 assert.equal(marketingDecision(valid).verdict, 'Scale');
 for (const key of ['cashConfirmed','stockConfirmed']) assert.equal(marketingDecision({...valid,[key]:false}).verdict,'Needs evidence');
 assert.equal(marketingDecision({...valid,stable:false}).verdict,'Hold');
 assert.equal(marketingDecision({...valid,spend:20000}).verdict,'Hold');
});
test('positive contribution below target differs from losses after ads', () => {
 const low = marketingDecision({...valid,spend:25000});
 assert.equal(low.verdict,'Pull back'); assert.match(low.reason,/contribution-positive/);
 for (const spend of [40000,45000]) assert.equal(marketingDecision({...valid,spend}).verdict,'Pull back');
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
