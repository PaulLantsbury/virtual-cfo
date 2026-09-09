import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {AppLayout} from '@/components/layout/AppLayout';
import {useActiveStore} from '@/lib/auth/AuthProvider';
import {supabase} from '@/lib/supabase';
import {fetchVerifiedSales} from '../../../../experiments/financial-v1/rpc-sales-adapter.mjs';

export default function VerifiedSalesPage(){
 const storeId=useActiveStore();
 const [from,setFrom]=useState('2026-08-01'),[to,setTo]=useState('2026-08-31');
 const valid=!!from&&!!to&&from<=to;
 const result=useQuery({queryKey:['verified-sales',storeId,from,to],enabled:valid,retry:false,
  queryFn:()=>fetchVerifiedSales((name,params)=>supabase.rpc(name,params),{storeId,currency:'GBP',from,to})});
 const data=result.data;
 const money=(pence:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(pence/100);
 return <AppLayout showMonitoring={false}>
  <h1 className="text-3xl font-bold mb-3">Verified sales preview</h1>
  <p className="mb-6 text-muted-foreground">Staging comparison using the agreed sales and refund rules. Only periods with complete verified evidence can be displayed.</p>
  <div className="flex flex-wrap gap-5 mb-6">
   <label>From<input className="block border rounded p-2 bg-background" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label>To<input className="block border rounded p-2 bg-background" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
  </div>
  {!valid?<p role="alert">Choose a valid reporting period.</p>:result.isPending?<p role="status">Checking verified sales…</p>:result.isError?<section role="status"><h2 className="text-xl mb-2">Verified figures unavailable</h2><p>The period’s evidence is missing, incomplete or unavailable. No estimated or legacy figures are substituted.</p></section>:data&&<section aria-live="polite">
   <p className="mb-5">{data.hasRefundActivity&&data.originalOrders===0?'This period contains refunds from earlier sales, with no new qualifying orders.':data.hasActivity?`${data.originalOrders} qualifying original order${data.originalOrders===1?'':'s'} in this period.`:'Verified coverage shows no sales or refunds in this period.'}</p>
   <dl className="grid sm:grid-cols-2 gap-4">
    {[['Gross product sales',money(data.grossProductSales)],['Product discounts',money(data.discounts)],['Product refunds',money(data.productRefundExVat)],['Net product sales',money(data.netProductSales)],['Net shipping revenue',money(data.netShipping)],['Original average order value',data.aov.value===null?'Unavailable — no qualifying original orders':money(data.aov.value)]].map(([label,value])=><div className="rounded-xl border p-4" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="text-xl mt-2">{value}</dd></div>)}
   </dl>
   <p className="mt-5 text-sm text-muted-foreground">Sales exclude VAT. Average order value uses original sales after discounts, before later refunds. Profit remains unavailable until historic product costs are verified.</p>
  </section>}
 </AppLayout>;
}
