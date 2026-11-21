import {localDate,type PlanStorage} from './newProfitSavedPlan.ts';
export const CASH_REVIEW_ACTIONS=[{id:'check-commitments',title:'Check significant upcoming payments'},{id:'check-settlements',title:'Check when sales cash will arrive'},{id:'check-stock',title:'Review cash tied up in stock'}] as const;
export type CashReviewActionId=typeof CASH_REVIEW_ACTIONS[number]['id'];
/** Pence, frozen at save time. A missing outlook stays missing rather than becoming zero. */
export type CashReviewSnapshot={asOf:string;currentCash:number;minimumBuffer:number;horizonDays:number;lowestCash:number|null;lowestDate:string|null;forecastStatus:string;gaps:string[]};
export type CashModel=CashReviewSnapshot;
export type CashReviewPlanRecord={version:2;actionId:CashReviewActionId;owner:string;reviewDate:string;savedAt:string;status:'planned'|'done';baseline:CashReviewSnapshot&{currency:'GBP'}};
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
// Preserve the scoped key so demo reset still owns it. Version 1 must be explicitly cleared.
export function cashReviewPlanKey(userId:string,storeId:string){if(!userId||!storeId||userId.length>180||storeId.length>180)throw Error('Verified store access required');return `night-scout:synthetic-preview:cash-plan:v1:${encodeURIComponent(userId)}:${encodeURIComponent(storeId)}`;}
function validate(p:CashReviewPlanRecord){
 const b=p?.baseline;
 if(!p||p.version!==2||!CASH_REVIEW_ACTIONS.some(a=>a.id===p.actionId)||!['planned','done'].includes(p.status)||typeof p.owner!=='string'||!p.owner.trim()||p.owner.length>80||!date(p.reviewDate)||typeof p.savedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.savedAt)||!date(p.savedAt.slice(0,10))||!Number.isFinite(Date.parse(p.savedAt))||p.reviewDate<=p.savedAt.slice(0,10)||!b||b.currency!=='GBP'||!date(b.asOf)||![b.currentCash,b.minimumBuffer].every(Number.isSafeInteger)||b.minimumBuffer<0||!Number.isInteger(b.horizonDays)||b.horizonDays<1||b.horizonDays>91||typeof b.forecastStatus!=='string'||!b.forecastStatus.trim()||b.forecastStatus.length>120||!Array.isArray(b.gaps)||b.gaps.length>30||b.gaps.some(g=>typeof g!=='string'||!g.trim()||g.length>300)||(b.lowestCash===null)!==(b.lowestDate===null)||(b.lowestCash!==null&&(!Number.isSafeInteger(b.lowestCash)||!date(b.lowestDate)||b.lowestDate<b.asOf||Date.parse(b.lowestDate+'T00:00:00Z')-Date.parse(b.asOf+'T00:00:00Z')>b.horizonDays*86400000)))throw Error('Saved cash plan uses an older or unreadable format. Clear it to start a new review.');
 return p;
}
export function createCashReviewPlan(actionId:CashReviewActionId,owner:string,reviewDate:string,model:CashReviewSnapshot,now=new Date()):CashReviewPlanRecord{
 if(!date(reviewDate)||reviewDate<=localDate(now))throw Error('Choose a future review date');
 if(typeof owner!=='string'||!owner.trim()||owner.trim().length>80)throw Error('Enter an owner of 1–80 characters');
 return validate({version:2,actionId,owner:owner.trim(),reviewDate,savedAt:now.toISOString(),status:'planned',baseline:{...model,gaps:[...model.gaps],currency:'GBP'}});
}
export function readCashReviewPlan(storage:PlanStorage,key:string):CashReviewPlanRecord|null{const raw=storage.getItem(key);if(raw===null)return null;if(raw.length>16384)throw Error('Saved sample cash plan is too large. Clear it to start again.');return validate(JSON.parse(raw));}
export function writeCashReviewPlan(storage:PlanStorage,key:string,plan:CashReviewPlanRecord){const raw=JSON.stringify(validate(plan));if(raw.length>16384)throw Error('Sample cash plan is too large');storage.setItem(key,raw);}
export function clearCashReviewPlan(storage:PlanStorage,key:string){storage.removeItem(key);}
export function describeCashReviewChange(saved:CashReviewSnapshot,current:CashReviewSnapshot){
 if(current.asOf<=saved.asOf)return 'There is no later cash snapshot to assess. Editing assumptions does not establish an outcome from your action.';
 const delta=current.currentCash-saved.currentCash;
 const money=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Math.abs(delta)/100);
 return `Compared with your saved snapshot at ${saved.asOf}, bank cash is ${delta===0?'unchanged':`${money} ${delta>0?'higher':'lower'}`}. This comparison does not attribute the change to your action.`;
}
