// Synthetic API-shaped examples only. No merchant/customer data or credentials.
export const expected={domain:'night-scout-fixture.myshopify.com',shopId:'gid://shopify/Shop/1'};
const money=amount=>({shopMoney:{amount,currencyCode:'GBP'}});
const transaction=(id,kind,status,amount,processedAt)=>({id:`gid://shopify/OrderTransaction/${id}`,kind,status,processedAt,amountSet:money(amount)});
export function contextFixture(){return {shop:{id:expected.shopId,myshopifyDomain:expected.domain,currencyCode:'GBP',ianaTimezone:'Europe/London'},currentAppInstallation:{accessScopes:[{handle:'read_orders'},{handle:'read_all_orders'}]}};}
export function orderFixture(id=1){
 const sale=transaction(id*10,'SALE','SUCCESS','108.00','2026-02-15T12:00:00Z');
 const refundTx=transaction(id*10+1,'REFUND','SUCCESS','24.00','2026-03-05T12:00:00Z');
 return {id:`gid://shopify/Order/${id}`,createdAt:'2026-02-15T11:59:00Z',updatedAt:'2026-03-05T12:00:00Z',processedAt:'2026-02-15T12:00:00Z',cancelledAt:null,test:false,edited:false,taxesIncluded:false,currencyCode:'GBP',displayFinancialStatus:'PARTIALLY_REFUNDED',
 originalTotalPriceSet:money('108.00'),totalDiscountsSet:money('10.00'),totalTaxSet:money('18.00'),totalShippingPriceSet:money('0.00'),
 transactions:[sale,refundTx],transactionsCount:{count:2,precision:'EXACT'},
 refunds:[{id:`gid://shopify/Refund/${id}`,createdAt:'2026-03-05T12:00:00Z',updatedAt:'2026-03-05T12:00:00Z',totalRefundedSet:money('24.00'),transactions:{pageInfo:{hasNextPage:false,endCursor:'refund-end'},nodes:[refundTx]}}]};
}
export function pageFixture(nodes,next=null){return {orders:{nodes,pageInfo:{hasNextPage:next!==null,endCursor:next}}};}
