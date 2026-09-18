const money=value=>Number.isSafeInteger(value);
export function separateSourceViews({shopifyNetSales,xeroRevenue,externalInflows,externalOutflows,includedBalances,internalTransfers=[]}){
 if(![shopifyNetSales,xeroRevenue,externalInflows,externalOutflows,...includedBalances,...internalTransfers].every(money))throw Error('Xero reconciliation fixture is invalid');
 return Object.freeze({availableCash:includedBalances.reduce((sum,value)=>sum+value,0),cashMovement:externalInflows-externalOutflows,internalTransferMovement:0,shopifyTradingRevenue:shopifyNetSales,xeroBookedRevenue:xeroRevenue,comparison:'not_requested'});
}
