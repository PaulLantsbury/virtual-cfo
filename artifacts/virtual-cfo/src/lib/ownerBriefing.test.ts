import test from 'node:test';
import assert from 'node:assert/strict';
import {financialOwnerBriefing,acquisitionOwnerBriefing,conversionOwnerBriefing,retentionOwnerBriefing,cashOwnerBriefing,planOwnerBriefing} from './ownerBriefing.ts';

test('October profit and operating cash stay different and produce a bounded next check',()=>{
 const text=financialOwnerBriefing({sales:6480000,operatingProfit:1039205,ebitda:1059205,operatingCash:-2229026});
 assert.match(text,/£64,800\.00/);assert.match(text,/operating profit before interest and tax was £10,392\.05/);
 assert.match(text,/used £22,290\.26 of cash/);assert.doesNotMatch(text,/£10,592\.05|caused|can afford|should spend|will improve/);
});
test('a complete comparison explains direction without claiming cause',()=>{
 const text=financialOwnerBriefing({sales:6480000,operatingProfit:1039205,previousSales:5760000,previousOperatingProfit:758805});
 assert.match(text,/profit was £2,804\.00 higher/);assert.match(text,/sales were £7,200\.00 higher/);
 assert.match(text,/not cash available to spend/);assert.doesNotMatch(text,/because|driven by/);
});
test('zero is break-even rather than missing or loss, and absent prior creates no improvement claim',()=>{
 const text=financialOwnerBriefing({sales:0,operatingProfit:0});
 assert.match(text,/£0\.00/);assert.match(text,/break-even/);assert.doesNotMatch(text,/loss|higher|lower|Against/);
 assert.match(financialOwnerBriefing({sales:null,operatingProfit:null}),/no reliable result/);
 const salesOnly=financialOwnerBriefing({sales:10000,operatingProfit:null});assert.match(salesOnly,/supported profit result is unavailable/);assert.doesNotMatch(salesOnly,/This profit figure/);
});
test('negative earnings are retained and an EBITDA fallback is named as a different profit measure',()=>{
 const text=financialOwnerBriefing({sales:10000,operatingProfit:-1234,ebitda:456});
 assert.match(text,/-£12\.34/);assert.match(text,/Costs exceeded/);assert.doesNotMatch(text,/£4\.56/);
 assert.match(financialOwnerBriefing({sales:10000,ebitda:456}),/before depreciation, amortisation, interest and tax \(EBITDA\)/);
});
test('acquisition distinguishes covering acquisition cost from whole-business profit',()=>{
 const gap=acquisitionOwnerBriefing({cac:1200,firstOrderContribution:900});
 assert.match(gap,/£12\.00/);assert.match(gap,/£9\.00/);assert.match(gap,/did not cover/);assert.match(gap,/not whole-business profit/);
 const even=acquisitionOwnerBriefing({cac:900,firstOrderContribution:900});assert.match(even,/just covered/);
 assert.match(acquisitionOwnerBriefing({cac:1200,firstOrderContribution:null}),/cannot tell us whether/);
});
test('conversion never substitutes orders for purchasing sessions and does not fabricate a zero-denominator rate',()=>{
 const text=conversionOwnerBriefing({sessions:1000,purchasingSessions:25,aov:3800});
 assert.match(text,/1,000 website visits, 25 included a purchase \(2\.50%\)/);assert.match(text,/before later refunds was £38\.00/);
 assert.doesNotMatch(conversionOwnerBriefing({sessions:0,purchasingSessions:0,aov:null}),/0\.00%/);
 assert.match(conversionOwnerBriefing({sessions:1,purchasingSessions:2,aov:null}),/missing/);
});
test('retention reports the identified revenue split without pretending it measures retention probability',()=>{
 const text=retentionOwnerBriefing({firstSales:10000,repeatSales:5000});
 assert.match(text,/£100\.00/);assert.match(text,/£50\.00/);assert.match(text,/not the chance/);assert.match(text,/unidentified sales remain separate/);
 assert.match(retentionOwnerBriefing({firstSales:10000,repeatSales:null}),/No repeat-customer result is inferred/);
});
test('cash keeps the historical balance, flow and operating profit separate, including flat cash',()=>{
 const text=cashOwnerBriefing({operatingCash:-855004,closingBank:26431640,operatingProfit:197602,asAt:'2026-01-31'});
 assert.match(text,/£1,976\.02/);assert.match(text,/used £8,550\.04/);assert.match(text,/£264,316\.40 at 31 Jan 2026/);assert.match(text,/not today's balance or spending headroom/);
 assert.match(cashOwnerBriefing({operatingCash:0,closingBank:0,asAt:'2026-01-31'}),/neither generated nor used/);
 assert.match(cashOwnerBriefing({operatingCash:null,closingBank:26431640,asAt:'2026-01-31'}),/No profit figure has been substituted/);
});
test('Plan remains conditional and does not turn a modelled gain or unchanged path into a forecast',()=>{
 const text=planOwnerBriefing({baseline:10000,planned:15000,delta:5000,months:3,hasChanges:true});
 assert.match(text,/Under your entered assumptions/);assert.match(text,/£50\.00 higher/);assert.match(text,/not a promised saving or cash return/);
 const initial=planOwnerBriefing({baseline:10000,planned:10000,delta:0,months:3,hasChanges:false});
 assert.match(initial,/No improvement has been selected/);assert.match(initial,/not a forecast/);
 assert.match(planOwnerBriefing({baseline:10000,planned:NaN,delta:0,months:3,hasChanges:false}),/cannot be calculated/);
 assert.match(planOwnerBriefing({baseline:10000,planned:15000,delta:1,months:3,hasChanges:true}),/cannot be calculated/);
});
test('each page produces one short paragraph and sample mode is explicit',()=>{
 const paragraphs=[
  financialOwnerBriefing({sales:6480000,operatingProfit:1039205,previousSales:5760000,previousOperatingProfit:758805,operatingCash:-2229026,sample:true}),
  acquisitionOwnerBriefing({cac:1200,firstOrderContribution:900,sample:true}),
  conversionOwnerBriefing({sessions:1000,purchasingSessions:25,aov:3800,sample:true}),
  retentionOwnerBriefing({firstSales:10000,repeatSales:5000,sample:true}),
  cashOwnerBriefing({operatingCash:-855004,closingBank:26431640,operatingProfit:197602,asAt:'2026-01-31',sample:true}),
  planOwnerBriefing({baseline:10000,planned:15000,delta:5000,months:12,hasChanges:true}),
 ];
 for(const [i,text] of paragraphs.entries()){
  assert.doesNotMatch(text,/\n/);assert.ok(text.split(/\s+/).length<=90,`page ${i} exceeds 90 words`);
  if(i<5)assert.match(text,/^Fictional example:/);
 }
});
