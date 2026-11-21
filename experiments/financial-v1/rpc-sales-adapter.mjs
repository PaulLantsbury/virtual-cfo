import {calculateMappedSales} from './cloud-sales-adapter.mjs';
/** Public-key/user-session RPC caller only; never a privileged client. */
export async function fetchVerifiedSales(rpc,{storeId,currency,from,to}) {
  const {data,error}=await rpc('verified_sales_source',{p_store_id:storeId,p_date_from:from,p_date_to:to});
  if(error)throw new Error('Verified sales request unavailable');
  if(!data||data.version!==1||data.storeId!==storeId||data.from!==from||data.to!==to)throw new Error('Sales response scope mismatch');
  if(!Array.isArray(data.coverage)||data.coverage.some(c=>c.date_from!==from||c.date_to!==to))throw new Error('Coverage period mismatch');
  return calculateMappedSales(data,{storeId,currency,from,to});
}
