// Independently hand-worked GBP acceptance ledger; synthetic, never uploaded.
export const STORE='cfo-acceptance-synthetic';
export function acceptanceInput(month='02') {
 const scope={storeId:STORE,currency:'GBP',from:`2026-${month}-01`,to:`2026-${month}-${month==='02'?'28':month==='03'?'31':'30'}`};
 const base={store_id:STORE,currency:'GBP',mapping_state:'verified',day:'2026-02-15',original_eligible:true};
 const orders=[
  {...base,id:'a',tax_basis:'exclusive',gross:'120',gross_vat:'24',discount:'12',discount_vat:'2.40',shipping:'6',shipping_vat:'1.20'},
  {...base,id:'b',tax_basis:'inclusive',gross:'96',gross_vat:'16',discount:'9.60',discount_vat:'1.60',shipping:'3.60',shipping_vat:'0.60'},
  {...base,id:'c',tax_basis:'exclusive',gross:'60',gross_vat:'0',discount:'0',discount_vat:'0',shipping:'0',shipping_vat:'0'},
  {...base,id:'excluded-test',original_eligible:false,tax_basis:'exclusive',gross:'999',gross_vat:'0',discount:'0',discount_vat:'0',shipping:'0',shipping_vat:'0'},
 ];
 const refunds=[
  {...base,id:'ra',order_id:'a',day:'2026-02-20',product_cash:'24',product_vat:'4',shipping_cash:'1.20',shipping_vat:'0.20',amount:'25.20'},
  {...base,id:'rb',order_id:'b',day:'2026-03-05',product_cash:'36',product_vat:'6',shipping_cash:'0',shipping_vat:'0',amount:'36'},
 ];
 const coverage=[{store_id:STORE,currency:'GBP',date_from:scope.from,date_to:scope.to,sales_and_refunds_complete:true,evidence_ref:'complete invented ledger'}];
 return {scope,mapped:{orders,refunds,coverage}};
}
export function acceptanceCosts(scope,sales) {
 const snapshotId='synthetic-cfo-acceptance';
 const proof={storeId:STORE,currency:'GBP',basis:'actual',evidenceRef:'invented historical invoice',sourceRevision:'v1',observedRevision:'v1'};
 const lines=[['a',4000],['b',3000],['c',2000]].map(([orderId,total])=>({...proof,id:`line-${orderId}`,orderId,soldOn:'2026-02-15',quantity:orderId==='b'?2:1,unitCostPence:orderId==='b'?1500:total,originalEligible:true,landedCostSupported:true}));
 const april=scope.from==='2026-04-01',feb=scope.from==='2026-02-01';
 const recoveries=april?[{...proof,id:'return-b',lineId:'line-b',recoveryOn:'2026-04-05',quantity:1,status:'saleable'}]:[];
 const expenses=(april?[]:feb?[['variableCosts',1200,null],['advertising',2300,null],['overheads',3000,600]]:[['variableCosts',400,null],['overheads',3000,600]])
 .map(([category,amountPence,daPence])=>({...proof,id:category,sourceId:`source-${category}`,from:scope.from,to:scope.to,category,amountPence,daPence}));
 const costEvidence={snapshotId,revision:'cost-v1',lines,recoveries,expenses,coverage:{}};
 for(const component of ['productCosts','recoveries','variableCosts','advertising','overheads','da']) {
  const records=component==='productCosts'?lines:component==='recoveries'?recoveries:expenses.filter(e=>e.category===(component==='da'?'overheads':component));
  costEvidence.coverage[component]={complete:true,revision:'cost-v1',snapshotId,...scope,evidenceRef:'complete invented source manifest',sourceIds:records.map(r=>r.id)};
 }
 return {version:'profit-evidence-v1',snapshotId,scope,sales:{snapshotId,value:sales},costEvidence};
}
