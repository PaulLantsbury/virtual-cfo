/** Owner-facing wording from already checked page inputs, never a source reader.
 * Amounts are pence. Missing facts stay missing; this does not create AI advice. */
type Value = number | null | undefined;
const valid = (n: Value): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER;
const money = (n: number) => new Intl.NumberFormat('en-GB', {style:'currency',currency:'GBP',maximumFractionDigits:2}).format(n === 0 ? 0 : n / 100);
const count = (n: number) => new Intl.NumberFormat('en-GB').format(n);
const difference = (now: Value, before: Value) => valid(now) && valid(before) && valid(now-before) ? now-before : null;
const movement = (n: number) => n === 0 ? 'unchanged' : `${money(Math.abs(n))} ${n > 0 ? 'higher' : 'lower'}`;
const sample = (text: string, fictional?: boolean) => fictional ? `Fictional example: ${text}` : text;

export type OwnerFinancialFacts = {sales:Value; operatingProfit?:Value; ebitda?:Value; previousSales?:Value; previousOperatingProfit?:Value; previousEbitda?:Value; operatingCash?:Value; sample?:boolean};
export function financialOwnerBriefing(f: OwnerFinancialFacts): string {
 const profit=valid(f.operatingProfit)?f.operatingProfit:f.ebitda;
 const operating=valid(f.operatingProfit);
 if(!valid(f.sales)&&!valid(profit))return 'The selected financial figures are not available yet, so there is no reliable result to explain. Choose a period with checked records, or review the missing evidence. No example figures have been used to fill the gap.';
 const result=valid(profit)?`${operating?'operating profit before interest and tax':'profit before depreciation, amortisation, interest and tax (EBITDA)'} was ${money(profit)}`:null;
 const first='For the whole selected period, '+[valid(f.sales)?`product sales were ${money(f.sales)}`:null,result].filter(Boolean).join(' and ')+'.';
 const delta=difference(profit,operating?f.previousOperatingProfit:f.previousEbitda),salesDelta=difference(f.sales,f.previousSales);
 const comparison=delta!==null?` Against the selected comparison, ${operating?'operating profit':'EBITDA'} was ${movement(delta)}${salesDelta!==null?`, while product sales were ${movement(salesDelta)}`:''}.`:salesDelta!==null?` Product sales were ${movement(salesDelta)} against the selected comparison; a matching profit comparison is unavailable.`:'';
 const next=!valid(profit)?' A supported profit result is unavailable, so sales alone cannot tell us what was left after costs; focus on the missing financial evidence.':valid(f.operatingCash)&&f.operatingCash<0?` Day-to-day trading used ${money(-f.operatingCash)} of cash, so focus on the cash movements as well as the cost breakdown before choosing a change.`:profit<0?' Costs exceeded the revenue left to cover them, so focus on the largest costs and what each order leaves behind before choosing a change.':profit===0?' This is break-even on that profit measure, not proof that all bills or cash needs are covered; focus on the cost breakdown and cash separately.':' This profit figure is not cash available to spend; focus on what each order leaves after costs and which costs changed.';
 return sample(first+comparison+next,f.sample);
}

export function acquisitionOwnerBriefing(f:{cac:Value;firstOrderContribution:Value;advertising?:Value;contribution?:Value;sample?:boolean}):string{
 if(valid(f.cac)&&valid(f.firstOrderContribution)){
  const first=f.firstOrderContribution<0?`First-order costs exceeded revenue by ${money(-f.firstOrderContribution)} before acquisition and overheads`:`A paid customer's first order left ${money(f.firstOrderContribution)} before acquisition costs and overheads`;
  const gap=f.firstOrderContribution-f.cac;
  return sample(`${first}, while winning that customer cost ${money(f.cac)}. ${gap<0?'The first order did not cover that acquisition cost':gap===0?'The first order just covered that acquisition cost':'The first order covered that acquisition cost'}, but this is not whole-business profit. Focus on the first-order cost breakdown and equally observed later purchases, and check cash before considering more advertising.`,f.sample);
 }
 if(valid(f.cac))return sample(`Winning a paid first customer cost ${money(f.cac)}. The matching first-order costs are not available, so that figure alone cannot tell us whether winning those customers paid off. Focus on completing that cost picture before changing advertising.`,f.sample);
 if(valid(f.advertising)&&valid(f.contribution))return sample(`Advertising cost ${money(f.advertising)}, and ${money(f.contribution)} remained after product, order and advertising costs to help cover overheads. Matching customer-acquisition costs are missing, so these business totals do not establish whether new customers paid back their acquisition cost. Focus on the missing first-customer evidence before changing advertising.`,f.sample);
 return 'The matching advertising and customer records are not available for this period, so we cannot yet say whether winning customers paid off. Check the missing customer and cost evidence first. No acquisition result is inferred from sales alone.';
}

export function conversionOwnerBriefing(f:{sessions:Value;purchasingSessions:Value;aov:Value;sample?:boolean}):string{
 const visits=valid(f.sessions)&&Number.isSafeInteger(f.sessions)&&f.sessions>=0?f.sessions:null;
 const purchases=valid(f.purchasingSessions)&&Number.isSafeInteger(f.purchasingSessions)&&f.purchasingSessions>=0&&visits!==null&&f.purchasingSessions<=visits?f.purchasingSessions:null;
 if(visits===null||purchases===null)return 'The matching website-visit records are missing, so order totals alone cannot tell us how well visits turned into purchases. Focus on completing the visit and purchasing-session evidence before diagnosing the website. No conversion rate has been guessed.';
 const rate=visits>0?` (${(purchases/visits*100).toFixed(2)}%)`:'';
 return sample(`Of ${count(visits)} website visits, ${count(purchases)} included a purchase${rate}.${valid(f.aov)?` Average product order value before later refunds was ${money(f.aov)}.`:''} A larger basket or higher purchase rate does not by itself show more profit; focus on where visits drop out and check order costs before choosing a website change.`,f.sample);
}

export function retentionOwnerBriefing(f:{firstSales:Value;repeatSales:Value;sample?:boolean}):string{
 if(!valid(f.firstSales)||!valid(f.repeatSales))return 'The matching new and repeat-customer records are not available, so total sales cannot tell us whether people are coming back. Focus on completing that split and keeping unidentified purchases separate. No repeat-customer result is inferred from the total.';
 return sample(`Identified first-customer orders brought ${money(f.firstSales)} in product sales after refunds, while identified repeat orders brought ${money(f.repeatSales)}. This describes purchases in this period, not the chance that a customer will buy again; guest and unidentified sales remain separate. Focus on both sides of that mix and compare customers observed for the same length of time before judging repeat performance.`,f.sample);
}

export function cashOwnerBriefing(f:{operatingCash:Value;closingBank:Value;operatingProfit?:Value;asAt:string;sample?:boolean}):string{
 if(!valid(f.operatingCash)||!valid(f.closingBank))return 'The separate cash records are not available yet, so profit cannot tell us what happened to cash. Focus on the missing bank balances and cash movements for the selected period. No profit figure has been substituted for cash.';
 const cash=f.operatingCash<0?`Day-to-day trading used ${money(-f.operatingCash)} of cash`:f.operatingCash>0?`Day-to-day trading generated ${money(f.operatingCash)} of cash`:'Day-to-day trading neither generated nor used cash';
 const profit=valid(f.operatingProfit)?`Operating profit before interest and tax was ${money(f.operatingProfit)}, while ${cash[0].toLowerCase()+cash.slice(1)}.`:`${cash}.`;
 const dated=/^\d{4}-\d{2}-\d{2}$/.test(f.asAt)&&Number.isFinite(Date.parse(f.asAt+'T12:00:00Z'))&&new Date(f.asAt+'T12:00:00Z').toISOString().slice(0,10)===f.asAt?new Date(f.asAt+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'the selected period end';
 return sample(`${profit} The bank balance was ${money(f.closingBank)} at ${dated}; it is not today's balance or spending headroom. Focus on the stock, customer-payment and supplier-payment movements behind the cash result before committing more cash.`,f.sample);
}

export function planOwnerBriefing(f:{baseline:Value;planned:Value;delta:Value;months:number;hasChanges:boolean}):string{
 if(![3,6,12].includes(f.months)||!valid(f.baseline)||!valid(f.planned)||!valid(f.delta)||Math.abs(f.planned-f.baseline-f.delta)>0.01)return 'The plan cannot be calculated from these inputs yet. Check the starting records and the highlighted assumptions before comparing changes. No previous result is retained as a forecast.';
 if(!f.hasChanges)return `No improvement has been selected yet. Under the entered assumptions, the starting path shows ${money(f.baseline)} profit before depreciation, amortisation, interest and tax (EBITDA) over ${f.months} months; this is a what-if calculation, not a forecast. Focus on one change you can test and include its costs and cash needs before relying on the result.`;
 return `Under your entered assumptions, the plan shows ${money(f.planned)} profit before depreciation, amortisation, interest and tax (EBITDA) over ${f.months} months, compared with ${money(f.baseline)} before the selected improvements. That is ${movement(f.delta)} and depends on the assumptions holding, not a promised saving or cash return. Focus on one change you can test, including its costs and cash needs.`;
}
