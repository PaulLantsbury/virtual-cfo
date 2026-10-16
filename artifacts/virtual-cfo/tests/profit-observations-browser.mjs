import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, chooseCustom } from './shared-sales-fixture.mjs';
const ready=value=>({state:'ready',value,reason:null});
const absent=reason=>({state:'unavailable',value:null,reason});
function response(scope,partial=false) {
 const report={scope,state:partial?'partial':'complete',reason:null,sales:null};
 for(const [key,value]of Object.entries({originalCosts:6000,recoveredCosts:0,cogs:6000,variableCosts:1500,advertising:1000,overheads:2500,da:500,revenueDenominator:14500,grossProfit:8000,contributionBeforeMarketing:7000,contribution:6000,operatingProfit:3500,ebitda:4000,contributionMargin:6000/14500,operatingMargin:3500/14500}))report[key]=ready(value);
 if(partial)for(const key of ['advertising','contribution','overheads','operatingProfit','ebitda','operatingMargin','contributionMargin'])report[key]=absent('Advertising evidence incomplete');
 return {data:{state:'ready',versionId:'isolated-observation-version',report}};
}
const region=page=>page.getByRole('region',{name:'CFO profit observations'});
for(const viewport of ['desktop','mobile'])test(`${viewport} CFO facts agree with the selected report and link to supporting detail`,async()=>fixture({viewport,profitRespond:scope=>response(scope)},async(page,{origin})=>{
 await region(page).getByText('Gross profit for the selected month is £80.00.',{exact:true}).waitFor();
 assert.match(await region(page).innerText(),/Contribution before marketing: £70.00/);
 assert.match(await region(page).innerText(),/Operating profit for the selected month is £35.00/);
 await chooseCustom(page);await region(page).getByText(/Selected month: 2026-02-01/).waitFor();assert.match(await region(page).innerText(),/2026-02-01 – 2026-02-28/);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await region(page).getByRole('link').first().click();assert.equal(new URL(page.url()).pathname,'/profit-engine');
}));
test('Incomplete advertising preserves before-marketing contribution and explains unavailable outcomes',async()=>fixture({profitRespond:scope=>response(scope,true)},async page=>{
 await region(page).getByText('Contribution after marketing is unavailable for the selected month.',{exact:true}).waitFor();
 const content=await region(page).innerText();assert.match(content,/Gross profit for the selected month is £80.00/);assert.match(content,/Contribution before marketing: £70.00/);assert.match(content,/Advertising evidence incomplete/);assert.doesNotMatch(content,/Contribution after marketing for the selected month is £0.00/);
}));
test('Failed profit fetch leaves no factual observation cards or fallback amounts',async()=>fixture({profitRespond:()=>({status:503,data:{error:'Unavailable'}})},async page=>{
 await region(page).getByText('Profit evidence could not be checked.',{exact:true}).waitFor();assert.equal(await region(page).getByRole('article').count(),0);assert.doesNotMatch(await region(page).innerText(),/£/);
}));
