import {useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AppLayout} from '@/components/layout/AppLayout';
import {useActiveStore} from '@/lib/auth/AuthProvider';
import {supabase} from '@/lib/supabase';
import {Button} from '@/components/ui/button';
type Scope={storeId:string;from:string;to:string};
type Packet={status:'blocked'|'awaiting_independent_coverage_review';batchId:string;snapshotDigest:string;scope:Scope;issues:{reason:string}[]};
const same=(a:Scope,b:Scope)=>a?.storeId===b.storeId&&a?.from===b.from&&a?.to===b.to;
export default function FinancialReviewPage(){
 const storeId=useActiveStore(),cache=useQueryClient();
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[packet,setPacket]=useState<Packet|null>(null);
 const [evidence,setEvidence]=useState(''),[statement,setStatement]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('Choose the period you want to review.');
 const pending=useRef<AbortController|null>(null),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;pending.current?.abort();},[]);
 const clear=()=>{generation.current++;pending.current?.abort();setPacket(null);setEvidence('');setStatement('');setConfirmed(false);setBusy(false);setMessage('Prepare a new review for this period.');};
 const perform=async(action:'prepare'|'restore')=>{
  const current=++generation.current,controller=new AbortController();pending.current=controller;setBusy(true);
  const scope={storeId,from,to};
  const timer=setTimeout(()=>controller.abort(),40000);
  try{
   const {data,error}=await supabase.auth.getSession();
   if(error||!data.session?.access_token)throw new Error('Please sign in again before reviewing.');
   if(current!==generation.current)return;
   const body=action==='prepare'?{scope}:{scope,batchId:packet?.batchId,snapshotDigest:packet?.snapshotDigest,coverageConfirmed:confirmed,evidenceRef:evidence,completenessStatement:statement};
   const response=await fetch('/api/financial-reviews/'+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(body),signal:controller.signal});
   if(current!==generation.current)return;
   if(!response.ok){
    if(response.status===401)throw new Error('Please sign in again before reviewing.');
    if(response.status===403)throw new Error('You do not have permission to review this store. Ask your administrator.');
    if(response.status===409)throw new Error('The evidence has changed or needs attention. Prepare a new review.');
    throw new Error(action==='restore'?'Restoration could not be confirmed. Check the period’s status before trying again.':'The review service is unavailable. No financial records have been changed.');
   }
   const result=await response.json();
   if(current!==generation.current)return;
   if(action==='prepare'){
    if(!same(result.scope,scope)||!['blocked','awaiting_independent_coverage_review'].includes(result.status)||typeof result.batchId!=='string'||!/^[a-f0-9]{64}$/.test(result.snapshotDigest)||!Array.isArray(result.issues))throw new Error('The review response could not be verified. Please try again.');
    setPacket(result);setConfirmed(false);setEvidence('');setStatement('');
    setMessage(result.status==='blocked'?'The financial evidence does not yet reconcile. Resolve the differences before preparing another review.':'Transaction checks passed. Complete the independent history review below before restoring figures.');
   }else{
    if(result.status!=='restored'||!same(result.scope,scope))throw new Error('Restoration could not be confirmed. Check the period’s status before trying again.');
    setPacket(null);setConfirmed(false);setMessage('Reviewed figures have been restored for this period. Your review has been recorded.');void cache.invalidateQueries();
   }
  }catch(error){
   if(current!==generation.current)return;
   setPacket(null);setConfirmed(false);
   setMessage(controller.signal.aborted?(action==='restore'?'The request timed out. Restoration may have completed; check the period’s status before trying again.':'The review request timed out. Please try again.'):(error instanceof TypeError||error instanceof SyntaxError?(action==='restore'?'Restoration could not be confirmed. Check the period’s status before trying again.':'The review service is unavailable. Please try again later.'):error instanceof Error?error.message:'The review could not be completed.'));
  }finally{clearTimeout(timer);if(current===generation.current)setBusy(false);}
 };
 const ready=packet?.status==='awaiting_independent_coverage_review'&&same(packet.scope,{storeId,from,to});
 return <AppLayout showMonitoring={false}>
  <div className="max-w-2xl space-y-6">
   <h1 className="text-3xl font-bold">Review financial evidence</h1>
   <p className="text-muted-foreground">For authorised reviewers. Check the imported transactions and complete an independent review of the store’s order and refund history before restoring verified figures.</p>
   <div className="flex flex-wrap gap-4">
    <label className="space-y-2">From<input className="block rounded border p-2 bg-background" type="date" value={from} onChange={e=>{clear();setFrom(e.target.value);}}/></label>
    <label className="space-y-2">To<input className="block rounded border p-2 bg-background" type="date" value={to} onChange={e=>{clear();setTo(e.target.value);}}/></label>
   </div>
   <Button disabled={busy||!from||!to||from>to} onClick={()=>void perform('prepare')}>{busy?'Checking…':'Prepare review'}</Button>
   <p role="status" aria-live="polite" className="rounded-lg border p-4">{message}</p>
   {packet?.status==='blocked'&&<p>{packet.issues.length} evidence check{packet.issues.length===1?' requires':'s require'} attention. Figures remain unverified.</p>}
   {ready&&<section className="space-y-4 rounded-lg border p-5">
    <h2 className="text-xl font-semibold">Confirm complete history</h2>
    <p>A matching import alone does not establish completeness. Check missing history, excluded orders, refunds and any collection limitations against your retained evidence.</p>
    <label className="block">Evidence reference<input className="mt-2 block w-full rounded border p-2 bg-background" maxLength={2000} value={evidence} disabled={busy} onChange={e=>setEvidence(e.target.value)}/></label>
    <label className="block">What did you check?<textarea className="mt-2 block w-full rounded border p-2 bg-background" rows={4} maxLength={10000} value={statement} disabled={busy} onChange={e=>setStatement(e.target.value)}/></label>
    <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>I independently checked that the order and refund history is complete for this period.</label>
    <Button disabled={busy||!confirmed||!evidence.trim()||!statement.trim()} onClick={()=>void perform('restore')}>Record review and restore figures</Button>
   </section>}
  </div>
 </AppLayout>;
}
