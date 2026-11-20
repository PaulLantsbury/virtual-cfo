import {createRequire} from 'node:module';
import {readStagingXeroWorkerConfig} from './xero-worker.mjs';
import {createStagingXeroReaderOrganisationCheck} from './xero-reader-organisation-check.mjs';
const failure='Xero reader organisation check unavailable';
let pool;
try{
 if(process.argv.length!==2)throw Error();
 // Validate the existing pinned reader configuration before constructing a pool.
 readStagingXeroWorkerConfig(process.env);
 const require=createRequire(new URL('../../lib/db/package.json',import.meta.url)),pg=require('pg');
 pool=new pg.Pool({connectionString:process.env.NIGHT_SCOUT_INTAKE_DATABASE_URL,ssl:{ca:process.env.NIGHT_SCOUT_STAGING_CA_PEM,rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000,statement_timeout:30000,idle_in_transaction_session_timeout:15000});
 const result=await createStagingXeroReaderOrganisationCheck({query:(sql,params)=>pool.query(sql,params)})();
 process.stdout.write(JSON.stringify(result)+'\n');
 if(!result.organisationVerified)process.exitCode=1;
}catch{process.stderr.write(failure+'\n');process.exitCode=1;}
finally{try{await pool?.end();}catch{process.exitCode=1;}}
