/** Compact overview flow and factual comparison, reusing the Profit Engine guard.
 * Stored money is pence; contribution is an intermediate subtotal, not another use. */
import {sankeyFlows,type ProfitTotals} from '../newProfitPreview.ts';
import {newProfitLiveTotals} from '../newProfitLiveModel.ts';
import type {ReviewedMonth} from '../reviewedHistorySeries.ts';

export type ScoutProfitValues=Pick<ProfitTotals,'sales'|'shipping'|'cogs'|'variable'|'advertising'|'cashOverheads'|'contribution'|'ebitda'|'orders'>;
export type ScoutProfitScope={storeId:string;currency:string;timezone:string;from:string;to:string;versionId:string;edition:string;anchor:string;formulaVersion:string;basis:'reviewed'|'fictional'};
export type ScoutProfitMovement={current:number|null;previous:number|null;delta:number|null;changePct:number|null};
export type ScoutProfitComparison={label:string;from:string;to:string;currentVersion:string;previousVersion:string;contribution:ScoutProfitMovement;ebitda:ScoutProfitMovement;margin:{current:number|null;previous:number|null;changePp:number|null}};
export type ScoutProfitRow={key:'revenue'|keyof ScoutProfitValues;label:string;amount:number|null;subtotal:boolean};
type Options={currentScope:ScoutProfitScope;previousScope?:ScoutProfitScope|null;comparisonLabel?:string;perOrder?:boolean};
const keys=['sales','shipping','cogs','variable','advertising','cashOverheads','contribution','ebitda','orders'] as const;
const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
const scopeValid=(s:ScoutProfitScope|null|undefined):s is ScoutProfitScope=>!!s&&text(s.storeId)&&s.currency==='GBP'&&s.timezone==='Europe/London'&&date(s.from)&&date(s.to)&&s.from<=s.to&&text(s.versionId)&&text(s.edition)&&(s.basis==='fictional'?text(s.anchor):date(s.anchor)&&s.anchor<=s.from)&&text(s.formulaVersion)&&['reviewed','fictional'].includes(s.basis);
const sum=(values:number[])=>{const total=values.reduce((s,v)=>s+BigInt(v),0n);return total>BigInt(Number.MAX_SAFE_INTEGER)||total<BigInt(Number.MIN_SAFE_INTEGER)?null:Number(total);};
function checkedValues(v:ScoutProfitValues|null|undefined):ScoutProfitValues|null {
 if(!v||!keys.every(k=>Number.isSafeInteger(v[k]))||v.orders<0)return null;
 const contribution=sum([v.sales,v.shipping,-v.cogs,-v.variable,-v.advertising]),ebitda=sum([v.contribution,-v.cashOverheads]);
 if(contribution===null||ebitda===null||contribution!==v.contribution||ebitda!==v.ebitda||sum([v.sales,v.shipping])===null)return null;
 return Object.fromEntries(keys.map(k=>[k,v[k]])) as ScoutProfitValues;
}
const display=(amount:number,orders:number,perOrder:boolean)=>perOrder?(orders>0?amount/orders:null):amount;
const movement=(current:number|null,previous:number|null):ScoutProfitMovement=>{const difference=current!==null&&previous!==null?current-previous:null,percentage=current!==null&&previous!==null&&previous>0?(current/previous-1)*100:null;return {current,previous,delta:difference!==null&&Number.isFinite(difference)&&Math.abs(difference)<=Number.MAX_SAFE_INTEGER?difference:null,changePct:percentage!==null&&Number.isFinite(percentage)?percentage:null};};
const money=(v:number|null,perOrder:boolean)=>v===null?'unavailable':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:perOrder?2:0,maximumFractionDigits:perOrder?2:0}).format(v/100);
const signed=(v:number|null,perOrder:boolean)=>v===null?'unavailable':`${v>0?'+':v<0?'−':''}${money(Math.abs(v),perOrder)}`;
function matching(current:ScoutProfitScope,previous:ScoutProfitScope|null|undefined){return scopeValid(previous)&&['storeId','currency','timezone','edition','anchor','formulaVersion','basis'].every(k=>current[k as keyof ScoutProfitScope]===previous[k as keyof ScoutProfitScope])&&previous.to<current.from&&previous.versionId!==current.versionId;}
function build(current:ScoutProfitValues|null,previous:ScoutProfitValues|null,options:Options){
 const perOrder=options.perOrder===true,c=scopeValid(options.currentScope)?checkedValues(current):null;
 const p=c&&matching(options.currentScope,options.previousScope)?checkedValues(previous):null;
 // sankeyFlows only accesses the narrow, validated keys above; no missing gross,
 // discount or D&A input is invented for the historical design fixture.
 const flows=c?sankeyFlows(c as ProfitTotals,perOrder):{state:'unavailable' as const,reason:'Complete reconciled profit evidence is unavailable for the selected source period.'};
 const rows:ScoutProfitRow[]=c?[{key:'revenue',label:'Net product sales + net shipping',amount:display(c.sales+c.shipping,c.orders,perOrder),subtotal:true},...([
  ['cogs','Product costs',false],['variable','Variable operating costs',false],['advertising','Advertising',false],['contribution','Marketing contribution after ads',true],['cashOverheads','Overheads excluding D&A',false],['ebitda','Profit · EBITDA',true],
 ] as const).map(([key,label,subtotal])=>({key,label,amount:display(c[key],c.orders,perOrder),subtotal}))]:[];
 const currentRevenue=c?c.sales+c.shipping:0,previousRevenue=p?p.sales+p.shipping:0;
 const currentMargin=c&&currentRevenue>0?c.ebitda/currentRevenue*100:null,previousMargin=p&&previousRevenue>0?p.ebitda/previousRevenue*100:null;
 const label=p?options.comparisonLabel?.trim()||`${options.previousScope!.from}–${options.previousScope!.to}`:'No supported earlier-period comparison';
 const comparison:ScoutProfitComparison|null=c&&p?{label,from:options.previousScope!.from,to:options.previousScope!.to,currentVersion:options.currentScope.versionId,previousVersion:options.previousScope!.versionId,
  contribution:movement(display(c.contribution,c.orders,perOrder),display(p.contribution,p.orders,perOrder)),ebitda:movement(display(c.ebitda,c.orders,perOrder),display(p.ebitda,p.orders,perOrder)),margin:{current:currentMargin,previous:previousMargin,changePp:currentMargin!==null&&previousMargin!==null?currentMargin-previousMargin:null}}:null;
 const marginText=currentMargin===null?'EBITDA margin is unavailable without positive revenue including shipping.':`EBITDA margin is ${currentMargin.toFixed(2)}% of net product sales plus net shipping.`;
 const unit=perOrder?' per original order':'';
 let headline='See how sales fund costs and profit.',commentary=c?`Marketing contribution after ads is ${money(display(c.contribution,c.orders,perOrder),perOrder)}${unit}; EBITDA is ${money(display(c.ebitda,c.orders,perOrder),perOrder)}${unit}. ${marginText} Comparison unavailable: choose a supported earlier period to assess the movement.`:'Choose complete reviewed financial evidence to show the revenue-to-profit flow. Missing costs are not zero and no fictional flow is substituted.';
 if(comparison){
  const pp=comparison.margin.changePp;
  headline=pp===null?'Compare contribution and profit with the earlier period.':pp>0?`Profit margin is higher vs ${label}.`:pp<0?`Profit margin is lower vs ${label}.`:`Profit margin is unchanged vs ${label}.`;
  commentary=`Marketing contribution changed by ${signed(comparison.contribution.delta,perOrder)}${unit} and EBITDA by ${signed(comparison.ebitda.delta,perOrder)}${unit} vs ${label} (${comparison.from}–${comparison.to}). ${marginText}${pp===null?'':` This compares with ${previousMargin!.toFixed(2)}%, a ${pp>0?'+':pp<0?'−':''}${Math.abs(pp).toFixed(2)} percentage-point change.`} These are arithmetic movements, not proof of cause or cash generated.`;
 }
 return {state:flows.state,reason:flows.state==='unavailable'?flows.reason:null,flows,totals:c,rows,comparison,commentary,headline,perOrder,scope:c?options.currentScope:null};
}
function reviewedPeriod(month:ReviewedMonth|null):{totals:ScoutProfitValues;scope:ScoutProfitScope}|null{
 if(!month)return null;
 const s=month.selection,e=month.evidence,c=month.context,i=month.input,expected=i.expected,period=expected.period;
 if(e.versionId!==s.versionId||e.edition!==s.edition||e.anchor!==s.anchor||e.costCoverage!=='complete'||!text(e.salesRevision)||!text(e.costRevision)||!text(c.formulaVersion)||c.snapshotId!==s.versionId||i.snapshot?.id!==s.versionId||i.access!=='allowed'||i.freshness!=='current'
  ||expected.storeId!==s.storeId||expected.currency!==s.currency||expected.timezone!==s.timezone||period.from!==s.period.from||period.to!==s.period.to)return null;
 const totals=newProfitLiveTotals(month),scope:ScoutProfitScope={storeId:s.storeId,currency:s.currency,timezone:s.timezone,from:s.period.from,to:s.period.to,versionId:s.versionId,edition:s.edition,anchor:s.anchor,formulaVersion:c.formulaVersion,basis:'reviewed'};
 return totals&&scopeValid(scope)?{totals,scope}:null;
}
/** Reviewed inputs must pass the same explicit selected-month source contract. */
export function buildScoutProfitFlow(current:ReviewedMonth|null,previous:ReviewedMonth|null=null,comparisonLabel='',perOrder=false){
 const c=reviewedPeriod(current),p=reviewedPeriod(previous);
 const empty:ScoutProfitScope={storeId:'',currency:'GBP',timezone:'Europe/London',from:'',to:'',versionId:'',edition:'',anchor:'',formulaVersion:'',basis:'reviewed'};
 return build(c?.totals??null,p?.totals??null,{currentScope:c?.scope??empty,previousScope:p?.scope,comparisonLabel,perOrder});
}
/** Explicit design-only adapter. It cannot label arbitrary totals as reviewed. */
export function buildScoutProfitFlowFromTotals(current:ScoutProfitValues|null,previous:ScoutProfitValues|null,options:Options){
 return build(options.currentScope.basis==='fictional'?current:null,options.previousScope?.basis==='fictional'?previous:null,options);
}
