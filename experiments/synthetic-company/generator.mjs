/** Offline fictional ledger. No credentials, network, database or provider SDKs. */
import { createHash } from 'node:crypto';
function deepFreeze(value) { for(const child of Object.values(value)) if(child&&typeof child==='object')deepFreeze(child);return Object.freeze(value); }
export const PROFILE = deepFreeze({
  version: 'uk-gifts-v1', company: 'fictional-uk-gifts', currency: 'GBP', timezone: 'Europe/London',
  orders: 13263, gross: 52800000, discounts: 2400000, refunds: 2400000,
  shipping: 2000000, saleCogs: 25200000, returnedCogs: 1200000,
  salaries: [3600000, 3000000, 2800000, 2500000, 2400000], employer: 1700000, pension: 400000,
  costs: { storage: 480000, returns: 240000, marketing: 3000000, processor: 900000,
    premises: 600000, software: 480000, insurance: 180000, utilities: 240000,
    professional: 360000, depreciation: 240000 },
});
const MONTH_WEIGHTS = [6,6,6,6,7,7,7,7,8,9,13,18];
const iso = d => d.toISOString().slice(0,10);
export function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Expected ISO business date');
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(+d) || iso(d) !== value) throw Error('Invalid business date');
  return d;
}
export function addDays(value, n) { const d = date(value); d.setUTCDate(d.getUTCDate()+n); return iso(d); }
function businessDays(value,n) { while(n) {value=addDays(value,1); if (![0,6].includes(date(value).getUTCDay())) n--; } return value; }
function monthDays(year,month) {return new Date(Date.UTC(year,month,0)).getUTCDate();}
export function allocate(total, weights) {
  if (!Number.isSafeInteger(total) || total<0 || !weights.length || weights.some(x=>!Number.isSafeInteger(x)||x<0) || !weights.some(x=>x>0)) throw Error('Invalid allocation');
  const sum=weights.reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(sum))throw Error('Unsafe allocation weights');
  const t=BigInt(total), s=BigInt(sum);
  const result=weights.map(w=>Number(t*BigInt(w)/s));
  const rank=weights.map((w,i)=>({i,r:t*BigInt(w)%s})).sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1);
  for(let i=0,left=total-result.reduce((a,b)=>a+b,0);i<left;i++) result[rank[i].i]++;
  return result;
}
function easter(year) { // Gregorian computus; deterministic calendar, no network.
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
  return `${year}-${String(Math.floor(n/31)).padStart(2,'0')}-${String(n%31+1).padStart(2,'0')}`;
}
function dayWeight(day) {
  const year=Number(day.slice(0,4)), e=easter(year), mother=addDays(e,-21);
  let w=[8,10,11,11,12,14,12][date(day).getUTCDay()];
  for(const gift of [`${year}-02-14`,mother,e,`${year}-12-25`]) {
    const delta=(+date(gift)-+date(day))/86400000;
    if(delta>=2&&delta<=10) w+=12;
  }
  return w;
}
const sum = values => values.reduce((a,b)=>a+b,0);
function hash(value) {return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
const vat = amount => Math.round(amount/5); // Dated fictional standard-rate-only baseline.
function yearOrders(year,p) {
  const result=[], counts=allocate(p.orders,MONTH_WEIGHTS);
  const totals=Object.fromEntries(['gross','discounts','shipping','saleCogs'].map(k=>[k,allocate(p[k],MONTH_WEIGHTS)]));
  for(let m=1;m<=12;m++) {
    const days=Array.from({length:monthDays(year,m)},(_,i)=>`${year}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`);
    const daily=allocate(counts[m-1],days.map(dayWeight));
    const weights=Array.from({length:counts[m-1]},(_,i)=>8+(i*17%11));
    const amounts=Object.fromEntries(Object.entries(totals).map(([k,values])=>[k,allocate(values[m-1],weights)]));
    let index=0;
    for(let d=0;d<days.length;d++) for(let n=0;n<daily[d];n++,index++) {
      const gross=amounts.gross[index],discount=amounts.discounts[index],shipping=amounts.shipping[index];
      result.push({id:`${days[d]}-order-${n}`,date:days[d],gross,discount,shipping,cogs:amounts.saleCogs[index],product:gross-discount,
        customerId:`fictional-customer-${(index*37+year)%6000}`,channel:['organic','meta','google','email'][index%4]});
    }
  }
  return result;
}
/** asOf is an explicit London date; never use the machine clock to change a fixture. */
export function generate({asOf='2026-11-05', months=24, company=PROFILE.company, from: explicitFrom}={}) {
  date(asOf);
  if(!Number.isInteger(months)||months<1||months>120) throw Error('History months must be 1..120');
  if(!/^fictional-[a-z0-9-]+$/.test(company)) throw Error('Only explicit fictional company IDs are accepted');
  const d=date(asOf), startDate=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-months,1,12));
  const from=explicitFrom ?? iso(startDate); date(from); if(from.slice(8)!=='01'||from>=asOf)throw Error('History start must be an earlier month start');
  const to=addDays(asOf,-1), p=PROFILE, events=[], daily=[], scheduled=new Map();
  const scope={company,profile:p.version,currency:p.currency,timezone:p.timezone,provenance:'synthetic-local',provider:null};
  function event(day,key,kind,postings,metrics={},refs={}) {
    const entries=Object.entries(postings).filter(([,amount])=>amount!==0).map(([account,amount])=>({account,amount}));
    if(entries.some(x=>!Number.isSafeInteger(x.amount))||sum(entries.map(x=>x.amount))!==0) throw Error(`Unbalanced ${key}`);
    events.push({...scope,id:`${company}:${p.version}:${day}:${key}`,date:day,kind,postings:entries,metrics,refs});
  }
  function later(day,fn) {if(!scheduled.has(day)) scheduled.set(day,[]);scheduled.get(day).push(fn);}
  // Positive amounts debit assets/expenses; negative amounts credit liabilities/equity/revenue.
  event(from,'opening','opening',{bank:6000000,inventory:3500000,equipment:2400000,equity:-11900000});
  const years=new Map();
  for(let y=Number(from.slice(0,4))-1;y<=Number(to.slice(0,4));y++) years.set(y,yearOrders(y,p));
  const byDay=new Map(),allOrders=[...years.values()].flat();
  for(const order of allOrders) {if(!byDay.has(order.date))byDay.set(order.date,[]);byDay.get(order.date).push(order);}
  const refundUsed=new Map(),cogsUsed=new Map();
  const balances={};
  let cursor=0;
  for(let day=from;day<=to;day=addDays(day,1)) {
    const y=Number(day.slice(0,4)), m=Number(day.slice(5,7)), dom=Number(day.slice(8)), last=monthDays(y,m), orders=byDay.get(day)||[];
    const monthAmounts={};
    for(const [key,total] of Object.entries({...p.costs,refunds:p.refunds})) {
      const monthly=allocate(total,['refunds','marketing'].includes(key)?MONTH_WEIGHTS:Array(12).fill(1))[m-1];
      // Even-penny refund amounts keep explicit 50% COGS reversals exact.
      monthAmounts[key]=key==='refunds'?2*allocate(monthly/2,Array(last).fill(1))[dom-1]:allocate(monthly,Array(last).fill(1))[dom-1];
    }
    if(dom===1) {
      // Receive the month's expected net stock consumption before selling; VAT invoice and 30-day supplier terms.
      const purchase=allocate(24000000,MONTH_WEIGHTS)[m-1], tax=vat(purchase);
      event(day,'stock-receipt','stock_receipt',{inventory:purchase,vat_control:tax,supplier_payable:-purchase-tax},{purchases:purchase,inputVat:tax});
      later(addDays(day,30),settle=>event(settle,`stock-payment-${day}`,'supplier_payment',{supplier_payable:purchase+tax,bank:-purchase-tax},{},{invoiceDate:day}));
    }
    for(const o of orders) {
      const productVat=vat(o.product), shippingVat=vat(o.shipping), tax=productVat+shippingVat, receipt=o.product+o.shipping+tax;
      event(day,o.id,'sale',{processor:receipt,product_revenue:-o.product,shipping_revenue:-o.shipping,vat_control:-tax,cogs:o.cogs,inventory:-o.cogs},
        {orders:1,gross:o.gross,discounts:o.discount,productSales:o.product,shipping:o.shipping,outputVat:tax,productVat,shippingVat,cogs:o.cogs},
        {orderId:o.id,customerId:o.customerId,channel:o.channel,paid:true,providerTest:false});
      later(businessDays(day,2),settle=>event(settle,`payout-${o.id}`,'processor_payout',{bank:receipt,processor:-receipt},{},{orderId:o.id}));
    }
    // Refunds are dated independently and linked to actual original paid orders. Initial refunds use explicit opening cohorts.
    let remaining=monthAmounts.refunds, reversalRemaining=remaining/2;
    const sourceDay=addDays(day,-14), candidates=byDay.get(sourceDay)||[];
    for(let i=0;remaining>0;i++) {
      const o=candidates[i]; if(!o)throw Error(`Insufficient refund capacity ${day}`);
      const refund=Math.min(remaining,2*Math.floor(Math.min(o.product-(refundUsed.get(o.id)||0),2*(o.cogs-(cogsUsed.get(o.id)||0)))/2));
      if(refund<=0)continue;
      const reversal=refund/2;
      const tax=vat(refund);
      refundUsed.set(o.id,(refundUsed.get(o.id)||0)+refund);cogsUsed.set(o.id,(cogsUsed.get(o.id)||0)+reversal);
      event(day,`refund-${i}`,'refund',{product_revenue:refund,vat_control:tax,bank:-refund-tax,inventory:reversal,cogs:-reversal},
        {refunds:refund,refundedVat:tax,cogs:-reversal}, {orderId:o.id,originalDate:o.date,originalProduct:o.product,originalCogs:o.cogs,openingCohort:o.date<from,saleableReturn:true});
      remaining-=refund;reversalRemaining-=reversal;
    }
    if(reversalRemaining!==0)throw Error(`Refund COGS mismatch ${day}`);
    // Expense budgets are accrued daily, with weekly consolidated invoices and 30-day supplier payment.
    const expense={storage:monthAmounts.storage,returns:monthAmounts.returns,marketing:monthAmounts.marketing,
      pickPack:orders.length*125,carrier:orders.length*250,packaging:orders.length*25};
    for(const key of ['premises','software','insurance','utilities','professional','depreciation']) expense[key]=monthAmounts[key];
    for(const [category,amount] of Object.entries(expense)) {
      if(category==='depreciation') {event(day,'depreciation','depreciation',{['expense:depreciation']:amount,accumulated_depreciation:-amount},{overheads:amount,da:amount});continue;}
      const tax=category==='insurance'?0:vat(amount), variable=['storage','returns','pickPack','carrier','packaging'].includes(category);
      event(day,`accrual-${category}`,'expense_accrual',{[`expense:${category}`]:amount,vat_control:tax,accrued_payable:-amount-tax},
        {[variable?'variableCosts':category==='marketing'?'marketing':'overheads']:amount,inputVat:tax}, {category,channel:category==='marketing'?['meta','google','email'][dom%3]:null});
    }
    const fee=monthAmounts.processor;
    event(day,'processor-fee','processor_fee',{'expense:processor':fee,bank:-fee},{variableCosts:fee},{vatTreatment:'exempt-fictional-assumption',settlementModel:'gross payouts; separately bank-charged fee budget'});
    if(date(day).getUTCDay()===5 || dom===last) {
      // Include today's accruals before transferring liability to an invoice.
      const accrued=-(balances.accrued_payable||0)-sum(events.slice(cursor).flatMap(e=>e.postings).filter(x=>x.account==='accrued_payable').map(x=>x.amount));
      if(accrued) {
        event(day,'weekly-invoice','supplier_invoice',{accrued_payable:accrued,supplier_payable:-accrued},{},{coversThrough:day});
        later(addDays(day,30),settle=>event(settle,`cost-payment-${day}`,'supplier_payment',{supplier_payable:accrued,bank:-accrued},{},{invoiceDate:day}));
      }
    }
    if(dom===last) {
      const grossByStaff=p.salaries.map(total=>allocate(total,Array(12).fill(1))[m-1]);
      const employers=allocate(allocate(p.employer,Array(12).fill(1))[m-1],p.salaries);
      const pensions=allocate(allocate(p.pension,Array(12).fill(1))[m-1],p.salaries);
      for(let i=0;i<5;i++) {
        const gross=grossByStaff[i], employer=employers[i], pension=pensions[i], deduction=Math.round(gross*.2), net=gross-deduction;
        event(day,`payroll-${i}`,'payroll_accrual',{'expense:salary':gross,'expense:employer':employer,'expense:pension':pension,net_payable:-net,payroll_liability:-deduction-employer-pension},
          {overheads:gross+employer+pension},{staffId:`fictional-staff-${i+1}`,gross,net,deduction,employer,pension,allowances:'fictional budget; not statutory payroll'});
        later(businessDays(day,1),settle=>event(settle,`net-pay-${day}-${i}`,'payroll_payment',{net_payable:net,bank:-net},{},{staffId:`fictional-staff-${i+1}`}));
        later(addDays(day,19),settle=>event(settle,`payroll-liability-${day}-${i}`,'payroll_remittance',{payroll_liability:deduction+employer+pension,bank:-deduction-employer-pension},{},{staffId:`fictional-staff-${i+1}`}));
      }
    }
    for(const fn of scheduled.get(day)||[]) fn(day);
    scheduled.delete(day);
    for(;cursor<events.length;cursor++) for(const entry of events[cursor].postings) balances[entry.account]=(balances[entry.account]||0)+entry.amount;
    if(dom===last&&m%3===0) {
      // Accrual VAT scheme: settle quarter's control balance next month; opening VAT is explicitly zero.
      const payable=-(balances.vat_control||0), settle=addDays(day,37);
      later(settle,when=>event(when,`vat-${day}`,'vat_settlement',{vat_control:payable,bank:-payable},{},{quarterEnd:day,scheme:'fictional-accrual',settlementLagDays:37}));
      // Reserve this quarter's balance so overlapping outstanding settlements are not counted twice.
      // Quarter intervals exceed 37 days; no two quarter reservations overlap.
    }
    const todays=events.slice(daily.length ? daily.at(-1).endIndex : 0); // Bounded offline fixture, no production query path.
    const metrics={};for(const e of todays)for(const [key,value]of Object.entries(e.metrics))metrics[key]=(metrics[key]||0)+value;
    daily.push({date:day,metrics,balances:{...balances},eventCount:todays.length,endIndex:events.length,receipt:hash(todays)});
  }
  const payload={scope,from,to,asOf,months,openingAssumptions:{bank:6000000,stock:3500000,equipment:2400000,equity:11900000},events,daily,
    outstandingScheduledDates:[...scheduled.keys()].sort(),limitations:['Offline journal only; no Supabase adapter, completeness seal or verified source snapshot.', 'Fictional standard-rated taxable trade, exempt insurance/processor fees and payroll budgets; no statutory tax calculation.', 'Daily overhead accrual allocation; monthly payroll accrual.', 'Opening cohorts establish refund links but do not assert pre-history ledger completeness.']};
  return {...payload,fingerprint:hash(payload)};
}
export function summarise(fixture,from=fixture.from,to=fixture.to) {
  const totals={}; for(const day of fixture.daily)if(day.date>=from&&day.date<=to)for(const[k,v]of Object.entries(day.metrics))totals[k]=(totals[k]||0)+v;
  totals.netProduct=(totals.productSales||0)-(totals.refunds||0);
  totals.revenue=totals.netProduct+(totals.shipping||0);
  totals.grossProfit=totals.netProduct-(totals.cogs||0);
  totals.contribution=totals.grossProfit+(totals.shipping||0)-(totals.variableCosts||0)-(totals.marketing||0);
  totals.operatingProfit=totals.contribution-(totals.overheads||0);
  totals.ebitda=totals.operatingProfit+(totals.da||0);
  return totals;
}
/** In-memory dry-run sink: exact replay inserts zero; changed history fails closed. */
export function replay(existing,fixture) {
  const next=new Map(existing);let inserted=0;
  for(const event of fixture.events) {const prior=next.get(event.id);if(prior&&hash(prior)!==hash(event))throw Error(`Changed immutable event ${event.id}`);if(!prior){next.set(event.id,event);inserted++;}}
  return {events:next,inserted};
}
