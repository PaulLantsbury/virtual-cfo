// Handwritten independent test inputs; neither ledger is generated from the other
// or from an importer result. These are synthetic, not independent merchant proof.
export function syntheticLedgers(){
 const scope={storeId:'synthetic-store',currency:'GBP',timezone:'Europe/London',from:'2026-03-01',to:'2026-03-31'};
 return {scope,
 reference:{scope:{...scope},evidenceRef:'synthetic-reference-ledger-v1',events:[
 {storeId:'synthetic-store',currency:'GBP',type:'sale',id:'sale-1',orderId:'order-1',timestamp:'2026-02-15T12:00:00Z',productExVat:9000,shippingExVat:0,vat:1800,cash:10800},
 {storeId:'synthetic-store',currency:'GBP',type:'refund',id:'refund-1',orderId:'order-1',timestamp:'2026-03-05T12:00:00Z',productExVat:2000,shippingExVat:0,vat:400,cash:2400},
 {storeId:'synthetic-store',currency:'GBP',type:'refund',id:'refund-2',orderId:'order-1',timestamp:'2026-04-06T12:00:00Z',productExVat:2000,shippingExVat:0,vat:400,cash:2400}]},
 imported:{scope:{...scope},evidenceRef:'synthetic-import-ledger-v1',events:[
 {storeId:'synthetic-store',currency:'GBP',type:'sale',id:'sale-1',orderId:'order-1',timestamp:'2026-02-15T12:00:00+00:00',productExVat:9000,shippingExVat:0,vat:1800,cash:10800},
 {storeId:'synthetic-store',currency:'GBP',type:'refund',id:'refund-1',orderId:'order-1',timestamp:'2026-03-05T12:00:00+00:00',productExVat:2000,shippingExVat:0,vat:400,cash:2400},
 {storeId:'synthetic-store',currency:'GBP',type:'refund',id:'refund-2',orderId:'order-1',timestamp:'2026-04-06T13:00:00+01:00',productExVat:2000,shippingExVat:0,vat:400,cash:2400}]}};
}
