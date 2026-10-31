import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { shopifyOrderPlan, xeroInvoicePlan, executeProviderWrite } from './provider-write-plan.mjs';
import { createProviderTransport } from './provider-transport.mjs';
import { createRpcLedger } from './provider-rpc-ledger.mjs';
import { mintShopifyWriterToken } from './shopify-writer-token.mjs';

import {validWriterDatabaseIdentity} from './writer-database-identity.mjs';
export {validWriterDatabaseIdentity} from './writer-database-identity.mjs';

export function prepareBoundedProgramme(config) {
  const allowed = new Set(['provider','target','startMonday','programmeKey','contactId','accountCode','financialMode','scheduleProfile']);
  if (!config || Object.keys(config).some(k=>!allowed.has(k)) || !['shopify','xero'].includes(config.provider) || !/^[A-Za-z0-9_-]{1,64}$/.test(config.programmeKey)) throw new Error('Invalid programme');
  if (config.financialMode!==undefined && (config.provider!=='xero' || !['draft_only','posted_demo_only'].includes(config.financialMode))) throw new Error('Invalid financial mode');
  const start = new Date(`${config.startMonday}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.startMonday) || !Number.isFinite(start.valueOf()) || start.getUTCDay() !== 1 || start.toISOString().slice(0,10) !== config.startMonday) throw new Error('Explicit Monday required');
  const daily=config.scheduleProfile==='daily-20261015-v1';
  const renewed=config.scheduleProfile==='daily-20261029-v1';
  const xeroRestart=config.scheduleProfile==='daily-xero-20261030-v1';
  if(config.scheduleProfile!==undefined && !daily && !renewed && !xeroRestart)throw new Error('Unknown schedule profile');
  if(daily && (config.startMonday!=='2026-10-12' || config.programmeKey!==`${config.provider}-staging-20261012` || (config.provider==='shopify' && config.target!=='pocketlaunchpad1.myshopify.com') || (config.provider==='xero' && config.financialMode!=='posted_demo_only')))throw new Error('Daily profile binding mismatch');
  if(renewed && (config.provider!=='shopify' || config.startMonday!=='2026-10-26' || config.programmeKey!=='shopify-staging-20261029' || config.target!=='pocketlaunchpad1.myshopify.com'))throw new Error('Renewed daily profile binding mismatch');
  if(xeroRestart && (config.provider!=='xero' || config.startMonday!=='2026-10-26' || config.programmeKey!=='xero-staging-20261030' || config.financialMode!=='posted_demo_only'))throw new Error('Xero restart binding mismatch');
  const days = xeroRestart ? [4,5,6,7,8,9,10] : renewed ? [3,4,5,6,7,8,9] : daily ? [3,4,5,6] : [0,1,5,7,8,12];
  const plans = days.map((offset, index)=> {
    const date = new Date(start.valueOf()+offset*86400000).toISOString().slice(0,10);
    const plan = config.provider === 'shopify' ? shopifyOrderPlan({kind:'create-order',route:'shopify-development',test:true,currency:'GBP',targetStore:config.target,id:`${config.programmeKey}/${date}`,amounts:{units:1,grossProductsPence:6000,productDiscountPence:0,productVatPence:0,netShippingPence:0,shippingVatPence:0}})
      : xeroInvoicePlan({target:config.target,date,amountPence:1000,contactId:config.contactId,accountCode:config.accountCode,programmeId:config.programmeKey,ordinal:daily?index+3:index+1,status:config.financialMode==='posted_demo_only'?'AUTHORISED':'DRAFT'});
    return {date,plan};
  });
  return {programmeKey:config.programmeKey,provider:config.provider,target:config.target,startMonday:config.startMonday,
    financialMode:config.financialMode ?? 'draft_only', startsAt:new Date(start.valueOf()+(xeroRestart?4:renewed?3:0)*86400000).toISOString(),endsAt:new Date(start.valueOf()+(xeroRestart?11:renewed?10:14)*86400000).toISOString(),cap:xeroRestart||renewed?7:daily?4:6,...(daily||renewed||xeroRestart?{scheduleProfile:config.scheduleProfile}:{}),plans};
}

// No credential mint/refresh is permitted before the durable profile check passes.
export async function verifyDailyProfile({pool,programme}) {
  const renewed=programme.scheduleProfile==='daily-20261029-v1';
  const xeroRestart=programme.scheduleProfile==='daily-xero-20261030-v1';
  if(xeroRestart ? programme.cap!==7 || programme.provider!=='xero' || programme.programmeKey!=='xero-staging-20261030' : renewed ? programme.cap!==7 || programme.provider!=='shopify' || programme.programmeKey!=='shopify-staging-20261029' : programme.scheduleProfile!=='daily-20261015-v1' || programme.cap!==4)throw new Error('Invalid daily profile');
  const sql=xeroRestart?'SELECT staging_test_programme.xero_daily_20261030_ready($1,$2,$3,$4) AS ready':renewed?'SELECT staging_test_programme.shopify_daily_20261029_ready($1,$2,$3,$4) AS ready':'SELECT staging_test_programme.daily_profile_ready($1,$2,$3,$4) AS ready';
  const result=await pool.query(sql,[programme.programmeKey,programme.provider,programme.target,programme.cap]);
  if(result.rows?.length!==1 || result.rows[0].ready!==true)throw new Error('Daily profile unavailable');
}

export async function main({env=process.env,now=new Date()}={}) {
  let pool;
  try {
    const programme = prepareBoundedProgramme(JSON.parse(readFileSync(env.NIGHT_SCOUT_TEST_PROGRAMME_CONFIG_FILE,'utf8')));
    if (env.NIGHT_SCOUT_TEST_PROGRAMME_ENABLED !== 'true') return {event:'provider_test_programme',state:'prepared-disabled',provider:programme.provider,actions:programme.plans.length};
    if (env.NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF !== 'bioalckltvkhlczusdvl' || env.NIGHT_SCOUT_TEST_PROGRAMME_TARGET !== programme.target || env.NIGHT_SCOUT_TEST_PROGRAMME_VERIFIED_TEST_TARGET !== 'true') throw new Error('Invalid activation');
    if(programme.financialMode==='posted_demo_only' && env.NIGHT_SCOUT_TEST_WRITER_POSTED_DEMO_APPROVED!=='true') throw new Error('Posted demo approval absent');
    const formatter = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const parts = Object.fromEntries(formatter.formatToParts(now).map(x=>[x.type,x.value]));
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    if (parts.hour !== '18' || Number(parts.minute)>14 || now.valueOf()<Date.parse(programme.startsAt) || now.valueOf()>=Date.parse(programme.endsAt)) return {event:'provider_test_programme',state:'outside-generation-window'};
    const action = programme.plans.find(p=>p.date===today);
    if (!action) return {event:'provider_test_programme',state:'no-mutation-day'};
    const require = createRequire(new URL('./operator-package.manifest.json',import.meta.url));
    const {Pool}=require('pg');
    const url = new URL(env.NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL);
    if (url.protocol!=='postgresql:' || url.search || url.hostname!=='aws-1-eu-west-1.pooler.supabase.com' || decodeURIComponent(url.username)!=='night_scout_test_writer.bioalckltvkhlczusdvl' || url.port!=='5432' || url.pathname!=='/postgres') throw new Error('Dedicated writer database required');
    pool = new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:5000});
    pool.on('error',()=>{});
    const roles=(await pool.query("SELECT rolname,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolcanlogin,rolconnlimit,session_user::text AS session_login FROM pg_catalog.pg_roles WHERE rolname IN ('night_scout_test_writer','night_scout_test_writer_service')")).rows;
    const memberships=(await pool.query("SELECT r.rolname AS role_name,u.rolname AS member_name,m.admin_option,m.inherit_option,m.set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member WHERE u.rolname IN ('night_scout_test_writer','night_scout_test_writer_service')")).rows;
    if(!validWriterDatabaseIdentity(roles,memberships))throw new Error('Unsafe writer database identity');
    const scopedPool={query:async(sql,args)=>{
      const client=await pool.connect();
      try{await client.query('BEGIN');await client.query('SET LOCAL ROLE night_scout_test_writer_service');await client.query("SET LOCAL statement_timeout='5s'");const result=await client.query(sql,args);await client.query('COMMIT');return result;}
      catch{await client.query('ROLLBACK').catch(()=>{});throw new Error('WRITER_DATABASE_UNAVAILABLE');}
      finally{client.release();}
    }};
    if(programme.scheduleProfile)await verifyDailyProfile({pool:scopedPool,programme});
    const ledger=createRpcLedger({pool:scopedPool,programmeKey:programme.programmeKey});
    const run=token=>executeProviderWrite({plan:action.plan,ledger,provider:createProviderTransport({provider:programme.provider,target:programme.target,token,allowPostedDemo:programme.financialMode==='posted_demo_only' && env.NIGHT_SCOUT_TEST_WRITER_POSTED_DEMO_APPROVED==='true'}),now,activation:{...programme,enabled:true,environment:'staging',projectRef:'bioalckltvkhlczusdvl',verifiedTestTarget:true}});
    const result=programme.provider==='xero' ? await (await import('./xero-writer-refresh.mjs')).withRefreshedXeroWriter({pool:scopedPool,programmeKey:programme.programmeKey,target:programme.target,
      masterKey:env.NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY,keyVersion:env.NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION,
      clientId:env.NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_ID,clientSecret:env.NIGHT_SCOUT_TEST_WRITER_XERO_CLIENT_SECRET,consume:run}) : await run(await mintShopifyWriterToken({target:programme.target,clientId:env.NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_ID,clientSecret:env.NIGHT_SCOUT_TEST_WRITER_SHOPIFY_CLIENT_SECRET}));
    return {event:'provider_test_programme',state:result.state,provider:programme.provider};
  } catch { return {event:'provider_test_programme',state:'configuration-or-provider-unavailable'}; }
  finally { await pool?.end().catch(()=>{}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await main(); console.log(JSON.stringify(result));
  if (['uncertain-stop','reconciliation-required','configuration-or-provider-unavailable'].includes(result.state)) process.exitCode=1;
}
