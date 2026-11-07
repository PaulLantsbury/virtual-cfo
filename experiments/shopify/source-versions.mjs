import {createHash} from 'node:crypto';
import {eventDay} from '../financial-v1/event-evidence.mjs';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const check=(ok,message)=>{if(!ok)throw new Error(message);};
function version(value){eventDay(value,'UTC');return new Date(value).toISOString();}
export function sourceVersions(orders){
 const rows=[];const seen=new Set();
 for(const order of orders){
  check(order?.id&&!seen.has(order.id),'Duplicate source identity');seen.add(order.id);
  check(Array.isArray(order.refunds),'Missing refund history');
  // Each refund has its own version, independent of the order timestamp.
  rows.push({id:order.id,version:version(order.updatedAt),fingerprint:hash({...order,refunds:undefined})});
  for(const refund of order.refunds){check(refund?.id&&!seen.has(refund.id),'Duplicate source identity');seen.add(refund.id);rows.push({id:refund.id,version:version(refund.updatedAt),fingerprint:hash({...refund,orderId:order.id})});}
 }
 return rows;
}
/** Classifies source metadata, not transactional source completeness. */
export function compareSourceVersions(previous,next){
 const incoming=new Map(next.map(r=>[r.id,r]));
 let changed=next.length!==previous.length;
 for(const row of previous){
  const current=incoming.get(row.source_id);
  if(!current)return {status:'missing_source',changed:false};
  const oldTime=new Date(row.source_version).getTime(),newTime=Date.parse(current.version);
  if(newTime<oldTime)return {status:'stale_source',changed:false};
  if(newTime===oldTime&&current.fingerprint!==row.fingerprint)return {status:'conflicting_source',changed:false};
  if(newTime>oldTime||current.fingerprint!==row.fingerprint)changed=true;
 }
 return {status:'accepted',changed};
}
