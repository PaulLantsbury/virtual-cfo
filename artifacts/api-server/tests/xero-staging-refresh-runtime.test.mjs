import test from 'node:test';
import assert from 'node:assert/strict';
import {createXeroStagingRefreshRuntime} from '../src/lib/xero-staging-refresh-runtime.ts';

const env={NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED:'true',NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'bioalckltvkhlczusdvl'};
const job={connection:{id:'connection-test',tenantId:'tenant-test'},scope:{from:'2026-10-01',to:'2026-10-31',currency:'GBP'},mapping:{revenue:['sales','shipping'],processingFee:['fees'],advertising:['ads'],software:['software'],includedCash:['bank1','bank2']}};
const row=(id,value)=>({RowType:'Row',Cells:[{Value:id,Attributes:[{Id:'account',Value:id}]},{Value:value}]});
const report=(id,name,rows)=>({Reports:[{ReportID:id,ReportName:name,ReportDate:'2026-10-31',Rows:rows}]});
const snapshot={tenantId:'tenant-test',date:'2026-10-31',organisation:{Organisations:[{BaseCurrency:'GBP'}]},profitAndLoss:report('ProfitAndLoss','Profit and Loss',[row('sales','80.00'),row('shipping','6.00'),row('fees','-3.00'),row('ads','-20.00'),row('software','-50.00')]),balanceSheet:report('BalanceSheet','Balance Sheet',[row('bank1','100.00'),row('bank2','3.20')]),trialBalance:report('TrialBalance','Trial Balance',[]),bankSummary:report('BankSummary','Bank Summary',[])};
function dependencies(){const calls=[];return {calls,credentials:{readSnapshot:async input=>{calls.push(['credential',input]);return snapshot;}},persistence:{writeSupported:async value=>calls.push(['supported',value]),writeFailure:async value=>calls.push(['failed',value])},now:()=> '2026-11-01T02:00:00.000Z'};}

test('is disabled by default and generic OAuth switches never touch an injected credential port',async()=>{
 const deps=dependencies();
 assert.equal(createXeroStagingRefreshRuntime({},deps),undefined);
 assert.equal(createXeroStagingRefreshRuntime({NIGHT_SCOUT_XERO_ENABLED:'true',NIGHT_SCOUT_XERO_CLIENT_SECRET:'must-not-matter'},deps),undefined);
 assert.deepEqual(deps.calls,[]);
});
test('requires exact staging guards and validated injected ports before activation',()=>{
 const deps=dependencies();
 assert.equal(createXeroStagingRefreshRuntime({...env,NIGHT_SCOUT_RUNTIME_ENV:'production'},deps),undefined);
 assert.equal(createXeroStagingRefreshRuntime({...env,NIGHT_SCOUT_XERO_STAGING_PROJECT_REF:'wrong'},deps),undefined);
 assert.throws(()=>createXeroStagingRefreshRuntime(env,undefined),/configuration/);
});
test('runs only through the worker credential port and persists bounded evidence',async()=>{
 const deps=dependencies();const runtime=createXeroStagingRefreshRuntime(env,deps);
 const result=await runtime.run(job);
 assert.equal(result.state,'supported');
 assert.deepEqual(deps.calls[0],['credential',{connectionId:'connection-test',tenantId:'tenant-test',from:'2026-10-01',to:'2026-10-31'}]);
 assert.equal(deps.calls[1][0],'supported');
 assert.doesNotMatch(JSON.stringify(deps.calls[1][1]),/access[_-]?token|refresh[_-]?token|secret/i);
});
test('does not call credential port until an enabled runtime receives a job',()=>{
 const deps=dependencies();createXeroStagingRefreshRuntime(env,deps);
 assert.deepEqual(deps.calls,[]);
});
