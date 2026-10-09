import {validateXeroAccountMapping} from './account-mapping-contract.mjs';

const definitions=Object.freeze({
 profitAndLoss:Object.freeze({reportId:'ProfitAndLoss',categories:Object.freeze(['revenue','processingFee','advertising','software'])}),
 balanceSheet:Object.freeze({reportId:'BalanceSheet',categories:Object.freeze(['includedCash'])}),
 trialBalance:Object.freeze({reportId:'TrialBalance',categories:Object.freeze([])}),
 bankSummary:Object.freeze({reportId:'BankSummary',categories:Object.freeze([])})
});
const knownTypes=Object.freeze(['Header','Section','Row','SummaryRow']);
const unavailable=()=>Error('Xero report structure diagnostic unavailable');

/**
 * Produce value-free structural metadata for Xero reports. This deliberately
 * excludes labels, cell values, attributes, account IDs, dates and currencies.
 */
export function diagnoseXeroReportStructure({snapshot,mapping}={}){
 const selected=validateXeroAccountMapping(mapping);
 if(!selected||!snapshot||typeof snapshot!=='object')throw unavailable();
 const reports={};
 for(const [kind,definition] of Object.entries(definitions))reports[kind]=inspect(snapshot[kind],definition,selected);
 return Object.freeze({event:'xero_report_structure',state:'observed',reports:Object.freeze(reports)});
}

function inspect(payload,definition,mapping){
 const candidates=Array.isArray(payload?.Reports)?payload.Reports:[];
 const report=candidates.length===1&&candidates[0]&&typeof candidates[0]==='object'?candidates[0]:null;
 const stats={rootRows:0,totalRows:0,maxDepth:0,nestedContainers:0,rowsWithCells:0,minCells:null,maxCells:0,accountAttributedRows:0,rowTypes:{Header:0,Section:0,Row:0,SummaryRow:0,Other:0}};
 const selectedCounts=new Map(definition.categories.flatMap(category=>mapping[category].map(id=>[id,0])));
 const categoryById=new Map(definition.categories.flatMap(category=>mapping[category].map(id=>[id,category])));
 const eligibility=Object.fromEntries(definition.categories.map(category=>[category,{occurrences:0,extractorEligible:0,consistentAccountAttributes:0,conflictingAccountAttributes:0,usableMoney:0,noValue:0,malformedValue:0,minCells:null,maxCells:0}]));
 if(report&&Array.isArray(report.Rows)){
  stats.rootRows=cap(report.Rows.length);walk(report.Rows,1,stats,selectedCounts,categoryById,eligibility);
 }
 const selected={};
 for(const category of definition.categories){
  const counts=mapping[category].map(id=>selectedCounts.get(id)??0);
  selected[category]=Object.freeze({expected:cap(counts.length),found:cap(counts.filter(count=>count===1).length),missing:cap(counts.filter(count=>count===0).length),duplicate:cap(counts.filter(count=>count>1).length),...eligibility[category]});
 }
 return Object.freeze({
  envelope:Object.freeze({reports:cap(candidates.length),singleReport:report!==null,reportIdMatches:report?.ReportID===definition.reportId,rowsArray:Array.isArray(report?.Rows)}),
  shape:Object.freeze({...stats,rowTypes:Object.freeze(stats.rowTypes)}),
  selected:Object.freeze(selected)
 });
}

function walk(rows,depth,stats,selectedCounts,categoryById,eligibility){
 if(!Array.isArray(rows)||depth>64||stats.totalRows>=10_000)return;
 stats.maxDepth=Math.max(stats.maxDepth,cap(depth));
 for(const row of rows.slice(0,10_000)){
  if(stats.totalRows>=10_000)break;
  stats.totalRows=cap(stats.totalRows+1);
  if(!row||typeof row!=='object'){stats.rowTypes.Other=cap(stats.rowTypes.Other+1);continue;}
  const type=knownTypes.includes(row.RowType)?row.RowType:'Other';stats.rowTypes[type]=cap(stats.rowTypes[type]+1);
  if(Array.isArray(row.Cells)){
   const count=cap(row.Cells.length);stats.rowsWithCells=cap(stats.rowsWithCells+1);stats.minCells=stats.minCells===null?count:Math.min(stats.minCells,count);stats.maxCells=Math.max(stats.maxCells,count);
   const attributes=accountAttributes(row.Cells),ids=new Set(attributes);if(ids.size>0)stats.accountAttributedRows=cap(stats.accountAttributedRows+1);
   for(const id of ids)if(selectedCounts.has(id))selectedCounts.set(id,cap(selectedCounts.get(id)+1));
   const categories=new Set([...ids].map(id=>categoryById.get(id)).filter(Boolean));
   for(const category of categories){
    const metric=eligibility[category];metric.occurrences=cap(metric.occurrences+1);metric.minCells=metric.minCells===null?count:Math.min(metric.minCells,count);metric.maxCells=Math.max(metric.maxCells,count);
    if(type!=='Row')continue;metric.extractorEligible=cap(metric.extractorEligible+1);
    const consistent=attributes.length>0&&attributes.every(id=>id===attributes[0]);
    if(!consistent){metric.conflictingAccountAttributes=cap(metric.conflictingAccountAttributes+1);continue;}
    metric.consistentAccountAttributes=cap(metric.consistentAccountAttributes+1);
    const shape=moneyShape(row.Cells);metric[shape]=cap(metric[shape]+1);
   }
  }
  if(Array.isArray(row.Rows)){stats.nestedContainers=cap(stats.nestedContainers+1);walk(row.Rows,depth+1,stats,selectedCounts,categoryById,eligibility);}
 }
}

function accountAttributes(cells){
 const ids=[];
 for(const cell of cells)for(const attribute of Array.isArray(cell?.Attributes)?cell.Attributes:[])if(attribute?.Id==='account'&&typeof attribute.Value==='string')ids.push(attribute.Value);
 return ids;
}
function moneyShape(cells){const values=cells.slice(1).map(cell=>cell?.Value).filter(value=>typeof value==='string'&&value.trim()!=='');if(values.length<1)return 'noValue';const raw=values[0].replace(/,/g,'');if(!/^-?\d+(?:\.\d{1,2})?$/.test(raw))return 'malformedValue';const cents=Math.round(Number(raw)*100);return Number.isSafeInteger(cents)?'usableMoney':'malformedValue';}
function cap(value){return Math.min(Number.isFinite(value)?Math.max(0,Math.trunc(value)):0,10_000);}
