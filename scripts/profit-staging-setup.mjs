/** Controlled staging-only operator entry point. No automatic application. */
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setupProfitStagingFixture,PROFIT_STAGING_IDS,PROFIT_STAGING_EXPECTED} from '../experiments/financial-v1/profit-staging-fixture.mjs';
import {createProfitSalesReader} from '../experiments/financial-v1/profit-sales-reader.mjs';
import {readProfitEvidence} from '../experiments/financial-v1/profit-evidence-reader.mjs';
const project='bioalckltvkhlczusdvl';
const mode=process.argv[2]??'--plan';
const ddl=await readFile(new URL('../db-migrations/proposals/20260913_profit_evidence.sql',import.meta.url),'utf8');
const sha=createHash('sha256').update(ddl).digest('hex');
const fixtureSha=createHash('sha256').update(await readFile(new URL('../experiments/financial-v1/profit-staging-fixture.mjs',import.meta.url))).digest('hex');
if(mode==='--plan'){
 console.log(JSON.stringify({mode:'plan-only',project,schemaSha256:sha,fixtureSha256:fixtureSha,storeId:PROFIT_STAGING_IDS.store,versions:PROFIT_STAGING_IDS.versions,changes:'Five private profit tables/guard; isolated synthetic Store D and one membership for an existing approved user. No production or existing-store updates.',requires:'Separate database/access approval; verified staging connection, user ID and exact schema hash.'},null,2));
}else{
 if(!['--preflight','--apply-approved'].includes(mode))throw new Error('Use --plan, --preflight or --apply-approved');
 const url=process.env.NIGHT_SCOUT_STAGING_DATABASE_URL;
 let target;
 try{target=new URL(url??'');}catch{throw new Error('A valid private staging connection URL is required');}
 if(!['postgres:','postgresql:'].includes(target.protocol)||target.hostname!==`db.${project}.supabase.co`||target.pathname!=='/postgres'||target.search||target.hash||(target.port&&target.port!=='5432'))throw new Error('Direct Night Scout staging connection required, without query overrides');
 if(mode==='--apply-approved'&&(process.env.NIGHT_SCOUT_APPROVED_SCHEMA_SHA256!==sha||process.env.NIGHT_SCOUT_APPROVED_FIXTURE_SHA256!==fixtureSha))throw new Error('Exact approved schema and fixture hashes required');
 const require=createRequire(new URL('../lib/db/package.json',import.meta.url));
 const {Client}=require('pg');
 // Explicit fields prevent pg connection-string query options overriding target/TLS.
 const client=new Client({host:target.hostname,port:5432,database:'postgres',user:decodeURIComponent(target.username),password:decodeURIComponent(target.password),options:'',ssl:{rejectUnauthorized:true}});
 await client.connect();
 const tx={query:(...args)=>client.query(...args),exec:sql=>client.query(sql)};
 const db={transaction:async fn=>{await client.query('BEGIN');try{const result=await fn(tx);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}}};
 try{
  if(mode==='--preflight'){
   const query=await readFile(new URL('../db-migrations/proposals/profit-preflight-20260913.sql',import.meta.url),'utf8');
   const results=await client.query(query);console.log(JSON.stringify(results.filter(r=>r.rows?.length).map(r=>r.rows),null,2));
  }else{
   const userId=process.env.NIGHT_SCOUT_APPROVED_REVIEW_USER_ID;
   if(!userId)throw new Error('Existing approved reviewer user ID required');
   // Preflight is mandatory before approval. Refuse an occupied proposal/store.
   const check=await client.query("SELECT to_regclass('finance_v1.profit_evidence_versions') AS existing, EXISTS(SELECT 1 FROM public.stores WHERE id=$1) AS store_exists",[PROFIT_STAGING_IDS.store]);
   if(check.rows[0].existing||check.rows[0].store_exists)throw new Error('Proposal or Store D already present; inspect instead of replaying');
   const reader=createProfitSalesReader({userId});
   const user=await client.query('SELECT id FROM auth.users WHERE id=$1',[userId]);
   if(user.rows.length!==1)throw new Error('Approved existing reviewer not found');
   await client.query(ddl);
   await setupProfitStagingFixture(db,{userId,readSales:reader});
   for(const [i,month]of ['02','03','04'].entries()){
    const scope={storeId:PROFIT_STAGING_IDS.store,currency:'GBP',from:`2026-${month}-01`,to:`2026-${month}-${month==='02'?'28':month==='03'?'31':'30'}`};
    const result=await readProfitEvidence(db,{versionId:PROFIT_STAGING_IDS.versions[i],scope,readSales:reader});
    if(result.readError||result.result.state!=='complete')throw new Error(`Post-commit reconciliation incomplete for month ${month}; preserve fixture and investigate`);
    for(const [key,expected]of Object.entries(PROFIT_STAGING_EXPECTED[`2026-${month}`])){
     const actual=Object.hasOwn(result.result.sales,key)&&['netProductSales','netShipping','originalOrders'].includes(key)?result.result.sales[key]:result.result[key]?.value;
     if(actual!==expected)throw new Error(`Post-commit reconciliation mismatch for ${month}/${key}; preserve fixture and investigate`);
    }
    console.log(JSON.stringify({month,netProductSales:result.result.sales.netProductSales,cogs:result.result.cogs.value,operatingProfit:result.result.operatingProfit.value,ebitda:result.result.ebitda.value}));
   }
  }
 }finally{await client.end();}
}
