import {createStagingXeroRefreshJob} from './xero-refresh-runtime.mjs';
import {readStagingXeroWorkerConfig} from './xero-worker.mjs';
import {createRequire} from 'node:module';
const failure='Xero staging worker unavailable';
let pool;
try {
 if(process.env.NIGHT_SCOUT_XERO_STAGING_REFRESH_ENABLED!=='true'){
  process.stdout.write('{"state":"disabled"}\n');
  process.exitCode=0;
 } else {
 const config=readStagingXeroWorkerConfig(process.env);
 // pg is owned by the database workspace. Resolve it from that package rather
 // than relying on a root-level symlink that filtered production installs do
 // not create consistently across hosts.
 const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));
 const pg=require('pg');
 pool=new pg.Pool({connectionString:process.env.NIGHT_SCOUT_INTAKE_DATABASE_URL,ssl:{ca:process.env.NIGHT_SCOUT_STAGING_CA_PEM,rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:15000});
 const job=createStagingXeroRefreshJob({query:(sql,params)=>pool.query(sql,params)});
 const result=await job();
 process.stdout.write(JSON.stringify(result)+'\n');
 }
} catch { process.stderr.write(`${failure}\n`); process.exitCode=1; }
finally { try { await pool?.end(); } catch { process.exitCode=1; } }
