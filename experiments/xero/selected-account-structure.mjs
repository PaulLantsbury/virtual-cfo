import {validateXeroAccountMapping} from './account-mapping-contract.mjs';

/** Creates a redacted structural profile for only the selected account IDs. */
export function describeSelectedAccountRows({profitAndLoss,balanceSheet,mapping}={}){
 const selected=validateXeroAccountMapping(mapping);if(!selected)throw Error('Xero selected account structure is unavailable');
 return Object.freeze({profitAndLoss:describe(profitAndLoss,'ProfitAndLoss',[...selected.revenue,...selected.processingFee,...selected.advertising,...selected.software]),balanceSheet:describe(balanceSheet,'BalanceSheet',selected.includedCash)});
}
function describe(payload,reportId,selected){
 const report=payload?.Reports?.[0];if(!report||report.ReportID!==reportId||!Array.isArray(report.Rows))fail();
 const found=new Set(),shapes=new Set();let accountAttributeRows=0;
 for(const row of flatten(report.Rows)){shapes.add(row.Cells.length);const ids=accountIds(row.Cells);if(ids.length)accountAttributeRows++;for(const id of ids)if(selected.includes(id))found.add(id);}
 return Object.freeze({selectedAccountIds:Object.freeze([...selected]),foundAccountIds:Object.freeze([...found].sort()),missingAccountIds:Object.freeze(selected.filter(id=>!found.has(id))),accountAttributeRows,cellCounts:Object.freeze([...shapes].sort((a,b)=>a-b))});
}
function flatten(rows,out=[]){for(const row of rows){if(!row||typeof row!=='object')fail();if(Array.isArray(row.Rows))flatten(row.Rows,out);if(row.RowType==='Row'&&Array.isArray(row.Cells))out.push(row);}return out;}
function accountIds(cells){return [...new Set(cells.flatMap(cell=>Array.isArray(cell?.Attributes)?cell.Attributes:[]).filter(x=>x?.Id==='account'&&typeof x.Value==='string').map(x=>x.Value))];}
function fail(){throw Error('Xero selected account structure is unavailable');}
