/** Offline synthetic identity sidecar. No financial source mutation, network or SQL. */
import { createHash } from 'node:crypto';
import { generate, date, allocate, addDays } from './generator.mjs';
import { stableId, RESERVED_SYNTHETIC_IDENTITY } from './staging-payload.mjs';
import { profitEvidenceDigest as digest } from '../financial-v1/profit-evidence-reader.mjs';
export const ACQUISITION_INCEPTION = '2024-01-01';
export const ACQUISITION_POLICY = 'synthetic-identity-and-spend-v1';
const ensure = (condition, message) => { if (!condition) throw Error(message); };
const journalHash = event => { const body=structuredClone(event);delete body.refs.openingCohort;return digest(body); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const seed = value => parseInt(hash(value).slice(0, 8), 16);
const sum = values => { const result=values.reduce((a,b)=>a+BigInt(b),0n);const n=Number(result);ensure(Number.isSafeInteger(n),'Acquisition amount overflow');return n; };
const payloadBody = source => { const { sourceHash, ...body }=source;return body; };

/** Inception and sorting are fixed so extending through a new day cannot rewrite identities. */
export function buildAcquisitionSource(fixture) {
  ensure(fixture?.scope?.profile==='uk-gifts-v2'&&fixture.scope.company==='fictional-uk-gifts'&&fixture.scope.currency==='GBP'&&fixture.scope.timezone==='Europe/London'&&fixture.scope.provider===null&&fixture.scope.provenance==='synthetic-local','Isolated synthetic v2 ledger required');
  ensure(fixture.from===ACQUISITION_INCEPTION,'Full synthetic identity history from fixed inception required');
  const { fingerprint, ...body }=fixture;
  ensure(hash(body)===fingerprint,'Ledger fingerprint changed');
  ensure(generate({from:fixture.from,asOf:fixture.asOf,months:fixture.months,profile:'uk-gifts-v2'}).fingerprint===fingerprint,'Ledger does not match immutable generator');
  const sales=fixture.events.filter(e=>e.kind==='sale').sort((a,b)=>a.date.localeCompare(b.date)||a.refs.orderId.localeCompare(b.refs.orderId));
  const pool=[],observations=[],byDay=new Map();
  for(const e of sales){
    const choice=seed(['identity-state',e.refs.orderId]);
    const identityState=choice%29===0?'unknown':choice%23===0?'guest':'identified';
    let customer=null;
    if(identityState==='identified'){
      const repeat=pool.length>0&&seed(['purchase-behaviour',e.refs.orderId])%100<42;
      if(repeat)customer=pool[seed(['repeat-customer',e.refs.orderId])%pool.length];
      else{customer={customerId:`synthetic-customer:${hash(['customer',e.refs.orderId]).slice(0,24)}`,firstOrderId:stableId('order',e.refs.orderId),firstOrderDate:e.date};pool.push(customer);}
    }
    const orderId=stableId('order',e.refs.orderId),first=customer?.firstOrderId===orderId;
    const channel=e.refs.channel;
    ensure(['organic','meta','google','email'].includes(channel),'Unknown synthetic order channel');
    const observation={orderId,orderRef:e.refs.orderId,date:e.date,saleSourceId:e.id,saleSourceHash:journalHash(e),identityState,
      customerId:customer?.customerId??null,firstOrderId:customer?.firstOrderId??null,firstOrderDate:customer?.firstOrderDate??null,
      channel,paidFirst:!!first&&['meta','google'].includes(channel),netProductSales:e.metrics.productSales,weight:e.metrics.productSales+e.metrics.shipping};
    observations.push(observation);if(!byDay.has(e.date))byDay.set(e.date,[]);byDay.get(e.date).push(observation);
  }
  const refundObservations=fixture.events.filter(e=>e.kind==='refund').map(e=>({sourceId:e.id,sourceHash:journalHash(e),date:e.date,orderId:stableId('order',e.refs.orderId),netProductRefund:e.metrics.refunds}));
  const spendAllocations=[];
  for(const e of fixture.events.filter(e=>e.kind==='expense_accrual'&&e.refs.category==='marketing')){
    const amount=sum(e.postings.filter(p=>p.account==='expense:marketing').map(p=>p.amount));
    ensure(amount>=0,'Negative synthetic advertising allocation unsupported');
    const orders=(byDay.get(e.date)||[]).filter(o=>o.channel===e.refs.channel);
    const first=orders.filter(o=>o.paidFirst);
    const returning=orders.filter(o=>o.identityState==='identified'&&!o.paidFirst);
    const unknown=orders.filter(o=>o.identityState!=='identified');
    let weights=[sum(first.map(o=>o.weight)),sum(returning.map(o=>o.weight)),sum(unknown.map(o=>o.weight))];
    if(weights.every(w=>w===0))weights=[0,0,1];
    const [acquisition,retention,unallocated]=allocate(amount,weights);
    const firstAllocations=first.length?allocate(acquisition,first.map(o=>o.weight)).map((value,i)=>({orderId:first[i].orderId,customerId:first[i].customerId,amount:value})):[];
    ensure(sum(firstAllocations.map(a=>a.amount))===acquisition,'First-customer allocation does not reconcile');
    spendAllocations.push({sourceId:e.id,sourceHash:journalHash(e),date:e.date,channel:e.refs.channel,advertising:amount,acquisition,retention,unallocated,weights,firstAllocations});
  }
  const analyticsDays=[];
  for(let day=fixture.from;day<=fixture.to;day=addDays(day,1)){
    const orders=byDay.get(day)||[],groups=[];
    for(const o of orders){const last=groups.at(-1);if(last&&last.orderIds.length===1&&seed(['session-order-link',o.orderRef])%7===0)last.orderIds.push(o.orderId);else groups.push({sessionId:`synthetic-session:${hash(['session',day,o.orderId]).slice(0,24)}`,orderIds:[o.orderId]});}
    const nonPurchasingSessions=1200+seed(['session-exposure',day])%901;
    const [browseOnly,cartOnly,checkoutAbandon]=allocate(nonPurchasingSessions,[86,10,4]);
    const purchasingSessions=groups.length;
    const observation={date:day,sessions:nonPurchasingSessions+purchasingSessions,cartSessions:cartOnly+checkoutAbandon+purchasingSessions,checkoutSessions:checkoutAbandon+purchasingSessions,purchasingSessions,orders:orders.length};
    analyticsDays.push({...observation,sourceHash:hash({observation,browseOnly,cartOnly,checkoutAbandon,sessionOrderLinks:groups}),sessionOrderLinks:groups});
  }
  const source={contract:'synthetic-acquisition-source-v1',policy:ACQUISITION_POLICY,profile:'uk-gifts-v2',storeId:RESERVED_SYNTHETIC_IDENTITY.storeId,currency:'GBP',timezone:'Europe/London',from:fixture.from,through:fixture.to,
    orderObservations:observations,refundObservations,spendAllocations,analyticsDays,analyticsHash:hash(analyticsDays),ordersHash:hash(observations),refundsHash:hash(refundObservations),allocationHash:hash(spendAllocations)};
  return {...source,sourceHash:hash(source)};
}

export function summarizeAcquisitionSource(source,{from,to,financial}={}){
  date(from);date(to);ensure(from<=to&&source.from===ACQUISITION_INCEPTION&&from>=source.from&&to<=source.through,'Covered acquisition period required');
  ensure(source.contract==='synthetic-acquisition-source-v1'&&source.policy===ACQUISITION_POLICY&&hash(payloadBody(source))===source.sourceHash&&hash(source.orderObservations)===source.ordersHash&&hash(source.analyticsDays)===source.analyticsHash&&hash(source.refundObservations)===source.refundsHash&&hash(source.spendAllocations)===source.allocationHash,'Acquisition source integrity failed');
  ensure(financial?.state==='supported'&&financial.scope?.storeId===source.storeId&&financial.scope.currency===source.currency&&financial.scope.from===from&&financial.scope.to===to,'Exact reviewed financial scope required');
  const orders=source.orderObservations.filter(o=>o.date>=from&&o.date<=to),allocations=source.spendAllocations.filter(a=>a.date>=from&&a.date<=to);
  const coverage={originalOrders:orders.length,identifiedFirstOrders:orders.filter(o=>o.identityState==='identified'&&o.firstOrderId===o.orderId).length,identifiedRepeatOrders:orders.filter(o=>o.identityState==='identified'&&o.firstOrderId!==o.orderId).length,guestOrders:orders.filter(o=>o.identityState==='guest').length,unknownOrders:orders.filter(o=>o.identityState==='unknown').length,paidFirstCustomers:orders.filter(o=>o.paidFirst).length};
  const identifiedOrders=orders.filter(o=>o.identityState==='identified');
  const identifiedCustomers=new Set(identifiedOrders.map(o=>o.customerId));
  const returningCustomers=new Set(identifiedOrders.filter(o=>o.firstOrderId!==o.orderId).map(o=>o.customerId));
  const customerActivity={contract:'synthetic-customer-activity-v1',policy:ACQUISITION_POLICY,scope:{from,to},
    identifiedCustomers:identifiedCustomers.size,uniqueReturningCustomers:returningCustomers.size,identifiedOrders:identifiedOrders.length,
    sourceHash:source.ordersHash,basis:'Distinct synthetic customer identifiers with at least one identified order in this selected month; guests and unknown identities are excluded. This is a fictional source rehearsal, not merchant customer evidence.'};
  const spend=Object.fromEntries(['advertising','acquisition','retention','unallocated'].map(k=>[k,sum(allocations.map(a=>a[k]))]));
  const segment=o=>!o||o.identityState==='unknown'?'unknown':o.identityState==='guest'?'guest':o.firstOrderId===o.orderId?'identifiedFirst':'identifiedRepeat';
  const byOrder=new Map(source.orderObservations.map(o=>[o.orderId,o]));
  const revenue={netProductSales:0,identifiedFirst:0,identifiedRepeat:0,guest:0,unknown:0};
  for(const o of orders)revenue[segment(o)]+=o.netProductSales;
  for(const r of source.refundObservations.filter(r=>r.date>=from&&r.date<=to))revenue[segment(byOrder.get(r.orderId))]-=r.netProductRefund;
  revenue.netProductSales=sum([revenue.identifiedFirst,revenue.identifiedRepeat,revenue.guest,revenue.unknown]);
  ensure(Object.values(revenue).every(Number.isSafeInteger)&&revenue.netProductSales===financial.sales?.netProductSales,'Identity revenue does not reconcile to reviewed net product sales');
  ensure(coverage.originalOrders===financial.sales?.originalOrders&&spend.advertising===financial.components?.advertising,'Acquisition/financial counts or advertising do not reconcile');
  const analyticsDaily=source.analyticsDays.filter(d=>d.date>=from&&d.date<=to).map(({sessionOrderLinks,...daily})=>daily);
  const analytics={contract:'synthetic-funnel-v1',policy:'synthetic-session-events-v1',coverage:{from,to,complete:true},daily:analyticsDaily,totals:Object.fromEntries(['sessions','cartSessions','checkoutSessions','purchasingSessions','orders'].map(k=>[k,sum(analyticsDaily.map(d=>d[k]))])),sourceHash:source.analyticsHash};
  return {contract:'synthetic-acquisition-v1',state:'supported',profile:'uk-gifts-v2',policy:ACQUISITION_POLICY,
    scope:{storeId:source.storeId,currency:'GBP',timezone:'Europe/London',from,to},
    financial:{snapshotId:financial.versionId,edition:financial.metadata.edition,anchor:financial.metadata.anchor,salesRevision:financial.salesRevision,costRevision:financial.costRevision,formulaVersion:financial.metadata.formulaVersion},
    source:{from:source.from,through:source.through,sourceHash:source.sourceHash,ordersHash:source.ordersHash,refundsHash:source.refundsHash,allocationHash:source.allocationHash,synthetic:true},coverage,customerActivity,spend,revenue,analytics,
    metrics:{cac:null,firstOrderContribution:null,maturePaybackDays:null},
    limitations:['Synthetic identity and advertising allocation policy; not Shopify, Xero or platform attribution.','Guest and unknown orders are not matched or classified as first-time/repeat.','Paid first-customer CAC excludes organic/email first customers from its denominator.','First-order contribution and mature payback need a separately reviewed matched cost/cohort model.']};
}
