import {parseMetaSpendReport} from '../../../../experiments/marketing/meta-spend-report-contract.mjs';
import type {MetaSpendResult} from '../../../../experiments/marketing/meta-spend-report-contract.mjs';
export type {MetaSpendCoverage,MetaSpendDay,MetaSpendRange,MetaSpendResult} from '../../../../experiments/marketing/meta-spend-report-contract.mjs';
type Dependencies=Readonly<{fetcher?:typeof fetch;accessToken?:()=>Promise<string>}>
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const day=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(`${v}T00:00:00.000Z`))&&new Date(`${v}T00:00:00.000Z`).toISOString().slice(0,10)===v;
const fail=()=>new Error('Meta spend unavailable');
async function accessToken(){const {supabase}=await import('./supabase.ts');const {data,error}=await supabase.auth.getSession();const s=data.session;if(error||!s?.access_token||!s.expires_at||s.expires_at*1000<=Date.now())throw fail();return s.access_token;}
export async function fetchMetaSpendRange(storeId:string,from:string,to:string,signal?:AbortSignal,deps:Dependencies={}):Promise<MetaSpendResult>{
 if(!uuid(storeId)||!day(from)||!day(to)||from>to||(Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86_400_000>92)throw fail();
 const token=await(deps.accessToken??accessToken)();if(typeof token!=='string'||token.length<1||token.length>8192||/\s/.test(token))throw fail();
 const query=new URLSearchParams({storeId,from,to});const response=await(deps.fetcher??fetch)(`/api/meta-ads/spend?${query}`,{credentials:'include',cache:'no-store',signal,headers:{accept:'application/json',authorization:`Bearer ${token}`}});if(!response.ok)throw fail();
 return parseMetaSpendReport(await response.json(),storeId,from,to);
}

/** Return a rolling 30-day range ending yesterday in the selected Meta account timezone. */
export function accountLocalLast30Days(timeZone:string,now=new Date()):Readonly<{from:string;to:string}>{
 let parts:Record<string,string>={};try{parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));}catch{throw fail()}
 const localToday=`${parts.year}-${parts.month}-${parts.day}`;if(!day(localToday))throw fail();const end=new Date(`${localToday}T00:00:00.000Z`);end.setUTCDate(end.getUTCDate()-1);const start=new Date(end);start.setUTCDate(start.getUTCDate()-29);
 return Object.freeze({from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)});
}

/** Format exact minor units without converting a potentially large database numeric to a JS number. */
export function formatMetaSpend(minor:string,currency:string):string{
 if(!/^(0|[1-9]\d{0,29})$/.test(minor)||!/^[A-Z]{3}$/.test(currency))return 'Unavailable';
 try{const currencyFormat=new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:0});const digits=new Intl.NumberFormat('en-GB',{style:'currency',currency}).resolvedOptions().maximumFractionDigits??2;const divisor=10n**BigInt(digits);const value=BigInt(minor);const whole=value/divisor;const fraction=value%divisor;let result=currencyFormat.format(whole);if(digits){const parts=new Intl.NumberFormat('en-GB',{style:'decimal',minimumFractionDigits:digits,maximumFractionDigits:digits}).formatToParts(Number(fraction)/Number(divisor));const decimal=parts.find(p=>p.type==='decimal')?.value??'.';const fractional=parts.filter(p=>p.type==='fraction').map(p=>p.value).join('');result+=decimal+fractional;}return result;}catch{return 'Unavailable';}
}
