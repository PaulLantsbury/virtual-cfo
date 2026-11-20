import { buildMarketingReview, metrics, spendScenario, type MarketingTotals, type Comparison } from '../marketing/review-model.ts';
import { buildProfitPreview, comparisonTotals, type Granularity, type Horizon } from '../newProfitPreview.ts';
import { buildCashPeriodView } from '../cashPeriodView.ts';
export type Method = 'orders' | 'spend' | 'traffic';
export type ActionId = 'acquisition' | 'discounts' | 'costs' | 'stock' | 'manual';
export type PlanInput = { method: Method; orderChange: number; spendChange: number; elasticity: number; sessionsChange: number; conversionRate: number; revenueChange: number; unitSaving: number; overheadSaving: number; extraCosts: number; implementationCost: number };
export type BridgeRow = { label: string; start: number; end: number; amount: number; total: boolean };
export const PLAN_VERSION = 'plan-review-v1';
export const defaultInput = (): PlanInput => ({method:'orders',orderChange:0,spendChange:0,elasticity:.35,sessionsChange:0,conversionRate:2,revenueChange:0,unitSaving:0,overheadSaving:0,extraCosts:0,implementationCost:0});
export function scenarioForAction(action: ActionId): PlanInput {
 const i=defaultInput();
 if(action==='acquisition')return {...i,method:'spend',spendChange:-10};
 if(action==='discounts')return {...i,revenueChange:2};
 if(action==='costs')return {...i,unitSaving:.5};
 return i;
}
export function calculatePlan(base: MarketingTotals, input: PlanInput) {
 const common=[input.revenueChange,input.unitSaving,input.overheadSaving,input.extraCosts,input.implementationCost];
 if(!common.every(Number.isFinite)||input.revenueChange < -20||input.revenueChange>30||input.unitSaving<0||input.overheadSaving<0||input.overheadSaving>base.overheads||input.extraCosts<0||input.extraCosts>100000||input.implementationCost<0||input.implementationCost>100000)return null;
 const b=metrics(base);if(base.orders<=0||![base.revenue,base.beforeAds,base.advertising,base.overheads,b.ebitda].every(Number.isFinite))return null;
 let orders=base.orders,revenue=base.revenue,beforeAds=base.beforeAds,advertising=base.advertising,volume=0,adChange=0,cac:number|null=null,marginalCac:number|null=null;
 if(input.method==='spend'){
  if(!Number.isFinite(input.spendChange)||Math.abs(input.spendChange)>80)return null;
  const s=spendScenario(base,{direction:input.spendChange===0?'hold':input.spendChange>0?'scale':'reduce',changePct:Math.abs(input.spendChange),elasticity:input.elasticity,extraOverheads:0});
  if(!s)return null;
  ({orders,revenue,beforeAds,advertising}=s.totals);volume=s.volumeContribution;adChange=s.adChange;cac=s.cac;marginalCac=s.marginalCac;
 }else if(input.method==='orders'||input.method==='traffic'){
  if(input.method==='orders'){
   if(!Number.isFinite(input.orderChange)||input.orderChange < -50||input.orderChange>100)return null;
   orders=base.orders*(1+input.orderChange/100);
  }else{
   if(!Number.isFinite(input.sessionsChange)||input.sessionsChange < -50||input.sessionsChange>100||!Number.isFinite(input.conversionRate)||input.conversionRate<=0||input.conversionRate>10)return null;
   orders=base.orders/.02*(1+input.sessionsChange/100)*input.conversionRate/100;
  }
  revenue=orders/base.orders*base.revenue;beforeAds=orders/base.orders*base.beforeAds;volume=beforeAds-base.beforeAds;
 }else return null;
 const matchedCostPerOrder=(revenue-beforeAds)/orders;
 if(!Number.isFinite(matchedCostPerOrder)||input.unitSaving>Math.max(0,matchedCostPerOrder))return null;
 const revenueEffect=revenue*input.revenueChange/100,costEffect=orders*input.unitSaving;
 revenue+=revenueEffect;beforeAds+=revenueEffect+costEffect;
 const overheads=base.overheads-input.overheadSaving+input.extraCosts+input.implementationCost;
 const afterAds=beforeAds-advertising,ebitda=afterAds-overheads;
 if(![orders,revenue,beforeAds,advertising,overheads,ebitda].every(Number.isFinite))return null;
 const movements=[{label:'Order contribution',amount:volume},{label:'Revenue per order',amount:revenueEffect},{label:'Order cost saving',amount:costEffect},{label:'Advertising change',amount:-adChange},{label:'Overhead saving',amount:input.overheadSaving},{label:'Extra capacity costs',amount:-input.extraCosts},{label:'Implementation expense',amount:-input.implementationCost}];
 return {orders,revenue,beforeAds,advertising,overheads,afterAds,ebitda,delta:ebitda-b.ebitda,cac,marginalCac,movements};
}
export function planBridge(base: MarketingTotals, scenario: NonNullable<ReturnType<typeof calculatePlan>>, perOrder=false):BridgeRow[]{
 const b=metrics(base),denominator=perOrder?scenario.orders:1,start=perOrder?b.ebitda/base.orders:b.ebitda;
 const rows:BridgeRow[]=[{label:'Current trajectory',start:0,end:start,amount:start,total:true}];let cursor=start;
 const push=(label:string,amount:number)=>{rows.push({label,start:cursor,end:cursor+amount,amount,total:false});cursor+=amount;};
 if(perOrder)push('Order-count basis',b.ebitda/denominator-start);
 scenario.movements.filter(m=>Math.abs(m.amount)>1e-9).forEach(m=>push(m.label,m.amount/denominator));
 rows.push({label:'Scenario EBITDA',start:0,end:cursor,amount:cursor,total:true});return rows;
}
export function buildPlanReview(context:{granularity:Granularity;horizon:Horizon;comparison:Comparison}){
 const marketing=buildMarketingReview(context),p=buildProfitPreview({granularity:context.granularity,months:context.horizon});
 const old=context.comparison==='none'?null:comparisonTotals(p,context.comparison);
 const cash=buildCashPeriodView({granularity:context.granularity,months:context.horizon,comparison:context.comparison==='last-year'?'last-year':'rolling'});
 const current=metrics(marketing.current),previous=marketing.previous?metrics(marketing.previous):null;
 const discountRate=p.current.discounts/p.current.gross*100,oldDiscountRate=old?old.discounts/old.gross*100:null;
 const costs=(marketing.current.revenue-marketing.current.beforeAds)/marketing.current.orders;
 const oldCosts=marketing.previous?(marketing.previous.revenue-marketing.previous.beforeAds)/marketing.previous.orders:null;
 const acquisitionPressure=current.cac!==null&&previous?.cac!==null&&previous?.cac!==undefined&&current.cac>previous.cac;
 const discountPressure=oldDiscountRate!==null&&discountRate>oldDiscountRate;
 const actions=[
  {id:'acquisition' as const,title:'Check what the next customer contributes',reason:acquisitionPressure?'New-customer CAC rose against the selected comparison.':'Validate acquisition efficiency before changing budget.',finding:current.cac,comparison:previous?.cac??null,unit:'cac',effort:'Short analysis',time:'Before changing spend',uncertainty:'CAC response and mature repeat-purchase economics are unverified.',next:'Check matched acquisition spend and first-order costs, then test a bounded budget change.',success:'Actual CAC and contribution support the proposed spend; review EBITDA as well as ROAS.',stop:'Pause the test if marginal acquisition cost exceeds funded contribution or cash/stock capacity is inadequate.'},
  {id:'discounts' as const,title:'Test whether discounts earn their keep',reason:discountPressure?'Discounts take a larger share of gross sales than the comparison.':'Check whether a higher retained basket value would withstand an order-volume change.',finding:discountRate,comparison:oldDiscountRate,unit:'rate',effort:'Bounded test',time:'After defining demand assumptions',uncertainty:'A price or promotion change may reduce orders; unchanged demand is not a forecast.',next:'Choose one promotion or product group and set explicit order and net-revenue assumptions.',success:'Contribution after ads improves without an unacceptable conversion or repeat-purchase decline.',stop:'Reconsider if lost contribution from fewer orders outweighs the revenue retained.'},
  {id:'costs' as const,title:'Validate a lower cost to serve each order',reason:oldCosts!==null&&costs>oldCosts?'Combined product and variable order cost rose per order.':'Check product, delivery, fulfilment and payment costs before assuming a saving.',finding:costs,comparison:oldCosts,unit:'cost',effort:'Supplier review',time:'After confirming fees and service',uncertainty:'Contract terms, service levels and setup costs must be verified.',next:'Obtain an achievable cost change; include any extra fixed or implementation expense.',success:'The matched cost per order falls while service, returns and capacity remain acceptable.',stop:'Do not proceed if hidden fees, service deterioration or setup costs remove the benefit.'},
 ];
 // Plain, inspectable precedence; no invented confidence score or summed benefits.
 const first=acquisitionPressure?'acquisition':discountPressure?'discounts':'costs';
 actions.sort((a,b)=>(a.id===first?-1:0)-(b.id===first?-1:0));
 return {...marketing,actions,cashAbsorbed:-cash.selected.adjustments.stock/100,discountRate,oldDiscountRate,
  ranking:context.comparison==='none'?'No comparator selected: these are unranked sample investigations. Select a comparison before treating one as the priority.':acquisitionPressure?'Acquisition comes first because its matched CAC worsened. Validate the return on the next pound before adding budget.':discountPressure?'Discounts come first because their share of gross sales worsened; demand response still needs checking.':'Start with validating order costs; the other investigations remain available. This is a review order, not a guaranteed return ranking.'};
}
