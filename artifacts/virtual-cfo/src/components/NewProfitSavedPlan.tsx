import { useEffect, useState } from 'react';
import { ReviewPlanPanel } from './ReviewPlanPanel';
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
 const observation=!advanced?'Sample data has not advanced. There is no new outcome to assess.':comparable?`Selected sample observation: ${money(Math.round(model.current[saved!.baseline.metricKey]/model.current.orders))} per order, ${model.from} to ${model.to}. Different sample periods do not prove an effect from your action.`:'A comparable sample observation is unavailable.';
 return <ReviewPlanPanel id="np-saved-plan" loading={!loaded} saved={saved?{
  title:saved.action.title,status:saved.status,owner:saved.owner,reviewDate:saved.reviewDate,reviewDue:saved.reviewDate<=localDate(),
  baseline:`Frozen sample baseline: ${money(saved.baseline.perOrderPence)} per order, ${saved.baseline.from} to ${saved.baseline.to} (${saved.baseline.orders.toLocaleString('en-GB')} orders).`,observation,
 }:null} actions={availableActions} actionId={actionId} onActionChange={id=>setActionId(id as PlanAction['id'])} owner={owner} onOwnerChange={setOwner} reviewDate={reviewDate} onReviewDateChange={setReviewDate} onSave={save} onToggle={toggle} onClear={clear} error={error} minDate={localDate(new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+1))}/>;
}
