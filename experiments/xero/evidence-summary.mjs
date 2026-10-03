export function xeroEvidenceSummary(snapshot,{retrievedAt}={}){
 if(!snapshot||typeof snapshot.date!=='string'||typeof snapshot.tenantId!=='string'||typeof retrievedAt!=='string')throw Error('Xero evidence summary is invalid');
 const reportTitle=value=>value?.Reports?.[0]?.ReportName??value?.Reports?.[0]?.ReportTitles?.[0]??'Unavailable';
 const organisation=snapshot.organisation?.Organisations?.[0]??{};
 return Object.freeze({source:'xero',tenantId:snapshot.tenantId,reportDate:snapshot.date,retrievedAt,baseCurrency:organisation.BaseCurrency??'Unavailable',reports:Object.freeze({profitAndLoss:reportTitle(snapshot.profitAndLoss),balanceSheet:reportTitle(snapshot.balanceSheet),trialBalance:reportTitle(snapshot.trialBalance),bankSummary:reportTitle(snapshot.bankSummary)}),shopifyComparison:'not_requested'});
}
