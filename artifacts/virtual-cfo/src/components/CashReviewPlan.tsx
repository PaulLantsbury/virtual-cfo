import {useEffect,useState} from 'react';
import {useAuth} from '@/lib/auth/AuthProvider';
import {ReviewPlanPanel} from './ReviewPlanPanel';
import {localDate} from '@/lib/newProfitSavedPlan';
import {cashReviewPlanKey,createCashReviewPlan,readCashReviewPlan,writeCashReviewPlan,clearCashReviewPlan,CASH_REVIEW_ACTIONS,describeCashReviewChange,type CashReviewActionId,type CashModel,type CashReviewPlanRecord} from '@/lib/cashReviewPlan';
export function CashReviewPlan({model,preferredActionId}:{model:CashModel;preferredActionId?:CashReviewActionId}){
 const auth=useAuth();const scope=auth.status==='ready'&&auth.userId&&auth.storeId?cashReviewPlanKey(auth.userId,auth.storeId):null;
 return scope?<ScopedCashReviewPlan key={scope} scope={scope} model={model} preferredActionId={preferredActionId}/>:null;
}
function ScopedCashReviewPlan({scope,model,preferredActionId}:{scope:string;model:CashModel;preferredActionId?:CashReviewActionId}){
 const [saved,setSaved]=useState<CashReviewPlanRecord|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 const [actionId,setActionId]=useState<CashReviewActionId>('check-commitments'),[owner,setOwner]=useState('Me'),[reviewDate,setReviewDate]=useState('');
 useEffect(()=>{try{setSaved(readCashReviewPlan(window.localStorage,scope));}catch{setError('Saved cash plan uses an older or unreadable format. Clear it to start a new review.');}finally{setLoaded(true);}},[scope]);
 useEffect(()=>{if(preferredActionId)setActionId(preferredActionId);},[preferredActionId]);
 const save=()=>{try{const next=createCashReviewPlan(actionId,owner,reviewDate,model);writeCashReviewPlan(window.localStorage,scope,next);setSaved(next);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not save this sample cash plan');}};
 const clear=()=>{try{clearCashReviewPlan(window.localStorage,scope);setSaved(null);setError('');}catch{setError('Could not clear the sample cash plan on this browser');}};
 const toggle=()=>{if(!saved)return;try{const next:CashReviewPlanRecord={...saved,status:saved.status==='done'?'planned':'done'};writeCashReviewPlan(window.localStorage,scope,next);setSaved(next);setError('');}catch{setError('Could not update the sample cash plan on this browser');}};
 const money=(p:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(p/100);
 return <ReviewPlanPanel id="nc-saved-plan" loading={!loaded} actions={[...CASH_REVIEW_ACTIONS]} actionId={actionId} onActionChange={id=>setActionId(id as CashReviewActionId)} owner={owner} onOwnerChange={setOwner} reviewDate={reviewDate} onReviewDateChange={setReviewDate} onSave={save} onToggle={toggle} onClear={clear} error={error} minDate={localDate(new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+1))} saved={saved?{title:CASH_REVIEW_ACTIONS.find(a=>a.id===saved.actionId)?.title??'Sample cash action',status:saved.status,owner:saved.owner,reviewDate:saved.reviewDate,reviewDue:saved.reviewDate<=localDate(),baseline:`Frozen sample baseline at ${saved.baseline.asOf}: cash ${money(saved.baseline.currentCash)}; minimum buffer ${money(saved.baseline.minimumBuffer)}; ${saved.baseline.horizonDays}-day outlook: ${saved.baseline.lowestCash===null?'unavailable':`lowest cash ${money(saved.baseline.lowestCash)} on ${saved.baseline.lowestDate}`}. Status: ${saved.baseline.forecastStatus}. ${saved.baseline.gaps.length?`Gaps at review: ${saved.baseline.gaps.join('; ')}.`:'No gaps recorded in this sample snapshot.'}`,observation:describeCashReviewChange(saved.baseline,model)}:null}/>;
}
