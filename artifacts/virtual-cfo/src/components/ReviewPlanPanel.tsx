import { useId } from 'react';
import './ReviewPlanPanel.css';
export type ReviewPlanPanelProps = {
 id?: string; title?: string; note?: string; loading: boolean;
 saved?: { title: string; status: 'planned' | 'done'; owner: string; reviewDate: string; baseline: string; observation?: string; reviewDue?: boolean } | null;
 actions: { id: string; title: string }[]; actionId: string; onActionChange: (id: string) => void;
 owner: string; onOwnerChange: (owner: string) => void; reviewDate: string; onReviewDateChange: (date: string) => void;
 onSave: () => void; onToggle: () => void; onClear: () => void; error: string; minDate: string;
};
/** Shared presentation only. Each page owns its verified scope, validation and storage. */
export function ReviewPlanPanel({id,title='Keep an action for your next review',note='Saved on this browser · sample plan. This does not create reminders or sync to other devices. Save one priority to practise the review process.',loading,saved,actions,actionId,onActionChange,owner,onOwnerChange,reviewDate,onReviewDateChange,onSave,onToggle,onClear,error,minDate}:ReviewPlanPanelProps){
 const fieldId=useId();
 return <section id={id} className="ns-review-plan" aria-labelledby={`${fieldId}-heading`}>
  <h3 id={`${fieldId}-heading`}>{title}</h3>
  <p className="ns-review-plan-note">{note}</p>
  {loading?<p role="status">Loading saved sample plan…</p>:saved?<div className="ns-review-plan-saved">
   <p className="ns-review-plan-title">{saved.title} <span className="ns-review-plan-status">{saved.status==='done'?'Marked done':'Planned'}</span></p>
   <p>Owner: <strong>{saved.owner}</strong> · Review: <time dateTime={saved.reviewDate}>{saved.reviewDate}</time>{saved.reviewDue&&saved.status==='planned'?' · Review due':''}</p>
   <p>{saved.baseline}</p>
   {saved.observation&&<p className="ns-review-plan-observation">{saved.observation}</p>}
   <div className="ns-review-plan-buttons"><button type="button" onClick={onToggle}>{saved.status==='done'?'Reopen sample action':'Mark sample action done'}</button><button type="button" onClick={onClear}>Clear saved sample plan</button></div>
  </div>:<div className="ns-review-plan-fields">
   <label htmlFor={`${fieldId}-action`}>Priority<select id={`${fieldId}-action`} value={actionId} onChange={e=>onActionChange(e.target.value)}>{actions.map(action=><option key={action.id} value={action.id}>{action.title}</option>)}</select></label>
   <label htmlFor={`${fieldId}-owner`}>Owner<input id={`${fieldId}-owner`} value={owner} maxLength={80} onChange={e=>onOwnerChange(e.target.value)}/></label>
   <label htmlFor={`${fieldId}-date`}>Review date<input id={`${fieldId}-date`} type="date" value={reviewDate} min={minDate} onChange={e=>onReviewDateChange(e.target.value)}/></label>
   <button type="button" className="ns-review-plan-primary" onClick={onSave} disabled={!actions.length}>Save sample action</button>
  </div>}
  {error&&<div className="ns-review-plan-error" role="alert"><p>{error}</p><button type="button" onClick={onClear}>Clear unreadable saved plan</button></div>}
 </section>;
}
