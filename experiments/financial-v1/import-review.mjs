import {createHash} from 'node:crypto';
import {calculateMappedSales} from './cloud-sales-adapter.mjs';
import {eventDay} from './event-evidence.mjs';

const requireValue=(ok,message)=>{if(!ok)throw new Error(message);};
const text=value=>typeof value==='string'&&value.trim().length>0;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const date=value=>requireValue(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,'Invalid coverage date');

/** Dry-run only. Input is a source-adapter envelope, NOT a Shopify API payload.
 * A consistent manifest is not independent proof of source completeness.
 * Never returns a persistable coverage certificate or writes any data.
 */
export function reviewImportBatch(batch,{now=new Date(),previousFingerprint=null}={}) {
  const blocked=message=>({status:'blocked',issues:[message],coverageCertified:false,candidate:null});
  try {
    requireValue(batch&&batch.version===1,'Unsupported import envelope');
    const {scope,manifest,orders,refunds}=batch;
    requireValue(scope&&text(scope.storeId)&&text(scope.timezone),'Store scope required');
    date(scope.from);date(scope.to);requireValue(scope.from<=scope.to,'Invalid coverage range');
    requireValue(Intl.supportedValuesOf('currency').includes(scope.currency),'Unsupported currency');
    const precision=new Intl.NumberFormat('en-GB',{style:'currency',currency:scope.currency}).resolvedOptions();
    requireValue(precision.maximumFractionDigits===2,'Unsupported currency precision');
    const today=eventDay(now.toISOString(),scope.timezone);
    requireValue(scope.to<today,'Reporting period has not completed in store timezone');
    requireValue(manifest&&text(manifest.sourceRef)&&text(manifest.snapshotRef),'Source snapshot reference required');
    requireValue(manifest.storeId===scope.storeId&&manifest.currency===scope.currency&&manifest.timezone===scope.timezone,'Source settings differ from reporting settings');
    requireValue(manifest.from===scope.from&&manifest.to===scope.to,'Source coverage does not match reporting period');
    const capturedDay=eventDay(manifest.capturedAt,scope.timezone);
    requireValue(capturedDay>scope.to&&Date.parse(manifest.capturedAt)<=now.getTime(),'Source snapshot does not cover completed period');
    requireValue(manifest.originalOrdersAndLifetimeRefunds===true,'Original orders and lifetime refund history require evidence');
    requireValue(Array.isArray(orders)&&Array.isArray(refunds),'Mapped records required');
    for(const [name,rows] of [['orders',orders],['refunds',refunds]]) {
      requireValue(rows.every(r=>r&&text(r.id)&&r.store_id===scope.storeId),'Missing ID or mixed-store records');
      requireValue(new Set(rows.map(r=>r.id)).size===rows.length,'Duplicate records require reconciliation');
      const pages=manifest.pages?.[name];
      requireValue(Array.isArray(pages)&&pages.length>0,'Missing source page manifest');
      let cursor=null;
      const seen=new Set(),ids=[];
      for(let i=0;i<pages.length;i++) {
        const page=pages[i];
        requireValue(page&&page.cursor===cursor&&Array.isArray(page.ids),'Broken pagination chain');
        requireValue(page.snapshotRef===manifest.snapshotRef,'Mixed source snapshots');
        requireValue(page.ids.every(text),'Invalid source record IDs');
        requireValue(page.nextCursor===null||text(page.nextCursor),'Missing pagination completion marker');
        requireValue(i===pages.length-1?page.nextCursor===null:page.nextCursor!==null,'Incomplete or premature pagination end');
        requireValue(!seen.has(page.cursor),'Repeated pagination cursor');seen.add(page.cursor);
        ids.push(...page.ids);cursor=page.nextCursor;
      }
      requireValue(new Set(ids).size===ids.length,'Duplicate source page records');
      requireValue(JSON.stringify([...ids].sort())===JSON.stringify(rows.map(r=>r.id).sort()),'Source record manifest does not reconcile');
      for(const row of rows) {
        requireValue(row.mapping_state==='verified'&&text(row.evidence_ref),'Missing or stale mapped evidence');
        requireValue(row.settings?.currency===scope.currency&&row.settings?.timezone===scope.timezone,'Mapped evidence settings require re-verification');
        date(row.day);
      }
    }
    // This temporary coverage assertion permits candidate arithmetic only; it
    // never enters storage or an application response claiming completeness.
    const candidate=calculateMappedSales({orders,refunds,coverage:[{store_id:scope.storeId,currency:scope.currency,sales_and_refunds_complete:true,evidence_ref:manifest.sourceRef}]},scope);
    const fingerprint=hash({...batch,orders:[...orders].sort((a,b)=>a.id.localeCompare(b.id)),refunds:[...refunds].sort((a,b)=>a.id.localeCompare(b.id))});
    return {status:'ready_for_source_review',coverageCertified:false,issues:[],fingerprint,
      replay:previousFingerprint===fingerprint,changedSincePrevious:previousFingerprint!==null&&previousFingerprint!==fingerprint,
      counts:{orders:orders.length,refunds:refunds.length},candidate};
  } catch(error) {return blocked(error instanceof Error?error.message:'Import review failed');}
}
