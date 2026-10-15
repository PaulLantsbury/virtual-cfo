import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { PreviewModel } from '@/lib/newProfitPreview';
import { createSamplePlan, localDate, readSamplePlan, removeSamplePlan, samplePlanKey, writeSamplePlan, type PlanAction, type SamplePlan } from '@/lib/newProfitSavedPlan';
export function NewProfitSavedPlan({ availableActions, model, preferredActionId }: { availableActions: PlanAction[]; model: PreviewModel; preferredActionId?: PlanAction['id'] }) {
 const auth=useAuth();
 const scope=auth.status==='ready'&&auth.userId&&auth.storeId?samplePlanKey(auth.userId,auth.storeId):null;
 // A keyed child discards drafts and loaded records synchronously on store/user changes.
 return scope?<ScopedPlan key={scope} scope={scope} availableActions={availableActions} model={model} preferredActionId={preferredActionId}/>:null;
}
function ScopedPlan({scope,availableActions,model,preferredActionId}:{scope:string;availableActions:PlanAction[];model:PreviewModel;preferredActionId?:PlanAction['id']}){
 const [saved,setSaved]=useState<SamplePlan|null>(null),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const [actionId,setActionId]=useState(availableActions[0]?.id??'discount'),[owner,setOwner]=useState('Me'),[reviewDate,setReviewDate]=useState('');
 useEffect(()=>{try{setSaved(readSamplePlan(window.localStorage,scope));}catch{setError('Saved sample plan could not be read. Clear it to start again.');}finally{setLoaded(true);}},[scope]);
 useEffect(()=>{if(preferredActionId)setActionId(preferredActionId);},[preferredActionId]);
 const save=()=>{try{const action=availableActions.find(a=>a.id===actionId);if(!action)throw new Error('Choose an action');const plan=createSamplePlan(action,owner,reviewDate,model);writeSamplePlan(window.localStorage,scope,plan);setSaved(plan);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not save the sample plan on this browser');}};
 const clear=()=>{try{removeSamplePlan(window.localStorage,scope);setSaved(null);setError('');}catch{setError('Could not clear the sample plan on this browser');}};
 const toggle=()=>{if(!saved)return;try{const next:SamplePlan={...saved,status:saved.status==='planned'?'done':'planned'};writeSamplePlan(window.localStorage,scope,next);setSaved(next);setError('');}catch{setError('Could not update the sample plan on this browser');}};
 const money=(pence:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(pence/100);
 const advanced=!!saved&&model.to>saved.baseline.to;
 const comparable=!!saved&&model.current.orders>0&&Number.isFinite(model.current[saved.baseline.metricKey]);
 return <div id="np-saved-plan" className="np-saved-plan">
  <h3 className="font-semibold">Keep an action for your next review</h3>
  <p className="np-saved-plan-note">Saved on this browser · sample plan. This does not create reminders or sync to other devices. Save one priority to practise the review process.</p>
  {!loaded?<p>Loading saved sample plan…</p>:saved?<>
   <p className="font-semibold">{saved.action.title} · {saved.status==='done'?'Marked done':'Planned'}</p>
   <p className="text-sm">Owner: {saved.owner} · Review: {saved.reviewDate}{saved.status==='planned'&&saved.reviewDate<=localDate()?' · Review due':''}</p>
   <p className="text-sm">Frozen sample baseline: {money(saved.baseline.perOrderPence)} per order, {saved.baseline.from} to {saved.baseline.to} ({saved.baseline.orders.toLocaleString('en-GB')} orders).</p>
   {!advanced?<p className="text-sm font-medium">Sample data has not advanced. There is no new outcome to assess.</p>:comparable?<p className="text-sm">Selected sample observation: {money(Math.round(model.current[saved.baseline.metricKey]/model.current.orders))} per order, {model.from} to {model.to}. Different sample periods do not prove an effect from your action.</p>:<p className="text-sm">A comparable sample observation is unavailable.</p>}
   <div className="flex flex-wrap gap-3"><button type="button" className="np-saved-plan-button" onClick={toggle}>{saved.status==='done'?'Reopen sample action':'Mark sample action done'}</button><button type="button" className="np-saved-plan-button" onClick={clear}>Clear saved sample plan</button></div>
  </>:<div className="flex flex-wrap items-end gap-3">
   <label className="text-sm">Priority<select className="np-saved-plan-input" value={actionId} onChange={e=>setActionId(e.target.value as PlanAction['id'])}>{availableActions.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
   <label className="text-sm">Owner<input className="np-saved-plan-input" value={owner} maxLength={80} onChange={e=>setOwner(e.target.value)}/></label>
   <label className="text-sm">Review date<input className="np-saved-plan-input" type="date" value={reviewDate} min={localDate(new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+1))} onChange={e=>setReviewDate(e.target.value)}/></label>
   <button type="button" className="np-saved-plan-button np-saved-plan-primary" onClick={save}>Save sample action</button>
  </div>}
  {error&&<div role="alert"><p className="np-saved-plan-error">{error}</p><button type="button" className="underline text-sm" onClick={clear}>Clear unreadable saved plan</button></div>}
 </div>;
}
