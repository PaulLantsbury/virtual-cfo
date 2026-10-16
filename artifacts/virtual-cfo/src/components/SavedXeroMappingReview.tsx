import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchSavedXeroMapping} from '@/lib/xeroSavedMappingApi';
import type {SavedXeroCategory} from '../../../../experiments/xero/saved-mapping-view.mjs';
const labels:Record<SavedXeroCategory,string>={revenue:'Booked revenue',processingFee:'Processing fees',advertising:'Advertising',software:'Software',includedCash:'Included cash accounts'};
/** Lazy metadata-only review: never starts consent, saves mapping or reads amounts. */
export function SavedXeroMappingReview({storeId}:{storeId:string}){
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>setExpanded(false),[storeId]);
 const query=useQuery({queryKey:['xero-saved-mapping',storeId],enabled:expanded&&!!storeId,queryFn:({signal})=>fetchSavedXeroMapping(storeId,signal),retry:false,refetchOnWindowFocus:false,placeholderData:undefined});
 const mapping=expanded&&query.data?.storeId===storeId?query.data.mapping:null;
 return <div className="mt-4 space-y-3">
  <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)} className="text-sm font-medium text-primary underline underline-offset-4">{expanded?'Hide saved account mapping':'Review saved account mapping'}</button>
  {expanded&&<section aria-label="Saved Xero account mapping" className="rounded-md border bg-background p-4">
   <h4 className="font-medium">Saved account mapping</h4>
   <p className="mt-1 text-sm text-muted-foreground">This review shows the saved classification for the selected store. It does not edit accounts, change the mapping or reconnect Xero.</p>
   {query.isPending&&<p role="status" className="mt-3 text-sm">Loading the saved account mapping…</p>}
   {query.isError&&<div className="mt-3 space-y-2"><p role="status" className="text-sm">The saved mapping could not be loaded for this store. Your connection has not been changed.</p><button type="button" className="text-sm underline underline-offset-4" onClick={()=>query.refetch()}>Try loading the mapping again</button></div>}
   {query.isSuccess&&!mapping&&<p role="status" className="mt-3 text-sm">No saved mapping is available for this store.</p>}
   {mapping&&<div className="mt-3 space-y-3">
    <p className="text-sm">Version {mapping.version} · Effective from {mapping.effectiveFrom}</p>
    <p className="text-xs text-muted-foreground">Confirmed {mapping.confirmedAt}. Account details reflect the saved directory from {mapping.directoryRetrievedAt}.</p>
    {mapping.reviewRequired&&<p role="status" className="rounded-md border border-amber-500/30 p-3 text-sm">This mapping needs review. Saved selections below do not establish current accounting readiness.</p>}
    <dl className="space-y-3">{mapping.categories.map(category=><div key={category.category}><dt className="text-sm font-medium">{labels[category.category]}</dt><dd className="mt-1 text-sm text-muted-foreground">{category.accounts.length?<ul className="space-y-1">{category.accounts.map(account=><li key={account.accountId}>{account.name??'Account details unavailable'}{account.type&&<span className="ml-2 text-xs">{account.type} · {account.status}</span>}</li>)}</ul>:'No saved account selection'}</dd></div>)}</dl>
    <p className="text-xs text-muted-foreground">Cash account selection does not confirm restrictions, settlement or dated available cash. The fuller P&L mapping and editing workflow is still being prepared.</p>
   </div>}
  </section>}
 </div>;
}
