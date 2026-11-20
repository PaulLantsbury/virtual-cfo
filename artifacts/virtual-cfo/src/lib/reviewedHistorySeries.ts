import {composeHistoryMonth, composeHistorySeries} from './v11/history-composition.ts';
import type {HistoryAvailability, HistorySelection} from './v11/history-supported.ts';

export type ReviewedMonth = NonNullable<ReturnType<typeof composeHistoryMonth>>;
/** Bounded monthly history; missing months and ambiguous versions are never skipped. */
export function reviewedSeriesSelections(months: HistoryAvailability['months'], selected: HistorySelection, count=12): HistorySelection[] {
 if (!Number.isInteger(count) || count<2 || count>12 || !selected.versionId) return [];
 const sorted=[...months].sort((a,b)=>a.from.localeCompare(b.from));
 const end=sorted.findIndex(m=>m.from===selected.period.from && m.to===selected.period.to);
 if(end<0) return [];
 const chosen=sorted.slice(Math.max(0,end-count+1),end+1);
 if(chosen.length<2) return [];
 const result: HistorySelection[]=[];
 for(const m of chosen){
  const versions=m.versions??(m.versionId?[{versionId:m.versionId,status:'selected' as const,kind:'base' as const}]:[]);
  const valid=versions.filter(v=>v.status==='selected');
  const version=m.from===selected.period.from?valid.find(v=>v.versionId===selected.versionId):valid.length===1?valid[0]:undefined;
  if(!version) return [];
  if(result.length){const next=new Date(`${result.at(-1)!.period.to}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);if(next.toISOString().slice(0,10)!==m.from)return [];}
  result.push({...selected,period:{from:m.from,to:m.to},versionId:version.versionId});
 }
 return result;
}

/** Sequential source reads bound database load and publish only a complete verified series. */
export async function readReviewedSeries(selections: HistorySelection[], read:(selection:HistorySelection)=>Promise<unknown>, signal:AbortSignal):Promise<ReviewedMonth[]> {
 if(selections.length<2 || selections.length>12) throw Error('Choose at least two reviewed months.');
 const entries:{selection:HistorySelection;response:unknown}[]=[];
 for(const selection of selections){
  signal.throwIfAborted();
  const response=await read(selection);
  signal.throwIfAborted();
  if(!composeHistoryMonth(response,selection))throw Error('A month in this history could not be verified.');
  entries.push({selection,response});
 }
 const series=composeHistorySeries(entries);
 if(!series)throw Error('Monthly evidence does not form a matching continuous history.');
 return series.months;
}
