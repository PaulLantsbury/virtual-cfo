import {eligibleCashView} from './cashSourceAdapter.ts';
import type {ReviewedMonth} from './reviewedHistorySeries.ts';
export function cashFinancialContext(month:ReviewedMonth|null){return month?{state:'supported',versionId:month.selection.versionId,scope:{storeId:month.selection.storeId,currency:month.selection.currency,from:month.selection.period.from,to:month.selection.period.to},profit:{state:month.evidence.costCoverage,ebitda:month.amounts.ebitda}}:null;}
/** Final display guard; the server independently checks financial source revisions in its read transaction. */
export function cashSupplementView(payload:unknown,financial:any,now=new Date()){
 const p=payload as any,s=financial?.scope;
 if(financial?.state!=='supported'||financial.profit?.state!=='complete'||!Number.isSafeInteger(financial.profit.ebitda)||!s||s.storeId!=='d7500000-0000-4000-8000-000000000009'||!p?.evidence||!p.source)return null;
 const source=p.source;
 if(source.contract!=='synthetic-cash-journal-v1'||source.sourceBasis!=='synthetic-model'||source.profile!=='uk-gifts-v2'||source.anchor!=='2024-11-01'||source.from!==s.from||source.to!==s.to||source.sourceRevision!==p.evidence.sourceRevision||source.mappingVersion!==p.evidence.mappingVersion||!['sourcePrefixHash','bankLedgerHash'].every(k=>typeof source[k]==='string'&&/^[a-f0-9]{64}$/.test(source[k])))return null;
 const cash=eligibleCashView(p.evidence,{...s,timezone:'Europe/London'},now);
 if(!cash||p.evidence.ebitda!==financial.profit.ebitda)return null;
 return {cash,evidence:p.evidence,source};
}
