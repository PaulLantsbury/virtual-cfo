import {isDeepStrictEqual} from 'node:util';
import {mapShopifySales} from './map-sales.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const key=e=>`${e.type}:${e.id}`;
function mapped(source,scope){
 check(source?.scope?.storeId===scope.storeId&&source.scope.shopId===scope.shopId,'Source identity does not match scope');
 const result=mapShopifySales({...source,status:'details_for_mapping'},scope);
 check(result.status==='mapped_for_review'&&result.excluded.length===0,'Source requires review before import');
 const ids=result.events.map(key);
 check(new Set(ids).size===ids.length,'Duplicate financial event identity');
 return result.events;
}
/** Pure preparation only: retained source must include every previously imported
 * event. Does not query the database, authorize writes or certify completeness.
 * priorSources must be supplied by a trusted reader of committed import receipts.
 */
export function planSubsequentImport({priorSources,source,scope}){
 try{
  check(Array.isArray(priorSources)&&priorSources.length>0,'Committed import history required');
  check(scope&&typeof scope.storeId==='string'&&typeof scope.shopId==='string','Import scope required');
  const previous=new Map();
  for(const prior of priorSources){
   check(isDeepStrictEqual(prior.settings,source.settings),'Store settings changed; review required');
   for(const event of mapped(prior,scope)){
    const old=previous.get(key(event));
    check(!old||isDeepStrictEqual(old,event),'Committed source history conflicts; review required');
    previous.set(key(event),event);
   }
  }
  const next=mapped(source,scope),incoming=new Map(next.map(e=>[key(e),e]));
  for(const[id,old]of previous){
   check(incoming.has(id),'Previously imported event missing; review required');
   check(isDeepStrictEqual(old,incoming.get(id)),'Previously imported event changed; review required');
  }
  const additions=next.filter(e=>!previous.has(key(e)));
  const sales=new Map(next.filter(e=>e.type==='sale').map(e=>[e.orderId,e]));
  check(additions.every(e=>e.type!=='refund'||sales.has(e.orderId)),'Refund original sale missing');
  return {status:'planned_awaiting_database_checks',coverageCertified:false,
   additions,unchangedEvents:previous.size,newOrders:additions.filter(e=>e.type==='sale').length,
   newRefunds:additions.filter(e=>e.type==='refund').length,
   affectedEventDates:[...new Set(additions.map(e=>e.date))].sort()};
 }catch(error){return {status:'blocked',coverageCertified:false,additions:[],issues:[error.message]};}
}
