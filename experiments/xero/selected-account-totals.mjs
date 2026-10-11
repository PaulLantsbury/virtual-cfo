import {validateXeroAccountMapping} from './account-mapping-contract.mjs';

/**
 * Reads selected account values only while the report payload is in memory.
 * It uses the account ID attribute supplied by Xero rather than account labels.
 */
export function extractSelectedAccountTotals({profitAndLoss,balanceSheet,mapping}={}){
 const selected=validateXeroAccountMapping(mapping);
 if(!selected)fail('mapping_invalid');
 return Object.freeze({
  ...categoryTotals(profitAndLoss,'ProfitAndLoss','revenue',selected.revenue),
  ...categoryTotals(profitAndLoss,'ProfitAndLoss','processingFee',selected.processingFee,{missingValue:0}),
  ...categoryTotals(profitAndLoss,'ProfitAndLoss','advertising',selected.advertising,{missingValue:0}),
  ...categoryTotals(profitAndLoss,'ProfitAndLoss','software',selected.software,{missingValue:0}),
  ...categoryTotals(balanceSheet,'BalanceSheet','includedCash',selected.includedCash)
 });
}

function categoryTotals(payload,reportId,category,ids,options){try{return totalsFromReport(payload,reportId,ids,options);}catch(error){if(error?.safeReason)Object.assign(error,{safeReport:reportId,safeCategory:category});throw error;}}

function totalsFromReport(payload,reportId,ids,{missingValue}={}){
 const report=payload?.Reports?.[0];
 if(!report||report.ReportID!==reportId||!Array.isArray(report.Rows))fail('report_shape_invalid');
 const found=new Map();
 for(const row of flatten(report.Rows)){
  const id=accountId(row.Cells);if(!id||!ids.includes(id))continue;
  if(found.has(id))fail('duplicate_selected_account');
  found.set(id,money(row.Cells));
 }
 if(found.size!==ids.length){
  if(missingValue===undefined)fail('required_account_missing');
  for(const id of ids)if(!found.has(id))found.set(id,missingValue);
 }
 return Object.freeze(Object.fromEntries(found));
}

function flatten(rows,out=[]){for(const row of rows){if(!row||typeof row!=='object')fail('report_row_invalid');if(Array.isArray(row.Rows))flatten(row.Rows,out);if(row.RowType==='Row'&&Array.isArray(row.Cells))out.push(row);}return out;}
function accountId(cells){const values=cells.flatMap(cell=>Array.isArray(cell?.Attributes)?cell.Attributes:[]).filter(attribute=>attribute?.Id==='account'&&typeof attribute.Value==='string');if(values.length===0)return null;if(values.some(value=>value.Value!==values[0].Value))fail('account_attribute_ambiguous');return values[0].Value;}
function money(cells){const values=cells.slice(1).map(cell=>cell?.Value).filter(value=>typeof value==='string'&&value.trim()!=='');if(values.length<1)fail('amount_missing');const raw=values[0].replace(/,/g,'');if(!/^-?\d+(?:\.\d{1,2})?$/.test(raw))fail('amount_format_invalid');const cents=Math.round(Number(raw)*100);if(!Number.isSafeInteger(cents))fail('amount_out_of_range');return cents;}
function fail(reason){throw Object.assign(Error('Xero selected account totals are unavailable'),{safeReason:reason});}
