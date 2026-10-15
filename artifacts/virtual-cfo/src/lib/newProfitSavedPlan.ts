import type { PreviewModel, ProfitKey } from './newProfitPreview.ts';
export type PlanAction = { id: 'discount' | 'marketing' | 'cost'; title: string; metricKey: ProfitKey };
export type SamplePlan = { version: 1; action: PlanAction; owner: string; reviewDate: string; savedAt: string; status: 'planned' | 'done'; baseline: { from: string; to: string; currency: 'GBP'; orders: number; metricKey: ProfitKey; perOrderPence: number } };
export type PlanStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const actionMetrics = {discount:'discounts',marketing:'advertising',cost:'variable'} as const;
export function samplePlanKey(userId: string, storeId: string) { if (!userId || !storeId) throw new Error('Verified store access required'); return `night-scout:synthetic-preview:profit-plan:v1:${encodeURIComponent(userId)}:${encodeURIComponent(storeId)}`; }
export function localDate(now = new Date()) { return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }
function validDate(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value; }
export function createSamplePlan(action: PlanAction, owner: string, reviewDate: string, model: PreviewModel, now = new Date()): SamplePlan {
 if (!validDate(reviewDate) || reviewDate <= localDate(now)) throw new Error('Choose a future review date');
 if (!owner.trim() || owner.trim().length > 80) throw new Error('Enter an owner of 1–80 characters');
 if (!['discount','marketing','cost'].includes(action.id) || actionMetrics[action.id] !== action.metricKey || !action.title.trim() || action.title.length>180 || !Number.isFinite(model.current.orders) || model.current.orders <= 0 || !Number.isFinite(model.current[action.metricKey])) throw new Error('Sample baseline unavailable');
 return {version:1,action:{...action},owner:owner.trim(),reviewDate,savedAt:now.toISOString(),status:'planned',baseline:{from:model.from,to:model.to,currency:'GBP',orders:model.current.orders,metricKey:action.metricKey,perOrderPence:Math.round(model.current[action.metricKey]/model.current.orders)}};
}
export function readSamplePlan(storage: PlanStorage, key: string): SamplePlan | null {
 const raw=storage.getItem(key); if(raw===null)return null;
 if(raw.length>8192)throw new Error('Saved sample plan is too large to read. Clear it to start again.');
 const p=JSON.parse(raw) as SamplePlan;
 if (!p || p.version!==1 || !['planned','done'].includes(p.status) || !p.action || !['discount','marketing','cost'].includes(p.action.id) || actionMetrics[p.action.id]!==p.action.metricKey || typeof p.action.title!=='string' || !p.action.title.trim() || p.action.title.length>180 || typeof p.owner!=='string' || !p.owner.trim() || p.owner.length>80 || !validDate(p.reviewDate) || typeof p.savedAt!=='string' || !Number.isFinite(Date.parse(p.savedAt)) || !p.baseline || !validDate(p.baseline.from) || !validDate(p.baseline.to) || p.baseline.from>p.baseline.to || p.baseline.currency!=='GBP' || p.baseline.metricKey!==p.action.metricKey || !Number.isFinite(p.baseline.orders) || p.baseline.orders<=0 || !Number.isSafeInteger(p.baseline.perOrderPence)) throw new Error('Saved sample plan could not be read. Clear it to start again.');
 return p;
}
export function writeSamplePlan(storage: PlanStorage,key:string,plan:SamplePlan){storage.setItem(key,JSON.stringify(plan));}
export function removeSamplePlan(storage: PlanStorage,key:string){storage.removeItem(key);}
