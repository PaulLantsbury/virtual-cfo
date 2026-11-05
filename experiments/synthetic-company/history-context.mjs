/** Proposal-only fixed history edition and explicit clock semantics. */
import {addDays} from './generator.mjs';
export const HISTORY_EDITION='synthetic-history-v2-2026-11';
export const HISTORY_FORMULA='night-scout-v11-2026-10-30';
export function historyToday(now){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');}
export function historySourceAsOf(to){const next=addDays(to,1),utc=new Date(`${next}T00:00:00Z`),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hourCycle:'h23',hour:'2-digit'}).format(utc));return new Date(+utc-hour*3600000).toISOString();}
