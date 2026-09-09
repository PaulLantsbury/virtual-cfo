export const API_VERSION='2026-07';
const money='shopMoney { amount currencyCode }';
const transaction=`id kind status processedAt amountSet { ${money} }`;
export const QUERIES=Object.freeze({
 context:`query NightScoutContext { shop { id myshopifyDomain currencyCode ianaTimezone } currentAppInstallation { accessScopes { handle } } }`,
 orders:`query NightScoutOrders($after: String) {
 orders(first: 25, after: $after, sortKey: ID) {
  pageInfo { hasNextPage endCursor }
  nodes {
   id createdAt updatedAt processedAt cancelledAt test edited taxesIncluded currencyCode displayFinancialStatus
   originalTotalPriceSet { ${money} } totalDiscountsSet { ${money} } totalTaxSet { ${money} } totalShippingPriceSet { ${money} }
   transactions(first: 100) { ${transaction} }
   transactionsCount { count precision }
   refunds { id createdAt updatedAt totalRefundedSet { ${money} }
    transactions(first: 100) { pageInfo { hasNextPage endCursor } nodes { ${transaction} } }
   }
  }
 }
}`,
});
