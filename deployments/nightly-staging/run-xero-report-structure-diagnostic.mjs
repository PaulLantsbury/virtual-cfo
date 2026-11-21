import {createStagingXeroReportStructureDiagnostic} from './xero-report-structure-diagnostic.mjs';
import {createRequire} from 'node:module';
const failure='Xero staging report diagnostic unavailable';let pool;
try{
 const require=createRequire(new URL('../../lib/db/package.json',import.meta.url)),pg=require('pg');
 pool=new pg.Pool({connectionString:process.env.NIGHT_SCOUT_INTAKE_DATABASE_URL,ssl:{ca:process.env.NIGHT_SCOUT_STAGING_CA_PEM,rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:15000});
 const run=createStagingXeroReportStructureDiagnostic({query:(sql,params)=>pool.query(sql,params)});process.stdout.write(`${JSON.stringify(await run())}\n`);
}catch{process.stderr.write(`${failure}\n`);process.exitCode=1;}
finally{try{await pool?.end();}catch{process.exitCode=1;}}
