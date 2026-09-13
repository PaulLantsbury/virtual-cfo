import {AppLayout} from '@/components/layout/AppLayout';
import {useActiveStore} from '@/lib/auth/AuthProvider';
import {useSalesReporting} from '@/lib/analytics/useSalesReporting';
import {SalesReportingPeriod} from '@/components/SalesReportingPeriod';

export default function VerifiedSalesPage(){
 const storeId=useActiveStore();
 const reporting=useSalesReporting(storeId);
 const {data,config}=reporting;
 const money=(pence:number)=>config ? new Intl.NumberFormat('en-GB',{style:'currency',currency:config.currency}).format(pence/100) : 'Unavailable';
 return <AppLayout showMonitoring={false}>
  <h1 className="text-3xl font-bold mb-3">Verified sales preview</h1>
  <p className="mb-6 text-muted-foreground">Staging comparison using the agreed sales and refund rules. Only periods with complete verified evidence can be displayed.</p>
  <SalesReportingPeriod reporting={reporting}/>
  {reporting.status==='invalid'?<p role="alert">Choose a valid reporting period.</p>:reporting.loading?<p role="status">Checking verified sales…</p>:!data?<section role="status"><h2 className="text-xl mb-2">Verified figures unavailable</h2><p>The period’s evidence is missing, incomplete or unavailable. No estimated or legacy figures are substituted.</p></section>:<section aria-label="Verified sales figures" aria-live="polite">
   <p className="mb-5">{data.hasRefundActivity&&data.originalOrders===0?'This period contains refunds from earlier sales, with no new qualifying orders.':data.hasActivity?`${data.originalOrders} qualifying original order${data.originalOrders===1?'':'s'} in this period.`:'Verified coverage shows no sales or refunds in this period.'}</p>
   <dl className="grid sm:grid-cols-2 gap-4">
    {[['Gross product sales',money(data.grossProductSales)],['Product discounts',money(data.discounts)],['Product refunds',money(data.productRefundExVat)],['Net product sales',money(data.netProductSales)],['Net shipping revenue',money(data.netShipping)],['Original average order value',data.aov.value===null?'Unavailable — no qualifying original orders':money(data.aov.value)]].map(([label,value])=><div role="group" aria-label={label} className="rounded-xl border p-4" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="text-xl mt-2">{value}</dd></div>)}
   </dl>
   <p className="mt-5 text-sm text-muted-foreground">Sales exclude VAT. Average order value uses original sales after discounts, before later refunds. Profit remains unavailable until historic product costs are verified.</p>
  </section>}
 </AppLayout>;
}
