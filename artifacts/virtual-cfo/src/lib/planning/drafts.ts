import {calculatePlan,PLAN_VERSION,type PlanInput,type ActionId} from './plan-model.ts';
import {metrics,type MarketingTotals} from '../marketing/review-model.ts';
export type Draft = {version:typeof PLAN_VERSION;id:string;title:string;action:ActionId;owner:string;reviewDate:string;originalReviewDate:string;objective:string;stopRule:string;createdAt:string;status:'planned'|'reviewed';history:{at:string;note:string}[];reviewNotes:string;baseline:MarketingTotals;sourceFrom:string;sourceTo:string;target:number|null;input:PlanInput|null;ebitda:number|null};
const date=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const text=(s:unknown,max:number):s is string=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const totals=['revenue','beforeAds','advertising','acquisitionSpend','overheads','da','orders','customers','firstContributionTotal','firstRevenueTotal','days'] as const;
export function validateDraft(d:Draft):boolean{
 try{
 if(!d||d.version!==PLAN_VERSION||!text(d.id,100)||!text(d.title,180)||!['acquisition','discounts','costs','stock','manual'].includes(d.action)||!text(d.owner,80)||!date(d.reviewDate)||!date(d.originalReviewDate)||!date(d.sourceFrom)||!date(d.sourceTo)||d.sourceFrom>d.sourceTo||!text(d.objective,400)||!text(d.stopRule,400)||!Number.isFinite(Date.parse(d.createdAt))||!['planned','reviewed'].includes(d.status)||typeof d.reviewNotes!=='string'||d.reviewNotes.length>1000||!Array.isArray(d.history)||d.history.length>100||!d.history.every(h=>Number.isFinite(Date.parse(h.at))&&text(h.note,1400))||!d.baseline||!totals.every(k=>Number.isFinite(d.baseline[k]))||d.baseline.orders<=0||d.baseline.days!==30||(d.target!==null&&(!Number.isFinite(d.target)||d.target<0)))return false;
 if(d.action==='stock')return d.input===null&&d.ebitda===null&&d.target===null;
 if(!d.input||!Object.entries(d.input).every(([k,v])=>k==='method'||typeof v==='number'&&Number.isFinite(v)))return false;const result=calculatePlan(d.baseline,d.input);
 return !!result&&typeof d.ebitda==='number'&&Number.isFinite(d.ebitda)&&Math.abs(result.ebitda-d.ebitda)<1e-6;
 }catch{return false;}
}
export function createDraft(d:Omit<Draft,'version'|'status'|'history'|'reviewNotes'|'originalReviewDate'>,today:string):Draft{
 if(!date(today)||!date(d.reviewDate)||d.reviewDate<=today)throw Error('Choose a review date after today.');
 const next:Draft={...d,version:PLAN_VERSION,status:'planned',originalReviewDate:d.reviewDate,reviewNotes:'',history:[{at:d.createdAt,note:'Saved a fictional sample draft on this browser.'}]};
 if(!validateDraft(next))throw Error('Enter an owner, success measure and stop rule, and check the scenario inputs.');
 return next;
}
export function reviewDraft(d:Draft,notes:string,now:string):Draft{
 if(!text(notes,1000))throw Error('Record what you reviewed; marking reviewed does not establish savings.');
 const next={...d,status:'reviewed' as const,reviewNotes:notes.trim(),history:[...d.history,{at:now,note:`Review recorded: ${notes.trim()}`} ]};
 if(!validateDraft(next))throw Error('This sample draft could not be updated.');return next;
}
export function rescheduleDraft(d:Draft,nextDate:string,reason:string,today:string,now:string):Draft{
 if(!date(nextDate)||nextDate<=today||!text(reason,300))throw Error('Choose a future review date and explain the change.');
 const next={...d,reviewDate:nextDate,status:'planned' as const,history:[...d.history,{at:now,note:`Review moved from ${d.reviewDate} to ${nextDate}: ${reason.trim()}`} ]};
 if(!validateDraft(next))throw Error('This sample draft could not be rescheduled.');return next;
}
export function readDrafts(storage:Pick<Storage,'getItem'>,key:string):Draft[]{
 const raw=storage.getItem(key);if(!raw)return [];const parsed=JSON.parse(raw);
 if(!Array.isArray(parsed)||parsed.length>20||!parsed.every(validateDraft)||new Set(parsed.map(d=>d.id)).size!==parsed.length)throw Error('Saved sample drafts are unreadable or use an older format. Existing data has been kept.');return parsed;
}
export function writeDrafts(storage:Pick<Storage,'setItem'>,key:string,drafts:Draft[]){
 if(drafts.length>20||!drafts.every(validateDraft))throw Error('Keep at most 20 valid sample drafts on this browser.');storage.setItem(key,JSON.stringify(drafts));
}
export const baselineProfit=(d:Draft)=>metrics(d.baseline).ebitda;
