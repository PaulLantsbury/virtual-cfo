import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import {demoIntakeWindow} from './demo-intake-window.mjs';
import {readDemoReaderConfig} from './demo-config.mjs';import {createDemoRefreshJob} from './demo-refresh.mjs';import {createDemoConnectionPreflight} from './demo-preflight.mjs';import {createDemoQueryPort} from './demo-query-port.mjs';
const fail=()=>Error('Demo reader execution unavailable');
export async function executeDemoReader({env=process.env,operation='refresh',createPool,fetchImpl=fetch,clock=()=>new Date()}={}){
 let pool;
 try{
  if(env.NIGHT_SCOUT_DEMO_XERO_REFRESH_ENABLED!=='true')return {event:'demo_xero_reader',state:'disabled'};
  const intake=demoIntakeWindow(clock());if(intake.state!=='admitted')return {event:'demo_xero_reader',...intake};
  if(!['refresh','preflight'].includes(operation))throw fail();readDemoReaderConfig(env,clock);
  const factory=createPool??(config=>{const require=createRequire(new URL('./demo-reader.manifest.json',import.meta.url));const {Pool}=require('pg');return new Pool(config);});
  pool=factory({connectionString:env.NIGHT_SCOUT_DEMO_XERO_DATABASE_URL,ssl:{ca:env.NIGHT_SCOUT_DEMO_XERO_CA_PEM,rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:15000});pool.on('error',()=>{});
  const query=createDemoQueryPort(pool),make=operation==='refresh'?createDemoRefreshJob:createDemoConnectionPreflight;
  return await make({env,query,fetchImpl,clock})();
 }catch{throw fail();}finally{try{await pool?.end();}catch{throw fail();}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{process.stdout.write(JSON.stringify(await executeDemoReader({clock:()=>new Date()}))+'\n');}catch{process.stderr.write('Demo reader execution unavailable\n');process.exitCode=1;}}
