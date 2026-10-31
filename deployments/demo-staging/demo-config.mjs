import {demoIntakeWindow} from './demo-intake-window.mjs';
import {DEMO_STORE_ID} from './demo-envelope-crypto.mjs';
import {planCompletedXeroPeriods} from '../nightly-staging/xero-completed-periods.mjs';
export const DEMO_PROJECT_REF='bioalckltvkhlczusdvl';
const fail=()=>Error('Demo reader configuration unavailable'),uuid=v=>typeof v==='string'&&v.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text=(v,min,max)=>typeof v==='string'&&v.length>=min&&v.length<=max&&!/[\x00-\x20\x7f]/.test(v);
export function readDemoReaderConfig(env={},clock=()=>new Date()){
 try{
  if(env.NIGHT_SCOUT_RUNTIME_ENV!=='staging'||env.NIGHT_SCOUT_DEMO_XERO_REFRESH_ENABLED!=='true'||env.NIGHT_SCOUT_DEMO_XERO_PROJECT_REF!==DEMO_PROJECT_REF||env.NIGHT_SCOUT_DEMO_XERO_STORE_ID!==DEMO_STORE_ID||env.NIGHT_SCOUT_DEMO_XERO_PERIOD_MODE!=='daily_completed_period'||env.NIGHT_SCOUT_DEMO_XERO_REPORT_FROM!==undefined||env.NIGHT_SCOUT_DEMO_XERO_REPORT_TO!==undefined||env.NIGHT_SCOUT_DEMO_XERO_CURRENCY!=='GBP'||env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw fail();
  const demoKeys=new Set(['REFRESH_ENABLED','PROJECT_REF','STORE_ID','PERIOD_MODE','CURRENCY','CLIENT_ID','CLIENT_SECRET','ENVELOPE_MASTER_KEY','ENVELOPE_KEY_VERSION','EXPECTED_TENANT_ID','DATABASE_URL','CA_PEM'].map(k=>'NIGHT_SCOUT_DEMO_XERO_'+k));
  if(Object.keys(env).some(k=>k.startsWith('NIGHT_SCOUT_DEMO_XERO_')&&!demoKeys.has(k)))throw fail();
  if(Object.keys(env).some(k=>/^NIGHT_SCOUT_(?:XERO_|INTAKE_|REVIEW_|TEST_WRITER_|TEST_PROGRAMME_)/.test(k)||k.startsWith('NIGHT_SCOUT_')&&k.includes('SHOPIFY')))throw fail();
  const client=env.NIGHT_SCOUT_DEMO_XERO_CLIENT_ID;
  if(typeof client!=='string'||!(client.length===32&&/^[0-9a-f]{32}$/i.test(client)||uuid(client))||!text(env.NIGHT_SCOUT_DEMO_XERO_CLIENT_SECRET,24,2048)||!text(env.NIGHT_SCOUT_DEMO_XERO_ENVELOPE_MASTER_KEY,32,512)||!text(env.NIGHT_SCOUT_DEMO_XERO_ENVELOPE_KEY_VERSION,1,128)||!uuid(env.NIGHT_SCOUT_DEMO_XERO_EXPECTED_TENANT_ID))throw fail();
  const url=new URL(env.NIGHT_SCOUT_DEMO_XERO_DATABASE_URL);
  if(url.protocol!=='postgresql:'||url.hostname!=='aws-1-eu-west-1.pooler.supabase.com'||decodeURIComponent(url.username)!==`night_scout_demo_import_login.${DEMO_PROJECT_REF}`||url.port!=='5432'||url.pathname!=='/postgres'||!url.password||url.search||url.hash)throw fail();
  const ca=env.NIGHT_SCOUT_DEMO_XERO_CA_PEM;if(typeof ca!=='string'||ca.length<100||ca.length>32768||!ca.startsWith('-----BEGIN CERTIFICATE-----')||!ca.includes('-----END CERTIFICATE-----'))throw fail();
  const current=clock();if(demoIntakeWindow(current).state!=='admitted')throw fail();
  const plan=planCompletedXeroPeriods(current),scope=plan.scopes.find(s=>s.purpose==='current_month_completed_days')??plan.scopes.find(s=>s.purpose==='last_complete_month');
  if(!scope)throw fail();
  return Object.freeze({projectRef:DEMO_PROJECT_REF,storeId:DEMO_STORE_ID,expectedTenantId:env.NIGHT_SCOUT_DEMO_XERO_EXPECTED_TENANT_ID,envelopeKeyVersion:env.NIGHT_SCOUT_DEMO_XERO_ENVELOPE_KEY_VERSION,scope:Object.freeze({from:scope.from,to:scope.to,currency:'GBP'})});
 }catch{throw fail();}
}
