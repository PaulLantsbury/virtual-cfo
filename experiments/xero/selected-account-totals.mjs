import {validateXeroAccountMapping} from './account-mapping-contract.mjs';

/**
 * Reads selected account values only while the report payload is in memory.
 * It uses the account ID attribute supplied by Xero rather than account labels.
 */
export function extractSelectedAccountTotals({profitAndLoss,balanceSheet,bankSummary,bankSummaryContext,mapping}={}){
 const selected=validateXeroAccountMapping(mapping);
 if(!selected)fail('mapping_invalid');
 return Object.freeze({
  ...categoryTotals(profitAndLoss,'ProfitAndLoss','revenue',selected.revenue),
  ...categoryTotals(profitAndLoss,'ProfitAndLoss','processingFee',selected.processingFee,{missingValue:0}),
  ...categoryTotals(profitAndLoss,'ProfitAndLoss','advertising',selected.advertising,{missingValue:0}),
  ...categoryTotals(profitAndLoss,'ProfitAndLoss','software',selected.software,{missingValue:0}),
  ...cashTotals(balanceSheet,bankSummary,selected.includedCash,bankSummaryContext)
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
  if(missingValue===undefined){const error=Object.assign(Error('Xero selected account totals are unavailable'),{safeReason:'required_account_missing',safeFoundCount:found.size});throw error;}
  for(const id of ids)if(!found.has(id))found.set(id,missingValue);
 }
 return Object.freeze(Object.fromEntries(found));
}

function flatten(rows,out=[]){for(const row of rows){if(!row||typeof row!=='object')fail('report_row_invalid');if(Array.isArray(row.Rows))flatten(row.Rows,out);if(row.RowType==='Row'&&Array.isArray(row.Cells))out.push(row);}return out;}
function accountId(cells){const values=cells.flatMap(cell=>Array.isArray(cell?.Attributes)?cell.Attributes:[]).filter(attribute=>attribute?.Id==='account'&&typeof attribute.Value==='string');if(values.length===0)return null;if(values.some(value=>value.Value!==values[0].Value))fail('account_attribute_ambiguous');return values[0].Value;}
function money(cells){const values=cells.slice(1).map(cell=>cell?.Value).filter(value=>typeof value==='string'&&value.trim()!=='');if(values.length<1)fail('amount_missing');const raw=values[0].replace(/,/g,'');if(!/^-?\d+(?:\.\d{1,2})?$/.test(raw))fail('amount_format_invalid');const cents=Math.round(Number(raw)*100);if(!Number.isSafeInteger(cents))fail('amount_out_of_range');return cents;}
function fail(reason){throw Object.assign(Error('Xero selected account totals are unavailable'),{safeReason:reason});}

/** BankSummary fallback remains gated on caller-proven base-currency semantics. */
function cashTotals(balanceSheet,bankSummary,ids,context){
 if(!Array.isArray(balanceSheet?.Reports)||balanceSheet.Reports.length!==1)throw Object.assign(Error('Xero selected account totals are unavailable'),{safeReason:'report_shape_invalid',safeReport:'BalanceSheet',safeCategory:'includedCash'});
 try{return categoryTotals(balanceSheet,'BalanceSheet','includedCash',ids);}catch(error){
  if(error?.safeReason!=='required_account_missing'||error.safeFoundCount!==0||!bankSummary)throw error;
 }
 try{
  if(!context||context.currency!=='GBP'||context.baseCurrency!=='GBP'||!validDay(context.from)||!validDay(context.to)||context.from>context.to||context.snapshotFrom!==context.from||context.snapshotTo!==context.to)fail('cash_boundary_unverified');
  const directory=context.accountDirectory?.Accounts;if(!Array.isArray(directory)||directory.length>500)fail('cash_currency_unverified');
  for(const id of ids){const matches=directory.filter(account=>account?.AccountID===id);if(matches.length!==1||matches[0].Status!=='ACTIVE'||matches[0].Type!=='BANK'||matches[0].CurrencyCode!=='GBP')fail('cash_currency_unverified');}
  const report=bankSummary?.Reports?.length===1?bankSummary.Reports[0]:null;
  if(!report||report.ReportID!=='BankSummary'||!Array.isArray(report.Rows))fail('report_shape_invalid');
  const all=allRows(report.Rows),headers=all.filter(row=>row.RowType==='Header');
  if(headers.length!==1||!Array.isArray(headers[0].Cells))fail('cash_header_invalid');
  const header=headers[0].Cells,indexes=header.flatMap((cell,index)=>typeof cell?.Value==='string'&&cell.Value.trim().toLowerCase()==='closing balance'?[index]:[]);
  const canonical=['bank accounts','opening balance','cash received','cash spent','closing balance'];
  if(header.length!==5||indexes.length!==1||indexes[0]!==4||header.some((cell,index)=>typeof cell?.Value!=='string'||cell.Value.trim().toLowerCase()!==canonical[index]))fail('cash_header_invalid');
  const closing=indexes[0],found=new Map();
  for(const row of all.filter(row=>row.RowType==='Row')){
   if(!Array.isArray(row.Cells))fail('report_row_invalid');
   const id=bankSummaryAccountId(row.Cells);if(!id||!ids.includes(id))continue;
   if(found.has(id))fail('duplicate_selected_account');
   if(row.Cells.length!==header.length)fail('cash_header_invalid');
   found.set(id,money([{Value:''},row.Cells[closing]]));
  }
  if(found.size!==ids.length)fail('required_account_missing');
  return Object.freeze(Object.fromEntries(found));
 }catch(error){if(error?.safeReason)Object.assign(error,{safeReport:'BankSummary',safeCategory:'includedCash'});throw error;}
}
function allRows(rows,out=[],depth=0){if(depth>64||out.length>10000)fail('report_shape_invalid');for(const row of rows){if(out.length>=10000)fail('report_shape_invalid');if(!row||typeof row!=='object')fail('report_row_invalid');out.push(row);if(Array.isArray(row.Rows))allRows(row.Rows,out,depth+1);}return out;}
function validDay(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}

function bankSummaryAccountId(cells){const values=cells.flatMap(cell=>Array.isArray(cell?.Attributes)?cell.Attributes:[]).filter(attribute=>['account','accountID'].includes(attribute?.Id)&&typeof attribute.Value==='string');if(values.length===0)return null;if(values.some(value=>value.Value!==values[0].Value))fail('account_attribute_ambiguous');return values[0].Value;}
