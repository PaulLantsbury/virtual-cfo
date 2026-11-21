import type { Granularity,Horizon } from '../newProfitPreview.ts';
import type { Comparison } from '../marketing/review-model.ts';
export function readReviewContext(search:string){
 const q=new URLSearchParams(search),h=q.get('reviewHorizon'),v=q.get('reviewView'),c=q.get('reviewCompare');
 const horizon:Horizon|null=h==='last-week'||h==='last-month'?h:h==='3'||h==='6'||h==='12'?Number(h) as Horizon:null;
 const granularity:Granularity|null=horizon==='last-week'?'weekly':horizon==='last-month'?'monthly':v==='weekly'||v==='monthly'?v:null;
 const comparison:Comparison|null=c==='last-year'||c==='rolling'||c==='none'?c:null;
 return {horizon,granularity,comparison};
}
export function reviewQuery(horizon:Horizon,granularity:Granularity,comparison:Comparison){return new URLSearchParams({reviewHorizon:String(horizon),reviewView:granularity,reviewCompare:comparison}).toString();}
