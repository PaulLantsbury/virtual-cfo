/** Pure preview only: a reporting period does not authorize a database job. */
export function planCompletedXeroPeriods(clock = new Date()) {
 if (!(clock instanceof Date) || !Number.isFinite(clock.valueOf())) throw Error('Invalid Xero planning clock');
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(clock).map(part => [part.type, part.value]));
 const today = `${parts.year}-${parts.month}-${parts.day}`;
 const monthStart = `${parts.year}-${parts.month}-01`;
 const previousEnd = new Date(Date.parse(`${monthStart}T00:00:00Z`) - 86400000).toISOString().slice(0,10);
 const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0,10);
 const scopes = [{purpose:'last_complete_month',from:`${previousEnd.slice(0,7)}-01`,to:previousEnd,currency:'GBP'}];
 if (yesterday >= monthStart) scopes.push({purpose:'current_month_completed_days',from:monthStart,to:yesterday,currency:'GBP'});
 return Object.freeze({timezone:'Europe/London',today,applicationAuthorized:false,scopes:Object.freeze(scopes.map(scope => Object.freeze(scope)))});
}
export function skipEmptyXeroMonth(env={},clock=new Date()) {
 return env.NIGHT_SCOUT_RUNTIME_ENV==='staging'&&env.NIGHT_SCOUT_XERO_STAGING_PROJECT_REF==='bioalckltvkhlczusdvl'&&env.NIGHT_SCOUT_XERO_PERIOD_MODE==='completed_month_to_date'&&!env.NIGHT_SCOUT_XERO_REPORT_FROM&&!env.NIGHT_SCOUT_XERO_REPORT_TO&&!planCompletedXeroPeriods(clock).scopes.some(scope=>scope.purpose==='current_month_completed_days');
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
 process.stdout.write(`${JSON.stringify(planCompletedXeroPeriods())}\n`);
}
