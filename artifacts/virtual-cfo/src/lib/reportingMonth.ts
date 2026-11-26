import type {HistoryAvailability} from './v11/history-supported.ts';
type ListedMonth=HistoryAvailability['months'][number];
const unavailable='The report for this month cannot be chosen safely. Try checking again or choose another month.';
const validId=(id:unknown):id is string=>typeof id==='string'&&id.length>0&&id.length<=256;
/** Producer history-reader supplies versionId from its validated version_heads selection.
 * Array order, creation time and snapshotId alone never establish a preferred version. */
export function resolveHistoryMonthVersion(month:ListedMonth|undefined):{versionId:string;reason:string|null}{
 const fail=()=>({versionId:'',reason:unavailable});
 if(!month)return fail();
 const versions=month.versions;
 if(versions!==undefined&&(!Array.isArray(versions)||versions.some(v=>!v||!validId(v.versionId)||!['selected','invalidated'].includes(v.status))||new Set(versions.map(v=>v.versionId)).size!==versions.length))return fail();
 if(month.versionId!==undefined){
  if(!validId(month.versionId)||month.snapshotId!==month.versionId)return fail();
  if(versions&&!versions.some(v=>v.versionId===month.versionId&&v.status==='selected'))return fail();
  return {versionId:month.versionId,reason:null};
 }
 const selected=versions?.filter(v=>v.status==='selected')??[];
 return selected.length===1?{versionId:selected[0].versionId,reason:null}:fail();
}
/** Month controls are compact; exact dates/versions remain in evidence disclosures. */
export function reportingMonthLabel(from:string):string{
 if(!/^\d{4}-\d{2}-01$/.test(from))return 'Month unavailable';
 const date=new Date(from+'T12:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==from)return 'Month unavailable';
 return new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(date);
}
