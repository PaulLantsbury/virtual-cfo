/** Daily, integer-pence planning arithmetic. No connected forecast or backtest is implied. */
export type OutlookHorizon = 30 | 42 | 91;
export type CommitmentReview = 'unreviewed' | 'none' | 'reviewed';
export type CashEvidence = 'recorded-bill' | 'recorded-settlement' | 'user-confirmed' | 'historical-estimate';
export type CashOutlookEvent = {
 id:string; canonicalId:string; date:string; amount:number; direction:'receipt'|'payment';
 category:'customer'|'stock'|'payroll'|'marketing'|'fulfilment'|'overheads'|'tax'|'investment'|'financing'|'internal-transfer';
 description:string; evidence:CashEvidence;
 /** All records representing the same cash obligation/settlement must share a canonical ID. */
 linkedCanonicalId?:string; origin:'shopify-payout'|'xero-bank'|'xero-bill'|'manual'|'historical';
 knownAt:string; openingUnsettled?:boolean;
};
export type CashCommitment={id:string;amount:number;date:string;description:string;linkedCanonicalId?:string};
export type CashOutlookInput={asOf:string;openingCash:number;minimumBuffer:number;horizonDays?:OutlookHorizon;longHorizonReviewed?:boolean;events:CashOutlookEvent[];commitmentsReview?:CommitmentReview;commitments?:CashCommitment[];gaps?:string[];source?:'sample'|'connected'};
const DAY=86400000;
function timestamp(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s+'T00:00:00Z'))||new Date(Date.parse(s+'T00:00:00Z')).toISOString().slice(0,10)!==s)throw Error('Invalid date');return Date.parse(s+'T00:00:00Z');}
export function outlookDate(date:string,days:number){return new Date(timestamp(date)+days*DAY).toISOString().slice(0,10);}
function money(n:number){if(!Number.isSafeInteger(n)||Math.abs(n)>1e12)throw Error('Invalid integer-pence amount');}
const priority:Record<CashEvidence,number>={'recorded-bill':3,'recorded-settlement':3,'user-confirmed':2,'historical-estimate':1};
export function buildCashOutlook(input:CashOutlookInput){
 const {asOf,openingCash,minimumBuffer}=input;timestamp(asOf);money(openingCash);money(minimumBuffer);if(minimumBuffer<0)throw Error('Invalid buffer');
 const horizonDays=input.horizonDays??42;if(![30,42,91].includes(horizonDays))throw Error('Invalid horizon');
 if(horizonDays===91&&!input.longHorizonReviewed)throw Error('Review assumptions and commitments before opening 13 weeks');
 const review=input.commitmentsReview??'unreviewed',commitments=input.commitments??[];
 if(!['unreviewed','none','reviewed'].includes(review))throw Error('Invalid commitment review');
 if(horizonDays===91&&review==='unreviewed')throw Error('Review future commitments before opening 13 weeks');
 if(review==='none'&&commitments.length)throw Error('Cannot confirm none with entered commitments');
 const manual:CashOutlookEvent[]=commitments.map(c=>{money(c.amount);timestamp(c.date);if(c.amount<=0||!c.description.trim()||c.description.length>240||!c.id.trim()||c.id.length>120)throw Error('Incomplete commitment');return {id:'manual:'+c.id,canonicalId:'manual:'+c.id,linkedCanonicalId:c.linkedCanonicalId,date:c.date,amount:c.amount,direction:'payment',category:'stock',description:c.description,evidence:'user-confirmed',origin:'manual',knownAt:asOf};});
 const excluded:{id:string;reason:string}[]=[],gaps=[...(input.gaps??[])],chosen=new Map<string,CashOutlookEvent>();
 for(const event of [...input.events,...manual]){
  money(event.amount);timestamp(event.date);timestamp(event.knownAt);
  if(event.amount<0||!event.canonicalId.trim()||!event.id.trim())throw Error('Invalid cash event');
  if(event.knownAt>asOf){excluded.push({id:event.id,reason:'Not available at forecast date'});continue;}
  if(event.category==='internal-transfer'){excluded.push({id:event.id,reason:'Internal transfer excluded from consolidated cash'});continue;}
  if(event.date<=asOf){excluded.push({id:event.id,reason:'Date is not after opening balance; inclusion or revised date needs review'});gaps.push(event.openingUnsettled?'Opening unsettled receipt needs a future settlement date':event.direction==='payment'?'Dated payment may remain unpaid; confirm inclusion in opening cash or revise payment date':'Dated receipt needs confirmation against opening bank cash');continue;}
  const key=event.linkedCanonicalId??event.canonicalId,previous=chosen.get(key);
  if(previous){
   // Conflicting receipts must not silently select a misleading date/value.
   if(previous.amount!==event.amount||previous.direction!==event.direction||previous.date!==event.date)gaps.push('Conflicting duplicate cash records require review');
   const replace=priority[event.evidence]>priority[previous.evidence];excluded.push({id:replace?previous.id:event.id,reason:'Duplicate canonical cash obligation or settlement'});if(replace)chosen.set(key,event);
  }else chosen.set(key,event);
 }
 if(review==='unreviewed')gaps.push('Future stock commitments not reviewed');
 if(commitments.some(c=>!c.linkedCanonicalId))gaps.push('Entered payments need checking against recorded bills to avoid counting them twice');
 const events=[...chosen.values()].filter(e=>e.date<=outlookDate(asOf,horizonDays)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 let balance=openingCash;
 const daily=Array.from({length:horizonDays},(_,i)=>{const date=outlookDate(asOf,i+1),today=events.filter(e=>e.date===date),receipts=today.filter(e=>e.direction==='receipt').reduce((s,e)=>s+e.amount,0),payments=today.filter(e=>e.direction==='payment').reduce((s,e)=>s+e.amount,0),financing=today.filter(e=>e.category==='financing').reduce((s,e)=>s+(e.direction==='receipt'?e.amount:-e.amount),0),opening=balance;balance+=receipts-payments;money(balance);return {date,opening,receipts,payments,financing,operatingMovement:today.filter(e=>!['financing','investment','tax'].includes(e.category)).reduce((s,e)=>s+(e.direction==='receipt'?e.amount:-e.amount),0),closing:balance,events:today};});
 const openingPoint={date:asOf,balance:openingCash,days:0},points=[openingPoint,...daily.map((d,i)=>({date:d.date,balance:d.closing,days:i+1}))],lowest=points.reduce((a,b)=>b.balance<a.balance?b:a),firstBelowBuffer=points.find(d=>d.balance<minimumBuffer)??null,firstZero=points.find(d=>d.balance<=0)??null;
 const uniqueGaps=[...new Set(gaps)],status=uniqueGaps.length?'incomplete' as const:'reviewed' as const;
 const horizonLabel=horizonDays===42?'six weeks':horizonDays===30?'30 days':'13 weeks';
 const verdict=firstBelowBuffer?`${status==='incomplete'?'Illustrative pressure':'Projected buffer shortfall'} on ${firstBelowBuffer.date}; ${status==='incomplete'?'inputs remain incomplete':'based on these assumptions'}.`:status==='incomplete'?`No shortfall in the entered assumptions over the next ${horizonLabel}; missing inputs could change this.`:`No shortfall projected within the next ${horizonLabel}.`;
 const weekly=Array.from({length:Math.ceil(horizonDays/7)},(_,i)=>{const rows=daily.slice(i*7,i*7+7);return {from:rows[0].date,to:rows.at(-1)!.date,closing:rows.at(-1)!.closing,lowest:Math.min(...rows.map(r=>r.closing)),receipts:rows.reduce((s,r)=>s+r.receipts,0),payments:rows.reduce((s,r)=>s+r.payments,0)};});
 return {source:input.source??'sample',asOf,openingCash,minimumBuffer,horizonDays,horizonLabel,commitmentsReview:review,status,gaps:uniqueGaps,events,excluded,daily,weekly,summary:{lowest,firstBelowBuffer,firstZero,closingCash:balance,verdict},assumptions:['Opening bank cash plus dated expected receipts minus dated expected payments.','Recorded bills, user-confirmed plans and historical estimates remain separate evidence classes.','Matching bills, manual entries and payout records require a shared canonical ID; unmatched records are not automatically assumed equivalent.','Stock has no automatic historic or sales-growth allowance. Unreviewed commitments remain a visible gap.','Daily end-of-day arithmetic does not prove intraday liquidity or completeness of provider data.']};
}
export function buildSampleCashOutlook(options:Partial<Pick<CashOutlookInput,'minimumBuffer'|'horizonDays'|'longHorizonReviewed'|'commitmentsReview'|'commitments'>>={}){
 const asOf='2026-10-11',events:CashOutlookEvent[]=[];
 const add=(id:string,date:string,amount:number,direction:CashOutlookEvent['direction'],category:CashOutlookEvent['category'],evidence:CashEvidence,description:string,origin:CashOutlookEvent['origin']='historical')=>events.push({id,canonicalId:id,date,amount,direction,category,evidence,description,origin,knownAt:asOf});
 add('opening-payout','2026-10-12',820_000,'receipt','customer','recorded-settlement','Sample opening unsettled payout, net of refunds and fees','shopify-payout');events.at(-1)!.openingUnsettled=true;
 for(let i=1;i<=91;i++){
  const date=outlookDate(asOf,i),day=new Date(date+'T00:00:00Z').getUTCDay();
  if(day!==0&&day!==6)add('settlement-'+date,date,1_100_000,'receipt','customer','historical-estimate','Sample net settlements; illustrative recent trading run rate with weekday settlement timing');
  if(day===2){add('marketing-'+date,date,1_500_000,'payment','marketing','historical-estimate','Sample variable marketing payment');add('fulfilment-'+date,date,500_000,'payment','fulfilment','historical-estimate','Sample fulfilment run rate');}
  if(day===5)add('overheads-'+date,date,1_000_000,'payment','overheads','historical-estimate','Sample recurring overhead run rate, exceptional items excluded');
  if(date.endsWith('-25'))add('payroll-'+date,date,3_500_000,'payment','payroll','user-confirmed','Sample monthly payroll date','manual');
 }
 add('bill-stock-1','2026-10-20',8_500_000,'payment','stock','recorded-bill','Sample recorded supplier bill','xero-bill');
 add('bill-stock-2','2026-11-03',8_500_000,'payment','stock','recorded-bill','Sample recorded supplier bill','xero-bill');
 add('tax-1','2026-11-07',3_500_000,'payment','tax','user-confirmed','Sample tax payment schedule','manual');
 return buildCashOutlook({asOf,openingCash:18_600_000,minimumBuffer:5_000_000,events,source:'sample',...options,gaps:['Sample only: live bills, payout settlement records and payment schedules are not connected.','Sales-derived receipts use an illustrative recent run rate, not a fitted prior-year forecast.']});
}
/** Explicit settlement components: net product sales are after discounts but before these cash refunds.
 * VAT/shipping are actual supplied components, never a blanket tax-rate conversion.
 * Use this OR the provider's net payout for a settlement, never both without a shared canonicalId.
 */
export function expectedSettlement(input:{salesDate:string;netProductSalesBeforeCashRefunds:number;shipping:number;vat:number;cashRefundsIncludingVat:number;fees:number;businessDayLag:number}){
 const {salesDate,businessDayLag}=input;timestamp(salesDate);
 for(const amount of [input.netProductSalesBeforeCashRefunds,input.shipping,input.vat,input.cashRefundsIncludingVat,input.fees]){money(amount);if(amount<0)throw Error('Negative settlement component');}
 if(!Number.isInteger(businessDayLag)||businessDayLag<0||businessDayLag>30)throw Error('Invalid settlement lag');
 let date=salesDate,remaining=businessDayLag;while(remaining){date=outlookDate(date,1);const day=new Date(date+'T00:00:00Z').getUTCDay();if(day!==0&&day!==6)remaining--;}
 const amount=input.netProductSalesBeforeCashRefunds+input.shipping+input.vat-input.cashRefundsIncludingVat-input.fees;money(amount);
 return {date,amount,limitation:'Weekday-only assumption; bank holidays and provider-specific settlement rules must be supplied separately.'};
}
