import type {buildCashDemo,CashActionId} from './cashDemoModel.ts';
import {localDate,type PlanStorage} from './newProfitSavedPlan.ts';
export type CashModel=ReturnType<typeof buildCashDemo>;
export type CashReviewPlanRecord={version:1;actionId:CashActionId;owner:string;reviewDate:string;savedAt:string;status:'planned'|'done';baseline:{asOf:string;currentCash:number;minimumBuffer:number;lowestCash:number;lowestDate:string;currency:'GBP'}};
const ids=['stock-order','supplier-deferral','overheads'];
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function cashReviewPlanKey(userId:string,storeId:string){if(!userId||!storeId||userId.length>180||storeId.length>180)throw Error('Verified store access required');return `night-scout:synthetic-preview:cash-plan:v1:${encodeURIComponent(userId)}:${encodeURIComponent(storeId)}`;}
function validate(p:CashReviewPlanRecord){
 if(!p||p.version!==1||!ids.includes(p.actionId)||!['planned','done'].includes(p.status)||typeof p.owner!=='string'||!p.owner.trim()||p.owner.length>80||!date(p.reviewDate)||typeof p.savedAt!=='string'||p.savedAt.length>40||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.savedAt)||!date(p.savedAt.slice(0,10))||!Number.isFinite(Date.parse(p.savedAt))||p.reviewDate<=p.savedAt.slice(0,10)||!p.baseline||p.baseline.currency!=='GBP'||!date(p.baseline.asOf)||!date(p.baseline.lowestDate)||p.baseline.lowestDate<p.baseline.asOf||![p.baseline.currentCash,p.baseline.minimumBuffer,p.baseline.lowestCash].every(Number.isSafeInteger)||p.baseline.minimumBuffer<0)throw Error('Saved sample cash plan could not be read. Clear it to start again.');
 return p;
}
export function createCashReviewPlan(actionId:CashActionId,owner:string,reviewDate:string,model:CashModel,now=new Date()):CashReviewPlanRecord{
 if(!date(reviewDate)||reviewDate<=localDate(now))throw Error('Choose a future review date');
 if(typeof owner!=='string'||!owner.trim()||owner.trim().length>80)throw Error('Enter an owner of 1–80 characters');
 return validate({version:1,actionId,owner:owner.trim(),reviewDate,savedAt:now.toISOString(),status:'planned',baseline:{asOf:model.asOf,currentCash:model.currentCash,minimumBuffer:model.minimumBuffer,lowestCash:model.lowestForecast.balance,lowestDate:model.lowestForecast.date,currency:'GBP'}});
}
export function readCashReviewPlan(storage:PlanStorage,key:string):CashReviewPlanRecord|null{const raw=storage.getItem(key);if(raw===null)return null;if(raw.length>8192)throw Error('Saved sample cash plan is too large. Clear it to start again.');return validate(JSON.parse(raw));}
export function writeCashReviewPlan(storage:PlanStorage,key:string,plan:CashReviewPlanRecord){const raw=JSON.stringify(validate(plan));if(raw.length>8192)throw Error('Sample cash plan is too large');storage.setItem(key,raw);}
export function clearCashReviewPlan(storage:PlanStorage,key:string){storage.removeItem(key);}
