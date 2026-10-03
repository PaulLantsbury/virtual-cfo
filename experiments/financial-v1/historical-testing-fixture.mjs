// Pure, invented fixture preparation only: no database, network or source writes.
// This identifier is deliberately not an installed store or staging membership.
import {acceptanceInput} from './cfo-acceptance-fixture.mjs';
export const HISTORICAL_STORE = 'synthetic-historical-proposal-v1';
export const PERIODS = Object.freeze([
  ['2025-08',2,31],['2025-09',3,30],['2025-10',3,31],['2025-11',4,30],
  ['2025-12',5,31],['2026-01',2,31],['2026-02',2,28],['2026-03',3,31],
  ['2026-04',3,30],['2026-05',3,31],['2026-06',4,30],['2026-07',4,31],
  ['2026-08',4,31],['2026-09',2,17],
].map(Object.freeze));
const blockDays = ['05','15','20','24','27'];
const scopeFor = (month,to) => ({storeId:HISTORICAL_STORE,currency:'GBP',from:`${month}-01`,to:`${month}-${String(to).padStart(2,'0')}`});
// All scheduled fixture dates are clear of the March/October transition days.
const offsetFor = month => month >= '2025-11' && month <= '2026-03' ? '+00:00' : '+01:00';
const proof = {storeId:HISTORICAL_STORE,currency:'GBP',basis:'actual',evidenceRef:'invented historical source document; synthetic only',sourceRevision:'v1',observedRevision:'v1'};

export function historicalManifest() {
  const orders=[], lines=[], actions=[], expenses=[];
  const templates=acceptanceInput().mapped.orders.slice(0,3);
  for (const [month,blocks,to] of PERIODS) {
    for (let block=1;block<=blocks;block++) {
      for (let index=0;index<3;index++) {
        const type='abc'[index], id=`history-${month}-${block}-${type}`;
        const day=`${month}-${blockDays[block-1]}`;
        const occurredAt=`${day}T${10+index}:00:00${offsetFor(month)}`;
        orders.push({...templates[index],store_id:HISTORICAL_STORE,id,day,occurredAt,synthetic:true});
        lines.push({...proof,id:`line-${id}`,orderId:id,soldOn:day,quantity:type==='b'?2:1,unitCostPence:[4000,1500,2000][index],originalEligible:true,landedCostSupported:true});
        actions.push({id:`sale:${id}`,kind:'invented-original-sale',sourceId:id,occurredAt,synthetic:true});
      }
      for (const [category,amountPence] of [['variableCosts',1200],['advertising',2300]]) {
        const id=`${month}-${block}-${category}`;
        expenses.push({...proof,id,sourceId:`document-${id}`,...scopeFor(month,to),category,amountPence,daPence:null});
      }
    }
    if (to!==17) {
      const id=`${month}-overheads`;
      expenses.push({...proof,id,sourceId:`document-${id}`,...scopeFor(month,to),category:'overheads',amountPence:3000,daPence:600});
    }
  }
  const base={store_id:HISTORICAL_STORE,currency:'GBP',mapping_state:'verified',synthetic:true};
  const refunds=[
    {...base,id:'history-refund-a',order_id:'history-2026-02-1-a',day:'2026-02-20',occurredAt:'2026-02-20T13:00:00+00:00',product_cash:'24',product_vat:'4',shipping_cash:'1.20',shipping_vat:'0.20',amount:'25.20'},
    {...base,id:'history-refund-b',order_id:'history-2026-02-1-b',day:'2026-03-05',occurredAt:'2026-03-05T13:00:00+00:00',product_cash:'36',product_vat:'6',shipping_cash:'0',shipping_vat:'0',amount:'36'},
  ];
  const recoveries=[{...proof,id:'history-recovery-b',lineId:'line-history-2026-02-1-b',recoveryOn:'2026-04-05',quantity:1,status:'saleable',occurredAt:'2026-04-05T13:00:00+01:00'}];
  expenses.push({...proof,id:'2026-03-return-handling',sourceId:'document-return-handling',...scopeFor('2026-03',31),category:'variableCosts',amountPence:400,daPence:null});
  for(const r of refunds) actions.push({id:`refund:${r.id}`,kind:'invented-refund',sourceId:r.id,originalOrderId:r.order_id,occurredAt:r.occurredAt,synthetic:true});
  actions.push({id:'recovery:history-recovery-b',kind:'invented-saleable-recovery',sourceId:'history-recovery-b',originalOrderId:'history-2026-02-1-b',occurredAt:recoveries[0].occurredAt,synthetic:true});
  return {version:'historical-testing-proposal-v1',synthetic:true,status:'prepared-only',storeId:HISTORICAL_STORE,currency:'GBP',timezone:'Europe/London',frozenAt:'2026-09-17T23:59:59+01:00',orders,refunds,lines,recoveries,expenses,actions};
}

export function historicalInput(month, {throughDay, excludedTestOrder=false}={}) {
  const period=PERIODS.find(p=>p[0]===month);
  if(!period) throw new Error('Unreviewed fixture month');
  const to=throughDay??period[2];
  if(to!==period[2] && !(month==='2025-09' && to===17)) throw new Error('Unreviewed fixture comparison scope');
  const scope=scopeFor(month,to), manifest=historicalManifest();
  // Retain original-order links for later refunds, including cross-month links.
  const orders=manifest.orders;
  if(excludedTestOrder) orders.push({...acceptanceInput().mapped.orders[3],store_id:HISTORICAL_STORE,id:`excluded-test-${month}`,day:`${month}-06`,synthetic:true});
  return {scope,manifest,mapped:{orders,refunds:manifest.refunds,coverage:[{store_id:HISTORICAL_STORE,currency:'GBP',date_from:scope.from,date_to:scope.to,sales_and_refunds_complete:true,evidence_ref:'complete invented source manifest; no live attestation'}]}};
}

export function historicalCosts(scope,sales) {
  if(scope?.storeId!==HISTORICAL_STORE || scope.currency!=='GBP') throw new Error('Synthetic scope required');
  const reviewed=PERIODS.some(([month,,to])=>{
    const expected=scopeFor(month,to);
    return scope.from===expected.from && scope.to===expected.to;
  }) || (scope.from==='2025-09-01' && scope.to==='2025-09-17');
  if(!reviewed) throw new Error('Unreviewed fixture cost scope');
  const manifest=historicalManifest(),snapshotId=`historical-synthetic:${scope.from}:${scope.to}`;
  const lines=manifest.lines.filter(l=>l.soldOn<=scope.to);
  const recoveries=manifest.recoveries.filter(r=>r.recoveryOn<=scope.to);
  const expenses=manifest.expenses.filter(e=>e.from===scope.from && e.to===scope.to);
  const costEvidence={snapshotId,revision:'history-v1',lines,recoveries,expenses,coverage:{}};
  const complete=scope.to!=='2026-09-17' && scope.to!=='2025-09-17';
  for(const component of ['productCosts','recoveries','variableCosts','advertising','overheads','da']) {
    const records=component==='productCosts'?lines:component==='recoveries'?recoveries:expenses.filter(e=>e.category===(component==='da'?'overheads':component));
    costEvidence.coverage[component]={complete,revision:'history-v1',snapshotId,...scope,evidenceRef:'invented monthly source manifest; no live attestation',sourceIds:records.map(r=>r.id)};
  }
  return {version:'profit-evidence-v1',snapshotId,scope,sales:{snapshotId,value:sales},costEvidence};
}
