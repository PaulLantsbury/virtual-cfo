/** One-shot, read-only reporting context carried by a specialist link.
 * URL values never authorise a business or choose a replacement evidence version. */
import type {HistoryAvailability} from './v11/history-supported.ts';
export type ReviewHandoffRole='current'|'comparison'|'none';
export type ReviewHandoffChoice={from:string;to:string;versionId:string};
type Candidate=ReviewHandoffChoice&{storeId:string;current?:ReviewHandoffChoice};
export type ReviewHandoffState={role:ReviewHandoffRole;phase:'none'|'pending'|'applied'|'rejected'|'cancelled';candidate:Candidate|null;owner:{userId:string;storeId:string}|null;warning:string|null};
type Context={userId:string|null;storeId:string;availabilityReady:boolean;months:HistoryAvailability['months']};
const text=(value:string|null)=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\u0000-\u001f\u007f]/.test(value);
const day=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const month=(value:ReviewHandoffChoice)=>day(value.from)&&day(value.to)&&value.from.endsWith('-01')&&value.to===new Date(Date.UTC(+value.from.slice(0,4),+value.from.slice(5,7),0)).toISOString().slice(0,10)&&text(value.versionId);
const warn=(role:ReviewHandoffRole)=>role==='comparison'?'The linked earlier-month comparison is unavailable. Choose a comparison month and check the report again.':'The linked reporting context is unavailable. Choose a month and check the report again.';
export function createReviewHandoff(search:string,role:ReviewHandoffRole='none'):ReviewHandoffState{
 const empty:ReviewHandoffState={role,phase:'none',candidate:null,owner:null,warning:null};
 if(role==='none')return empty;
 if(typeof search!=='string'||search.length>8192)return {...empty,phase:'rejected',warning:warn(role)};
 const allKeys=['reviewStore','reviewFrom','reviewTo','reviewVersion','compareFrom','compareTo','compareVersion'];
 const params=new URLSearchParams(search),prefix=role==='comparison'?'compare':'review',names=[prefix+'From',prefix+'To',prefix+'Version'];
 if(allKeys.some(key=>params.getAll(key).length>1))return {...empty,phase:'rejected',warning:warn(role)};
 if(!names.some(key=>params.has(key)))return empty;
 // Duplicate parameters are ambiguous even if their first value happens to match.
 const involved=['reviewStore',...names,...(role==='comparison'?['reviewFrom','reviewTo','reviewVersion']:[])];
 if(involved.some(key=>params.getAll(key).length!==1))return {...empty,phase:'rejected',warning:warn(role)};
 const storeId=params.get('reviewStore'),choice={from:params.get(prefix+'From')??'',to:params.get(prefix+'To')??'',versionId:params.get(prefix+'Version')??''};
 if(!text(storeId)||!month(choice))return {...empty,phase:'rejected',warning:warn(role)};
 const current=role==='comparison'?{from:params.get('reviewFrom')??'',to:params.get('reviewTo')??'',versionId:params.get('reviewVersion')??''}:undefined;
 if(current&&(!month(current)||choice.to>=current.from))return {...empty,phase:'rejected',warning:warn(role)};
 return {...empty,phase:'pending',candidate:{...choice,storeId:storeId!,...(current?{current}:{})}};
}
export function cancelReviewHandoff(state:ReviewHandoffState):ReviewHandoffState{return {...state,phase:'cancelled',candidate:null,warning:null};}
function available(choice:ReviewHandoffChoice,months:HistoryAvailability['months']){
 const m=months.find(m=>m.from===choice.from&&m.to===choice.to);
 if(!m)return false;
 const versions=m.versions??(m.versionId?[{versionId:m.versionId,status:'selected' as const,kind:'base' as const}]:[]);
 return versions.some(v=>v.versionId===choice.versionId&&v.status==='selected');
}
/** Bind to the first signed-in business, then consume once. Manual choice or any
 * user/business change cancels replay, including switching away and back. */
export function advanceReviewHandoff(state:ReviewHandoffState,context:Context):{state:ReviewHandoffState;choice:ReviewHandoffChoice|null;warning:string|null}{
 const none=(s:ReviewHandoffState)=>({state:s,choice:null,warning:s.warning});
 if(state.phase==='none'||state.phase==='cancelled')return none(state);
 if(state.owner&&(!context.userId||state.owner.userId!==context.userId||state.owner.storeId!==context.storeId))return none(cancelReviewHandoff(state));
 if(!context.userId||!context.storeId)return none(state);
 const owned=state.owner?state:{...state,owner:{userId:context.userId,storeId:context.storeId}};
 if(owned.phase==='applied'||owned.phase==='rejected')return none(owned);
 if(owned.candidate?.storeId!==context.storeId)return none({...owned,phase:'rejected',warning:'The linked reporting context belongs to a different company. Choose evidence for the active company.'});
 if(!context.availabilityReady)return none(owned);
 const candidate=owned.candidate!;
 if(!available(candidate,context.months)||candidate.current&&!available(candidate.current,context.months))return none({...owned,phase:'rejected',warning:warn(owned.role)});
 return {state:{...owned,phase:'applied',warning:null},choice:{from:candidate.from,to:candidate.to,versionId:candidate.versionId},warning:null};
}

/** App/navigation lifetime, independent of StoreAccessGate's keyed child mounts.
 * Registration happens in effects; render lookups never mutate these records.
 * Capacity rejects new hints instead of evicting an old revoked ownership. */
export function createReviewNavigationOwnership(limit=64){
 const owners=new Map<string,{userId:string;storeId:string;revoked:boolean}>();
 return {
  allows(key:string,userId:string|null,storeId:string){const o=owners.get(key);return !!o&&!o.revoked&&o.userId===userId&&o.storeId===storeId;},
  register(key:string,userId:string,storeId:string){
   if(!key||key.length>16384||!userId||!storeId)return false;
   const o=owners.get(key);
   if(o){if(o.userId!==userId||o.storeId!==storeId)o.revoked=true;return !o.revoked;}
   if(owners.size>=limit)return false;
   owners.set(key,{userId,storeId,revoked:false});return true;
  },
 };
}
export const reviewNavigationOwnership=createReviewNavigationOwnership();
