import {recordShopifyCandidate} from './record-candidate.mjs';
import {orderFixture,detailsFixture} from './fixtures.mjs';
export async function subsequentCandidate(db,input,kind='order'){
 const source=structuredClone((await db.query('SELECT payload FROM ingest_v1.batches WHERE id=$1',[input.batchId])).rows[0].payload.source);
 if(kind==='order'){const o=orderFixture(2),d=detailsFixture(2).order;source.orders.push({...o,...d,refunds:o.refunds.map((r,i)=>({...r,...d.refunds[i]}))});}
 else{
 const o=source.orders[0];o.updatedAt='2026-04-06T12:00:00Z';
 if(kind==='refund'){const r=structuredClone(o.refunds[0]);r.id='gid://shopify/Refund/22';r.updatedAt=r.createdAt='2026-04-06T12:00:00Z';const t=r.transactions.nodes[0];t.id='gid://shopify/OrderTransaction/22';t.processedAt=r.createdAt;o.transactions.push(structuredClone(t));o.transactionsCount.count++;o.refunds.push(r);}
 }
 const result=await recordShopifyCandidate(db,{...source,status:'details_for_mapping'},source.scope);return {...input,batchId:result.batchId};
}
