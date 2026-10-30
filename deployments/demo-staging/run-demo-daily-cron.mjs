import {demoIntakeWindow} from './demo-intake-window.mjs';
import {runXeroDailyCron} from '../nightly-staging/xero-cron-window.mjs';
import {pathToFileURL} from 'node:url';
/** Tests inject clock/action; CLI always supplies actual Date and a lazy import. */
export async function runDemoDailyCron({env=process.env,now=new Date(),run}={}){
 if(env.NIGHT_SCOUT_DEMO_XERO_REFRESH_ENABLED!=='true')return {event:'demo_xero_reader',state:'disabled'};
 const intake=demoIntakeWindow(now);if(intake.state!=='admitted')return {event:'demo_xero_reader',...intake};
 let result;
 const gate=await runXeroDailyCron({now,run:async()=>{
  if(env.NIGHT_SCOUT_DEMO_XERO_PERIOD_MODE!=='daily_completed_period')throw Error('Demo daily mode required');
  const action=run??(async()=>{const {executeDemoReader}=await import('./run-demo-refresh.mjs');return executeDemoReader({env});});result=await action();
 }});
 return gate.state==='skipped'?gate:result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{process.stdout.write(JSON.stringify(await runDemoDailyCron({now:new Date()}))+'\n');}catch{process.stderr.write('Demo reader daily execution unavailable\n');process.exitCode=1;}}
