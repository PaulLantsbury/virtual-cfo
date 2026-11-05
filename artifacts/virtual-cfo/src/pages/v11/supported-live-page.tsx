import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { SalesReportingPeriod } from '@/components/SalesReportingPeriod';
import { useActiveStore, useAuth } from '@/lib/auth/AuthProvider';
import { useSalesReporting } from '@/lib/analytics/useSalesReporting';
import { isFullProfitMonth } from '@/lib/analytics/useProfitReporting';
import { readProfitResponse } from '@/lib/analytics/reportingAvailability';
import { supabase } from '@/lib/supabase';
import { trustedResponseInput } from '@/lib/v11/trusted-response';
import { SupportedReportingSlice } from './supported-evidence-panel';
import type { ReportingAdapterInput } from '@/lib/v11/reporting-adapter';
import './workspace.css';

export default function SupportedLivePage({section}:{section:'scout'|'profit'}) {
 const storeId=useActiveStore(), auth=useAuth(), reporting=useSalesReporting(storeId);
 const [compare,setCompare]=useState(false);
 const config=reporting.config;
 const expected={storeId,currency:config?.currency??'',timezone:config?.timezone??'',period:{from:reporting.period.dateFrom,to:reporting.period.dateTo}};
 const prior={...expected,period:{from:reporting.prior.dateFrom,to:reporting.prior.dateTo}};
 const useReader=(scope:ReportingAdapterInput['expected'], enabled:boolean)=>useQuery({
  queryKey:['supported-v11',auth.userId,scope.storeId,scope.currency,scope.timezone,scope.period.from,scope.period.to],enabled:enabled&&!!config&&isFullProfitMonth(scope.period.from,scope.period.to),retry:false,placeholderData:undefined,
  queryFn:async({signal})=>{const {data,error}=await supabase.auth.getSession();if(error||!data.session||data.session.user.id!==auth.userId)throw new Error('Sign in again to inspect evidence.');
   const response=await fetch(`/api/profit-reporting?${new URLSearchParams({storeId:scope.storeId,currency:scope.currency,from:scope.period.from,to:scope.period.to})}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal});
   return trustedResponseInput(await readProfitResponse(response),scope);
  }
 });
 const current=useReader(expected,true), previous=useReader(prior,compare);
 const input=current.isSuccess?current.data:trustedResponseInput(null,expected);
 return <AppLayout><header><h1>{section==='scout'?'Scout’s View':'Profit Engine'} · supported evidence</h1><p>Opt-in reader slice. Cash, recommendations and broader diagnostics require their own supported evidence.</p><nav aria-label="Supported reporting pages"><Link href="/supported-v11/scout">Scout’s View</Link>{' · '}<Link href="/supported-v11/profit">Profit Engine</Link></nav></header>
 <label className="block my-3">Complete calendar month
 <input className="block border rounded p-2 bg-background" type="month" aria-describedby="supported-month-help" value={isFullProfitMonth(expected.period.from,expected.period.to)?expected.period.from.slice(0,7):''} onChange={event=>{
 const month=event.target.value;
 if(!/^\d{4}-\d{2}$/.test(month))return;
 const [year,index]=month.split('-').map(Number);
 const last=new Date(Date.UTC(year,index,0)).getUTCDate();
 reporting.setRange(`${month}-01`,`${month}-${String(last).padStart(2,'0')}`);
 }}/></label><p id="supported-month-help">Choose a month to inspect its own evidence. For the isolated synthetic company, the loaded review month is January 2025. Other stores and dates keep their own availability.</p>
 <SalesReportingPeriod reporting={reporting}/>
 <label><input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/> Compare previous completed period</label>
 {compare&&<p>Comparison: {prior.period.from||'Unavailable'} – {prior.period.to||'Unavailable'}. Custom-period comparisons are unavailable.</p>}
 {current.isFetching&&<p role="status">Checking scoped evidence…</p>}
 {!isFullProfitMonth(expected.period.from,expected.period.to)&&<p>Supported profit evidence requires one complete calendar month.</p>}
 {current.isError&&<p role="alert">Evidence could not be checked. Review connection and store access.</p>}
 <SupportedReportingSlice current={input} comparison={compare?{period:prior.period,input:previous.isSuccess?previous.data:null}:null}/>
 </AppLayout>;
}
