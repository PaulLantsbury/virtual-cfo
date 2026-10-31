import {createRequire} from 'node:module';
import {inspectCurrentXeroPeriod} from './xero-current-period-readiness.mjs';
let pool;
try{
 const result=await inspectCurrentXeroPeriod({connect:async()=>{
  const require=createRequire(new URL('../../lib/db/package.json',import.meta.url));
  const {Pool}=require('pg');
  pool=new Pool({connectionString:process.env.NIGHT_SCOUT_INTAKE_DATABASE_URL,ssl:{ca:process.env.NIGHT_SCOUT_STAGING_CA_PEM,rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:15000});
  return pool.connect();
 }});
 process.stdout.write(`${JSON.stringify(result)}\n`);
 if(result.state!=='eligible')process.exitCode=1;
}catch{process.stderr.write('Xero current-period readiness unavailable\n');process.exitCode=1;}
finally{try{await pool?.end();}catch{process.exitCode=1;}}
