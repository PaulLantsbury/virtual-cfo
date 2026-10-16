export const API_VERSION='2026-07';
const money='shopMoney { amount currencyCode }';
const transaction=`id kind status processedAt amountSet { ${money} }`;
export const QUERIES=Object.freeze({
 details:`query NightScoutDetails($id: ID!) { order(id: $id) {
  id updatedAt
  lineItems(first: 100) { pageInfo { hasNextPage } nodes { id quantity isGiftCard originalTotalSet { ${money} } discountAllocations { allocatedAmountSet { ${money} } } taxLines { priceSet { ${money} } } } }
  shippingLines(first: 20) { pageInfo { hasNextPage } nodes { id isRemoved originalPriceSet { ${money} } discountedPriceSet { ${money} } taxLines { priceSet { ${money} } } } }
  refunds { id updatedAt
   orderAdjustments(first: 1) { pageInfo { hasNextPage } nodes { id } }
   refundLineItems(first: 100) { pageInfo { hasNextPage } nodes { id quantity lineItem { id } subtotalSet { ${money} } totalTaxSet { ${money} } } }
   refundShippingLines(first: 20) { pageInfo { hasNextPage } nodes { id shippingLine { id } subtotalAmountSet { ${money} } taxAmountSet { ${money} } } }
  }
 } }`,
 context:`query NightScoutContext { shop { id myshopifyDomain currencyCode ianaTimezone } currentAppInstallation { accessScopes { handle } } }`,
 orders:`query NightScoutOrders($after: String) {
 orders(first: 1, after: $after, sortKey: ID) {
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
