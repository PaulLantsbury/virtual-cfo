import {validateXeroAccountMapping} from './account-mapping-contract.mjs';

/**
 * Reads selected account values only while the report payload is in memory.
 * It uses the account ID attribute supplied by Xero rather than account labels.
 */
export function extractSelectedAccountTotals({profitAndLoss,balanceSheet,mapping}={}){
 const selected=validateXeroAccountMapping(mapping);
 if(!selected)throw Error('Xero selected account totals are unavailable');
 return Object.freeze({
  ...totalsFromReport(profitAndLoss,'ProfitAndLoss',selected.revenue),
  ...totalsFromReport(profitAndLoss,'ProfitAndLoss',selected.processingFee,{missingValue:0}),
  ...totalsFromReport(profitAndLoss,'ProfitAndLoss',selected.advertising,{missingValue:0}),
  ...totalsFromReport(profitAndLoss,'ProfitAndLoss',selected.software,{missingValue:0}),
  ...totalsFromReport(balanceSheet,'BalanceSheet',selected.includedCash)
 });
}

function totalsFromReport(payload,reportId,ids,{missingValue}={}){
 const report=payload?.Reports?.[0];
 if(!report||report.ReportID!==reportId||!Array.isArray(report.Rows))fail();
 const found=new Map();
 for(const row of flatten(report.Rows)){
  const id=accountId(row.Cells);if(!id||!ids.includes(id))continue;
  if(found.has(id))fail();
  found.set(id,money(row.Cells));
 }
 if(found.size!==ids.length){
  if(missingValue===undefined)fail();
  for(const id of ids)if(!found.has(id))found.set(id,missingValue);
 }
 return Object.freeze(Object.fromEntries(found));
}

function flatten(rows,out=[]){for(const row of rows){if(!row||typeof row!=='object')fail();if(Array.isArray(row.Rows))flatten(row.Rows,out);if(row.RowType==='Row'&&Array.isArray(row.Cells))out.push(row);}return out;}
function accountId(cells){const values=cells.flatMap(cell=>Array.isArray(cell?.Attributes)?cell.Attributes:[]).filter(attribute=>attribute?.Id==='account'&&typeof attribute.Value==='string');if(values.length===0)return null;if(values.some(value=>value.Value!==values[0].Value))fail();return values[0].Value;}
function money(cells){const values=cells.slice(1).map(cell=>cell?.Value).filter(value=>typeof value==='string'&&value.trim()!=='');if(values.length<1)fail();const raw=values[0].replace(/,/g,'');if(!/^-?\d+(?:\.\d{1,2})?$/.test(raw))fail();const cents=Math.round(Number(raw)*100);if(!Number.isSafeInteger(cents))fail();return cents;}
function fail(){throw Error('Xero selected account totals are unavailable');}
