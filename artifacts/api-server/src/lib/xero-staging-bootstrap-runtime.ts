import {createHash,randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {createXeroEnvelopeCrypto} from './xero-staging-credential-adapter.ts';
import type {XeroBootstrapAuthenticator,XeroBootstrapIdentity,XeroBootstrapService} from '../routes/xero-staging-bootstrap.ts';

const PROJECT='bioalckltvkhlczusdvl';
const REDIRECT='https://night-scout-xero-staging.replit.app/api/xero/staging/callback';
const SCOPES=['accounting.settings.read','accounting.reports.profitandloss.read','accounting.reports.balancesheet.read','accounting.reports.trialbalance.read','accounting.reports.banksummary.read','offline_access'];
const categories=['revenue','processingFee','advertising','software','includedCash'] as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tenant=/^[0-9a-f-]{20,}$/i;
const canonical=/^[A-Za-z0-9._-]{1,128}$/;
const unavailable=()=>Error('Xero bootstrap unavailable');
type Binding=Readonly<{userId:string;storeId:string;expectedTenantId:string;expires:number}>;
type Account=Readonly<{accountId:string;accountName:string;accountType:string;accountStatus:string}>;

export type XeroStagingBootstrapRuntime=Readonly<{service:XeroBootstrapService;authenticate:XeroBootstrapAuthenticator;close():Promise<void>}>;

export function readXeroStagingBootstrapConfig(env:NodeJS.ProcessEnv){
 if(env.NIGHT_SCOUT_XERO_STAGING_BOOTSTRAP_ENABLED!=='true')return undefined;
 const clientId=env.NIGHT_SCOUT_XERO_CLIENT_ID,clientSecret=env.NIGHT_SCOUT_XERO_CLIENT_SECRET;
 const authUrl=env.NIGHT_SCOUT_REVIEW_AUTH_URL,publishableKey=env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY;
 const databaseUrl=env.NIGHT_SCOUT_XERO_BOOTSTRAP_DATABASE_URL,ca=env.NIGHT_SCOUT_STAGING_CA_PEM;
 const ownerId=env.NIGHT_SCOUT_XERO_STAGING_OWNER_ID,storeId=env.NIGHT_SCOUT_XERO_STAGING_STORE_ID;
 const expectedTenantId=env.NIGHT_SCOUT_XERO_STAGING_TENANT_ID,stateKey=env.NIGHT_SCOUT_XERO_STATE_KEY;
 const masterKey=env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY,keyVersion=env.NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION;
 const effectiveFrom=env.NIGHT_SCOUT_XERO_MAPPING_EFFECTIVE_FROM,mapping=readMapping(env.NIGHT_SCOUT_XERO_STAGING_MAPPING_JSON);
 let parsed:URL;
 try{parsed=new URL(databaseUrl??'');}catch{throw unavailable();}
 if(env.NIGHT_SCOUT_RUNTIME_ENV!=='staging'||env.NIGHT_SCOUT_XERO_STAGING_PROJECT_REF!==PROJECT||env.NIGHT_SCOUT_XERO_REDIRECT_URI!==REDIRECT
   ||!tenant.test(clientId??'')||typeof clientSecret!=='string'||clientSecret.length<24||clientSecret.length>2048
   ||authUrl!==`https://${PROJECT}.supabase.co`||typeof publishableKey!=='string'||publishableKey.length<20
   ||parsed.protocol!=='postgresql:'||parsed.hostname!==`db.${PROJECT}.supabase.co`||parsed.username!=='night_scout_xero_bootstrap_login'
   ||typeof ca!=='string'||!ca.includes('BEGIN CERTIFICATE')||!uuid.test(ownerId??'')||!uuid.test(storeId??'')||!tenant.test(expectedTenantId??'')
   ||typeof stateKey!=='string'||stateKey.length<32||typeof masterKey!=='string'||Buffer.byteLength(masterKey)<32||!canonical.test(keyVersion??'')
   ||typeof effectiveFrom!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(effectiveFrom)||!mapping)throw unavailable();
 return Object.freeze({clientId:clientId!,clientSecret,authUrl,publishableKey,databaseUrl:databaseUrl!,ca,ownerId:ownerId!,storeId:storeId!,expectedTenantId:expectedTenantId!,stateKey,masterKey,keyVersion:keyVersion!,effectiveFrom,mapping});
}

export function createXeroStagingBootstrapRuntime(env:NodeJS.ProcessEnv,deps:{fetchImpl?:typeof fetch;now?:()=>number;createPool?:(options:pg.PoolConfig)=>pg.Pool;createAuthClient?:typeof createClient}={}):XeroStagingBootstrapRuntime|undefined{
 const config=readXeroStagingBootstrapConfig(env);if(!config)return undefined;
 const fetchImpl=deps.fetchImpl??fetch,now=deps.now??Date.now;
 const pool=(deps.createPool??(options=>new pg.Pool(options)))({connectionString:config.databaseUrl,ssl:{ca:config.ca,rejectUnauthorized:true},max:1});
 const auth=(deps.createAuthClient??createClient)(config.authUrl,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const crypto=createXeroEnvelopeCrypto(config.masterKey,config.keyVersion),states=new Map<string,Binding>();
 const authenticate:XeroBootstrapAuthenticator=async authorization=>{
  const tokenValue=authorization.replace(/^Bearer\s+/i,'');const {data,error}=await auth.auth.getUser(tokenValue);
  const userId=data?.user?.id;if(error||typeof userId!=='string'||userId!==config.ownerId)throw unavailable();
  return Object.freeze({userId,isOwner:true});
 };
 const service:XeroBootstrapService=Object.freeze({
  start(identity:XeroBootstrapIdentity){
   if(!identity.isOwner||identity.userId!==config.ownerId)throw unavailable();
   const raw=randomBytes(32).toString('base64url'),key=digest(raw);states.set(key,Object.freeze({userId:identity.userId,storeId:config.storeId,expectedTenantId:config.expectedTenantId,expires:now()+600_000}));prune(states,now());
   const url=new URL('https://login.xero.com/identity/connect/authorize');url.searchParams.set('response_type','code');url.searchParams.set('client_id',config.clientId);url.searchParams.set('redirect_uri',REDIRECT);url.searchParams.set('scope',SCOPES.join(' '));url.searchParams.set('state',raw);return Object.freeze({url:url.toString()});
  },
  async complete(input){
   const key=digest(input.state),binding=states.get(key);states.delete(key);prune(states,now());
   if(!binding||binding.expires<now()||binding.userId!==config.ownerId||binding.storeId!==config.storeId||binding.expectedTenantId!==config.expectedTenantId)throw unavailable();
   let refresh='';
   try{
    const provider=await exchangeAndDiscover({code:input.code,config,fetchImpl});
    if(provider.tenantId!==binding.expectedTenantId)throw unavailable();
    refresh=provider.refreshToken;const connectionId=randomUUID();
    const envelope=crypto.encrypt(connectionId,provider.tenantId,refresh),mapping=materialiseMapping(config.mapping,provider.accounts);
    const values=[connectionId,binding.storeId,provider.tenantId,binding.userId,config.effectiveFrom,provider.retrievedAt,JSON.stringify(provider.accounts),JSON.stringify(mapping),envelope.ciphertext,envelope.encryptedDek,envelope.keyVersion,envelope.algorithm];
    const result=await pool.query('SELECT * FROM xero_v1.bootstrap_create_initial_connection($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12)',values);
    if(result.rows.length!==1||result.rows[0]?.connection_id!==connectionId)throw unavailable();
    return Object.freeze({connectionId,storeId:binding.storeId,tenantId:provider.tenantId,status:'connected'});
   }catch{throw unavailable();}finally{refresh='';}
  },
 });
 return Object.freeze({service,authenticate,close:async()=>{states.clear();await pool.end();}});
}

function readMapping(raw:string|undefined){try{const value=JSON.parse(raw??'');if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...categories].sort().join(','))return null;const out:Record<string,string[]>=Object.create(null);for(const category of categories){const ids=(value as any)[category];if(!Array.isArray(ids)||ids.length<1||ids.length>20||ids.some(id=>typeof id!=='string'||id.length<1||id.length>256))return null;out[category]=[...new Set(ids)];}return Object.freeze(out);}catch{return null;}}
function materialiseMapping(mapping:Record<string,string[]>,accounts:readonly Account[]){const active=new Set(accounts.filter(a=>a.accountStatus==='ACTIVE').map(a=>a.accountId)),used=new Set<string>(),rows:any[]=[];for(const category of categories)for(const accountId of mapping[category]){if(!active.has(accountId)||used.has(accountId))throw unavailable();used.add(accountId);rows.push(Object.freeze({category,accountId}));}return Object.freeze(rows);}
function digest(value:string){return createHash('sha256').update(value).digest('base64url');}
function prune(states:Map<string,Binding>,at:number){for(const [key,value] of states)if(value.expires<at)states.delete(key);}
async function exchangeAndDiscover({code,config,fetchImpl}:{code:string;config:any;fetchImpl:typeof fetch}){
 const tokenResponse=await fetchImpl('https://identity.xero.com/connect/token',{method:'POST',redirect:'error',headers:{authorization:`Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:REDIRECT}).toString()});
 if(!tokenResponse.ok)throw unavailable();const tokenBody:any=await tokenResponse.json();
 const accessToken=tokenBody?.access_token,refreshToken=tokenBody?.refresh_token;if(typeof accessToken!=='string'||accessToken.length<16||typeof refreshToken!=='string'||refreshToken.length<16||refreshToken.length>8192)throw unavailable();
 const connections=await fetchImpl('https://api.xero.com/connections',{redirect:'error',headers:{authorization:`Bearer ${accessToken}`}});if(!connections.ok)throw unavailable();const tenants:any=await connections.json();if(!Array.isArray(tenants)||tenants.length!==1||!tenant.test(tenants[0]?.tenantId??''))throw unavailable();
 const accountsResponse=await fetchImpl('https://api.xero.com/api.xro/2.0/Accounts',{redirect:'error',headers:{authorization:`Bearer ${accessToken}`,'xero-tenant-id':tenants[0].tenantId,accept:'application/json'}});if(!accountsResponse.ok)throw unavailable();const accountBody:any=await accountsResponse.json();if(!Array.isArray(accountBody?.Accounts)||accountBody.Accounts.length<1||accountBody.Accounts.length>1000)throw unavailable();
 const accounts=accountBody.Accounts.map((row:any)=>{const value={accountId:row.AccountID,accountName:row.Name,accountType:row.Type,accountStatus:row.Status};if(Object.values(value).some(v=>typeof v!=='string'||v.length<1||v.length>256))throw unavailable();return Object.freeze(value) as Account;});
 if(new Set(accounts.map((a:Account)=>a.accountId)).size!==accounts.length)throw unavailable();return Object.freeze({tenantId:tenants[0].tenantId,refreshToken,retrievedAt:new Date().toISOString(),accounts:Object.freeze(accounts)});
}
