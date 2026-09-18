import {createStagingXeroRefreshJob} from './xero-refresh-runtime.mjs';
import {readStagingXeroWorkerConfig} from './xero-worker.mjs';
const failure='Xero staging worker unavailable';
let pool;
try {
 const config=readStagingXeroWorkerConfig(process.env);
 const pg=await import('pg');
 const url=new URL(process.env.NIGHT_SCOUT_INTAKE_DATABASE_URL);
 pool=new pg.default.Pool({connectionString:process.env.NIGHT_SCOUT_INTAKE_DATABASE_URL,ssl:{ca:process.env.NIGHT_SCOUT_STAGING_CA_PEM,rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:15000});
 const job=createStagingXeroRefreshJob({query:(sql,params)=>pool.query(sql,params)});
 const result=await job();
 process.stdout.write(JSON.stringify(result)+'\n');
} catch { process.stderr.write(`${failure}\n`); process.exitCode=1; }
finally { try { await pool?.end(); } catch { process.exitCode=1; } }
