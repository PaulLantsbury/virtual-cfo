import {runXeroDailyCron} from './xero-cron-window.mjs';
// No configurable clock, timezone or provider/DB imports before the local gate.
try{
 const result=await runXeroDailyCron({now:new Date(),run:()=>{if(process.env.NIGHT_SCOUT_XERO_PERIOD_MODE!=='daily_completed_period')throw Error('Daily mode required');return import('./run-xero-refresh.mjs');}});
 if(result.state==='skipped')process.stdout.write(`${JSON.stringify(result)}\n`);
}catch{
 process.stderr.write('Xero staging cron unavailable\n');
 process.exitCode=1;
}
