/** Offline design rehearsal only. Not used by canonical readers or coverage triggers. */
import {createHash} from 'node:crypto';import {date} from './generator.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function scopedHistoryProposal(fixture,{company,currency,from,to,coverageVersion,reviewed=false}={}){
 date(from);date(to);const end=new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),0)).toISOString().slice(0,10);
 if(!reviewed||!coverageVersion||company!==fixture.scope.company||currency!==fixture.scope.currency||from.slice(8)!=='01'||to!==end||from<fixture.from||to>fixture.to)throw Error('Reviewed complete scoped history required');
 const seen=new Set();for(const e of fixture.events){if(e.company!==company||e.currency!==currency||seen.has(e.id))throw Error('Mixed or duplicate source');seen.add(e.id);}
 const inPeriod=e=>e.date>=from&&e.date<=to;
 const sales=fixture.events.filter(e=>e.kind==='sale'),refunds=fixture.events.filter(e=>e.kind==='refund');
 const selectedSales=sales.filter(inPeriod),selectedRefunds=refunds.filter(inPeriod);
 const relevantOrderIds=new Set([...selectedSales.map(e=>e.refs.orderId),...selectedRefunds.map(e=>e.refs.orderId)]);
 const originals=sales.filter(e=>relevantOrderIds.has(e.refs.orderId));
 if(selectedRefunds.some(e=>!originals.some(o=>o.refs.orderId===e.refs.orderId)))throw Error('Retained original evidence required');
 // Include prior refund history for relevant originals: aggregate refund/cost caps cannot reset at a month boundary.
 const refundHistory=refunds.filter(e=>relevantOrderIds.has(e.refs.orderId)&&e.date<=to);
 const costSources=fixture.events.filter(e=>inPeriod(e)&&e.postings.some(p=>p.account.startsWith('expense:')));
 const dependencies=[...new Map([...originals,...refundHistory,...costSources].map(e=>[e.id,e])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 const manifest={contract:'scoped-history-design-v1',scope:{company,currency,from,to,timezone:fixture.scope.timezone,profile:fixture.scope.profile},coverageVersion,dependencies};
 return {status:'offline-proposal-only',revision:hash(manifest),dependencyIds:dependencies.map(e=>e.id),manifest,limitations:['Requires a new reviewed adapter and period-specific coverage/invalidation contract.','Existing store-wide canonical revisions and triggers remain authoritative.','No financial definitions, immutable seals, SQL, provider or scheduling behaviour changed.']};
}
