/** Offline rehearsal only: no authentication, SQL, coverage certification or sealed evidence. */
import {createHash} from 'node:crypto';
import {calculateMappedSales} from '../financial-v1/cloud-sales-adapter.mjs';
import {profitBridge} from '../financial-v1/calculations.mjs';
import {date} from './generator.mjs';
const money=p=>(p/100).toFixed(2);
export function rehearseCanonicalMonth(fixture,{company,currency,from,to,complete=false}) {
 date(from);date(to);
 const last=new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),0)).toISOString().slice(0,10);
 if(from.slice(8)!=='01'||to!==last||from<fixture.from||to>fixture.to)throw Error('Complete covered calendar month required');
 if(company!==fixture.scope.company||currency!==fixture.scope.currency)throw Error('Scope mismatch');
 if(complete!==true)throw Error('Explicit local completeness review required');
 if(fixture.scope.provenance!=='synthetic-local'||fixture.scope.provider!==null)throw Error('Synthetic scope required');
 const ids=new Set();
 for(const e of fixture.events){if(e.company!==company||e.currency!==currency||e.provider!==null||e.provenance!=='synthetic-local')throw Error('Event scope mismatch');if(ids.has(e.id))throw Error('Duplicate event');ids.add(e.id);if(e.postings.some(p=>!Number.isSafeInteger(p.amount))||e.postings.reduce((s,p)=>s+p.amount,0)!==0)throw Error('Invalid journal');}
 const scope={storeId:company,currency,from,to};
 const sales=fixture.events.filter(e=>e.kind==='sale');
 const byOrder=new Map(sales.map(e=>[e.refs.orderId,e]));
 const selected=fixture.events.filter(e=>e.date>=from&&e.date<=to);
 const refunds=selected.filter(e=>e.kind==='refund');
 if(refunds.some(e=>!byOrder.has(e.refs.orderId)))throw Error('Original order outside retained ledger: opening-cohort evidence required');
 const orders=sales.map(e=>({store_id:company,currency,id:e.refs.orderId,day:e.date,mapping_state:'verified',original_eligible:true,tax_basis:'exclusive',gross:money(e.metrics.gross),discount:money(e.metrics.discounts),gross_vat:money(Math.round(e.metrics.gross/5)),discount_vat:money(Math.round(e.metrics.gross/5)-e.metrics.productVat),shipping:money(e.metrics.shipping),shipping_vat:money(e.metrics.shippingVat)}));
 const mappedRefunds=refunds.map(e=>({store_id:company,currency,id:e.id,order_id:e.refs.orderId,day:e.date,mapping_state:'verified',product_cash:money(e.metrics.refunds+e.metrics.refundedVat),product_vat:money(e.metrics.refundedVat),shipping_cash:'0.00',shipping_vat:'0.00',amount:money(e.metrics.refunds+e.metrics.refundedVat)}));
 const result=calculateMappedSales({orders,refunds:mappedRefunds,coverage:[{store_id:company,currency,date_from:from,date_to:to,sales_and_refunds_complete:true,evidence_ref:'offline explicit review only'}]},scope);
 let cogs=0,variableCosts=0,advertising=0,overheadIncludingDA=0,depreciationAmortisation=0;
 const variable=new Set(['storage','returns','pickPack','carrier','packaging','processor']);
 for(const e of selected)for(const p of e.postings){if(p.account==='cogs')cogs+=p.amount;if(p.account.startsWith('expense:')){const category=p.account.slice(8);if(variable.has(category))variableCosts+=p.amount;else if(category==='marketing')advertising+=p.amount;else overheadIncludingDA+=p.amount;if(category==='depreciation')depreciationAmortisation+=p.amount;}}
 const profit=profitBridge({...result,cogs,variableCosts,advertising,overheadIncludingDA,depreciationAmortisation});
 return {status:'offline-rehearsal-only',scope,sales:result,profit,sourceRevision:createHash('sha256').update(JSON.stringify(fixture.events)).digest('hex'),limitations:['Local review flag is not database coverage evidence or a completeness seal.','No authentication, membership/RLS, SQL reader, v11 source adapter or staging acceptance.','Opening-cohort months require retained original-order evidence.']};
}
