/** Pure London clock gate. Importing this module has no provider or DB effects. */
const londonClock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hourCycle:'h23',hour:'2-digit',minute:'2-digit'});
export function xeroCronWindow(now){
 if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))return Object.freeze({state:'skipped',reason:'invalid_clock'});
 const parts=Object.fromEntries(londonClock.formatToParts(now).map(part=>[part.type,part.value]));
 return parts.hour==='02'&&Number(parts.minute)<15?Object.freeze({state:'admitted'}):Object.freeze({state:'skipped',reason:'outside_london_refresh_window'});
}
/** Only tests inject the action/clock. Actual CLI supplies new Date() and a lazy import.
 * Dispatch is not a statement that collection succeeded; the existing runner owns
 * configuration, scope, disabled/empty-period checks, reservations and receipts. */
export async function runXeroDailyCron({now,run}={}){
 const gate=xeroCronWindow(now);
 if(gate.state!=='admitted')return gate;
 if(typeof run!=='function')throw Error('Xero cron action unavailable');
 await run();
 return Object.freeze({state:'dispatched'});
}
