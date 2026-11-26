import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useAuth,useActiveStore} from '@/lib/auth/AuthProvider';
import {fetchMetaAdsStatus,type MetaConnection} from '@/lib/metaAdsApi';
import {accountLocalLast30Days,fetchMetaSpendRange,formatMetaSpend,type MetaSpendCoverage} from '@/lib/metaAdsSpendApi';

const coverageLabel:Record<MetaSpendCoverage,string>={provider_row:'Reported by Meta',no_row:'No provider row',partial:'Partial coverage',failed:'Collection failed',not_collected:'Not collected'};
type ActiveMetaConnection=MetaConnection&{accountId:string;currency:string;timeZone:string};
const isActiveConnection=(value:MetaConnection):value is ActiveMetaConnection=>value.status==='connected'&&!!value.accountId&&!!value.currency&&!!value.timeZone;
// A provider date is already a calendar date in the ad account timezone; format
// its components in UTC so extreme account offsets cannot shift the label.
const localDate=(value:string,_timeZone:string)=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const observedTime=(value:string|null,timeZone:string)=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone}).format(new Date(value)):'Not recorded';
function earliestMetaDate(timeZone:string){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
 const today=`${parts.year}-${parts.month}-${parts.day}`;if(!validDay(today))return '';
 const d=new Date(`${today}T00:00:00.000Z`),dayOfMonth=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-37);
 const lastDay=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(dayOfMonth,lastDay));return d.toISOString().slice(0,10);
}
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))&&new Date(`${value}T00:00:00.000Z`).toISOString().slice(0,10)===value;
function validateRange(from:string,to:string,earliestDate:string,lastCompletedDay:string){
 if(!validDay(from)||!validDay(to))return 'Enter a valid start and end date.';
 if(from<earliestDate)return 'Meta Ads Insights supports dates within the last 37 months.';
 if(from>to)return 'The start date must be on or before the end date.';
 const count=(Date.parse(`${to}T00:00:00.000Z`)-Date.parse(`${from}T00:00:00.000Z`))/86_400_000+1;
 if(count>93)return 'Choose a period of 93 days or fewer.';
 if(to>lastCompletedDay)return 'Choose an end date no later than yesterday in the Meta account timezone.';
 return '';
}

export function MetaDailySpendPanel(){
 const storeId=useActiveStore(),auth=useAuth();
 const status=useQuery({queryKey:['meta-ads-status',auth.userId,storeId,auth.revision],enabled:auth.status==='ready'&&!!auth.userId,retry:false,refetchOnWindowFocus:false,queryFn:()=>fetchMetaAdsStatus(storeId)});
 const active=status.data?.connections.find(isActiveConnection)??null;
 const defaultPeriod=useMemo(()=>active?.timeZone?accountLocalLast30Days(active.timeZone):null,[active?.timeZone]);
 const earliestDate=useMemo(()=>active?.timeZone?earliestMetaDate(active.timeZone):'', [active?.timeZone]);
 const [appliedPeriod,setAppliedPeriod]=useState<{from:string;to:string}|null>(null);
 const [draftFrom,setDraftFrom]=useState(''),[draftTo,setDraftTo]=useState(''),[rangeError,setRangeError]=useState('');
 useEffect(()=>{
  setAppliedPeriod(null);setRangeError('');setDraftFrom(defaultPeriod?.from??'');setDraftTo(defaultPeriod?.to??'');
 },[active?.connectionId,defaultPeriod?.from,defaultPeriod?.to]);
 const period=appliedPeriod??defaultPeriod;
 const spend=useQuery({queryKey:['meta-ads-daily-spend',auth.userId,storeId,auth.revision,active?.connectionId,period?.from,period?.to],enabled:auth.status==='ready'&&!!auth.userId&&!!active&&!!period,retry:false,refetchOnWindowFocus:false,queryFn:({signal})=>fetchMetaSpendRange(storeId,period!.from,period!.to,signal)});
 const reportedDays=spend.data?.status==='available'?spend.data.days.filter(d=>d.coverageState==='provider_row'&&d.spendMinor!==null):[];
 const reportedSubtotal=reportedDays.reduce((sum,d)=>sum+BigInt(d.spendMinor!),0n).toString();
 const loadPeriod=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!defaultPeriod)return;
  const error=validateRange(draftFrom,draftTo,earliestDate,defaultPeriod.to);setRangeError(error);
  if(!error)setAppliedPeriod({from:draftFrom,to:draftTo});
 };
 const resetPeriod=()=>{setAppliedPeriod(null);setRangeError('');setDraftFrom(defaultPeriod?.from??'');setDraftTo(defaultPeriod?.to??'');};

 return <section aria-label="Meta daily ad spend" className="mb-8 rounded-2xl border bg-card p-5 sm:p-6 space-y-4">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-semibold">Meta ad spend</h2><p className="mt-1 text-sm text-muted-foreground">Daily platform-reported spend for the selected account. Dates follow that account’s timezone.</p></div>{active&&<a href="/settings" className="text-sm font-medium text-primary underline underline-offset-4">Manage connection</a>}</div>
  {status.isPending?<p role="status" className="text-sm text-muted-foreground">Checking the Meta account connection…</p>:status.isError?<div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">Meta spend is unavailable because the connection status could not be confirmed. No spend amount is inferred.</div>:!active?<div role="status" className="rounded-xl border p-4 text-sm text-muted-foreground">No connected Meta ad account is available for this store. Connect an account in <a className="font-medium text-primary underline underline-offset-4" href="/settings">Settings</a> to see daily spend.</div>:<>
   <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-muted/40 p-3 text-sm"><span><span className="text-muted-foreground">Account</span> {active.accountId}</span><span><span className="text-muted-foreground">Currency</span> {active.currency}</span><span><span className="text-muted-foreground">Timezone</span> {active.timeZone}</span></div>
   <form className="rounded-xl border p-4 space-y-3" onSubmit={loadPeriod}>
    <div><h3 className="font-medium">Choose a reporting period</h3><p className="text-xs text-muted-foreground">Dates follow the ad account timezone. Choose completed dates only, up to 93 days, within Meta’s 37-month Insights history window. Results update when you load the period.</p></div>
    <div className="flex flex-wrap items-end gap-3">
     <div className="space-y-1"><label htmlFor="meta-spend-from" className="block text-sm">From</label><input id="meta-spend-from" type="date" value={draftFrom} min={earliestDate||undefined} max={defaultPeriod?.to} onChange={event=>{setDraftFrom(event.target.value);setRangeError('');}} className="rounded-lg border bg-background px-3 py-2 text-sm" disabled={!defaultPeriod}/></div>
     <div className="space-y-1"><label htmlFor="meta-spend-to" className="block text-sm">To</label><input id="meta-spend-to" type="date" value={draftTo} max={defaultPeriod?.to} onChange={event=>{setDraftTo(event.target.value);setRangeError('');}} className="rounded-lg border bg-background px-3 py-2 text-sm" disabled={!defaultPeriod}/></div>
     <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={!draftFrom||!draftTo||!defaultPeriod}>Load period</button>
     {appliedPeriod&&<button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={resetPeriod}>Use latest 30 days</button>}
    </div>
    {rangeError&&<p role="alert" className="text-sm text-destructive">{rangeError}</p>}
   </form>
   {spend.isPending?<p role="status" className="text-sm text-muted-foreground">Loading the selected completed account-local period…</p>:spend.isError?<div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">Daily Meta spend could not be loaded. No spend amount is inferred.</div>:spend.data.status!=='available'?<p role="status" className="rounded-xl border p-4 text-sm text-muted-foreground">No Meta spend series is available yet.</p>:<>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">Reported spend subtotal · {reportedDays.length} of {spend.data.days.length} days</p><p className="text-2xl font-semibold tabular-nums">{reportedDays.length?formatMetaSpend(reportedSubtotal,active.currency):'No spend values reported'}</p></div><p className="text-sm text-muted-foreground">Showing applied period: {localDate(spend.data.from,active.timeZone)}–{localDate(spend.data.to,active.timeZone)} · {spend.data.days.filter(d=>d.coverageState==='provider_row').length} days with a provider row</p></div>
    <div className="max-h-[28rem] overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><caption className="sr-only">Meta ad spend by account-local date</caption><thead className="sticky top-0 bg-muted text-xs uppercase tracking-wide"><tr><th scope="col" className="px-3 py-2">Date</th><th scope="col" className="px-3 py-2">Spend</th><th scope="col" className="px-3 py-2">Coverage</th><th scope="col" className="px-3 py-2">Observed</th></tr></thead><tbody>{[...spend.data.days].reverse().map(row=><tr key={row.date} className="border-t"><th scope="row" className="whitespace-nowrap px-3 py-2 font-medium">{localDate(row.date,active.timeZone)}</th><td className="whitespace-nowrap px-3 py-2 tabular-nums">{row.coverageState==='provider_row'&&row.spendMinor!==null?formatMetaSpend(row.spendMinor,active.currency):'—'}</td><td className="px-3 py-2">{coverageLabel[row.coverageState]}{row.runStatus==='partial'&&row.coverageState==='provider_row'?<span className="block text-xs text-muted-foreground">Run marked partial</span>:null}</td><td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{observedTime(row.observedAt,active.timeZone)}</td></tr>)}</tbody></table></div>
    <p className="text-xs text-muted-foreground">A dash means the source did not provide a spend value for that date; it is not treated as zero. This view reports Meta’s account-level spend only. It is not combined with Shopify sales or used to calculate CAC, ROAS, contribution or recommendations.</p>
   </>}
  </>}
 </section>;
}
