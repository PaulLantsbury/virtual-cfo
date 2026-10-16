const REPORTS=Object.freeze({
 profitAndLoss:Object.freeze({id:'ProfitAndLoss',names:new Set(['Profit and Loss','ProfitAndLoss']),maps:Object.freeze({revenue:/^(revenue|sales|turnover)\b/i,costOfSales:/\b(cost of sales|costs of sales)\b/i,expenses:/\b(expenses?|overheads?)\b/i,netProfit:/\b(net profit|net loss)\b/i})}),
 balanceSheet:Object.freeze({id:'BalanceSheet',names:new Set(['Balance Sheet','BalanceSheet']),maps:Object.freeze({assets:/\bassets?\b/i,liabilities:/\bliabilities\b/i,equity:/\b(equity|capital)\b/i})}),
 trialBalance:Object.freeze({id:'TrialBalance',names:new Set(['Trial Balance','TrialBalance']),maps:Object.freeze({income:/\b(income|revenue|sales)\b/i,expense:/\b(expenses?|cost of sales)\b/i,asset:/\bassets?\b/i,liability:/\bliabilities\b/i})}),
 bankSummary:Object.freeze({id:'BankSummary',names:new Set(['Bank Summary','BankSummary']),maps:Object.freeze({cash:/\b(cash|bank)\b/i})})
});

function failure(){throw Error('Xero report payload is invalid');}
function text(value){return typeof value==='string'&&value.trim()!==''?value.trim():null;}
function reportFor(payload,definition){
 if(!payload||typeof payload!=='object'||!Array.isArray(payload.Reports)||payload.Reports.length!==1)failure();
 const report=payload.Reports[0];
 if(!report||typeof report!=='object'||report.ReportID!==definition.id||!definition.names.has(report.ReportName)||!Array.isArray(report.Rows))failure();
 const date=text(report.ReportDate); if(!date)failure();
 return {report,date};
}
function flatten(rows,out=[]){
 for(const row of rows){
  if(!row||typeof row!=='object')failure();
  if(Array.isArray(row.Rows))flatten(row.Rows,out);
  if(row.RowType==='Row'){
   if(!Array.isArray(row.Cells)||row.Cells.length<2)failure();
   const label=text(row.Cells[0]?.Value); const value=text(row.Cells[row.Cells.length-1]?.Value);
   if(!label||!value)failure(); out.push(Object.freeze({label,value}));
  }
 }
 return out;
}
function candidates(lines,maps){
 const out={};
 for(const [category,matcher] of Object.entries(maps)){
  const matches=lines.filter(line=>matcher.test(line.label));
  if(matches.length>1)failure();
  out[category]=matches[0]??null;
 }
 return Object.freeze(out);
}
export function parseXeroReport(kind,payload,{currency}={}){
 const definition=REPORTS[kind]; if(!definition||!text(currency))failure();
 const {report,date}=reportFor(payload,definition); const lines=flatten(report.Rows);
 return Object.freeze({kind,reportId:definition.id,reportName:report.ReportName,reportDate:date,currency:currency.trim(),lineCandidates:candidates(lines,definition.maps)});
}
export function parseXeroReports(snapshot){
 if(!snapshot||typeof snapshot!=='object'||!text(snapshot.organisation?.Organisations?.[0]?.BaseCurrency))failure();
 const currency=snapshot.organisation.Organisations[0].BaseCurrency;
 const parsed={}; for(const kind of Object.keys(REPORTS))parsed[kind]=parseXeroReport(kind,snapshot[kind],{currency});
 return Object.freeze(parsed);
}
