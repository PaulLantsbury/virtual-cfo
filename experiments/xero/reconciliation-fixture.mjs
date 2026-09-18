const money=value=>Number.isSafeInteger(value);
export function reconcileXeroSnapshot({shopifyNetSales,xeroRevenue,externalInflows,externalOutflows,includedBalances,internalTransfers=[]}){
 if(![shopifyNetSales,xeroRevenue,externalInflows,externalOutflows,...includedBalances,...internalTransfers].every(money))throw Error('Xero reconciliation fixture is invalid');
 return Object.freeze({revenueDifference:xeroRevenue-shopifyNetSales,availableCash:includedBalances.reduce((sum,value)=>sum+value,0),cashMovement:externalInflows-externalOutflows,internalTransferMovement:0,commerceRevenue:shopifyNetSales,accountingRevenue:xeroRevenue});
}
