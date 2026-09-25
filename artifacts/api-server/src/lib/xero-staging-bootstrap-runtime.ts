import {createHash,randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {createXeroEnvelopeCrypto} from './xero-staging-credential-adapter.ts';
import {isPinnedStagingDatabaseUrl} from './staging-database-target.ts';
import type {XeroBootstrapAuthenticator,XeroBootstrapIdentity,XeroBootstrapService} from '../routes/xero-staging-bootstrap.ts';

const PROJECT='bioalckltvkhlczusdvl';
const REDIRECT='https://night-scout-xero-staging.replit.app/api/xero/staging/callback';
const SCOPES=['accounting.settings.read','accounting.reports.profitandloss.read','accounting.reports.balancesheet.read','accounting.reports.trialbalance.read','accounting.reports.banksummary.read','offline_access'];
const DISCOVERY_SCOPES=['accounting.settings.read'];
const categories=['revenue','processingFee','advertising','software','includedCash'] as const;
const allowedTypes={revenue:new Set(['REVENUE','SALES']),processingFee:new Set(['OVERHEADS','EXPENSE']),advertising:new Set(['OVERHEADS','EXPENSE']),software:new Set(['OVERHEADS','EXPENSE']),includedCash:new Set(['BANK'])} as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tenant=/^[0-9a-f-]{20,}$/i;
const canonical=/^[A-Za-z0-9._-]{1,128}$/;
const unavailable=()=>Error('Xero bootstrap unavailable');
type Binding=Readonly<{phase:'bootstrap';userId:string;storeId:string;expectedTenantId:string;expectedScopes:readonly string[];expires:number}>|Readonly<{phase:'discovery';userId:string;expectedScopes:readonly string[];expires:number}>;
type Account=Readonly<{accountId:string;accountCode:string|null;accountName:string;accountType:string;accountStatus:string}>;
type Discovery=Readonly<{userId:string;expires:number;value:Readonly<{tenantId:string;tenantName:string;retrievedAt:string;accounts:readonly Account[]}>}>;

export type XeroStagingBootstrapRuntime=Readonly<{service:XeroBootstrapService;authenticate:XeroBootstrapAuthenticator;close():Promise<void>}>;

export function readXeroStagingBootstrapConfig(env:NodeJS.ProcessEnv){
 if(env.NIGHT_SCOUT_XERO_STAGING_BOOTSTRAP_ENABLED!=='true')return undefined;
 const clientId=env.NIGHT_SCOUT_XERO_CLIENT_ID,clientSecret=env.NIGHT_SCOUT_XERO_CLIENT_SECRET;
 const authUrl=env.NIGHT_SCOUT_REVIEW_AUTH_URL??env.VITE_SUPABASE_URL,publishableKey=env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY??env.VITE_SUPABASE_ANON_KEY;
 const databaseUrl=env.NIGHT_SCOUT_XERO_BOOTSTRAP_DATABASE_URL,ca=env.NIGHT_SCOUT_STAGING_CA_PEM;
 const ownerId=env.NIGHT_SCOUT_XERO_STAGING_OWNER_ID,storeId=env.NIGHT_SCOUT_XERO_STAGING_STORE_ID;
 const expectedTenantId=env.NIGHT_SCOUT_XERO_STAGING_TENANT_ID;
 const masterKey=env.NIGHT_SCOUT_XERO_ENVELOPE_MASTER_KEY,keyVersion=env.NIGHT_SCOUT_XERO_ENVELOPE_KEY_VERSION;
 const effectiveFrom=env.NIGHT_SCOUT_XERO_MAPPING_EFFECTIVE_FROM,mapping=readMapping(env.NIGHT_SCOUT_XERO_STAGING_MAPPING_JSON);
 if(env.NIGHT_SCOUT_RUNTIME_ENV!=='staging'||env.NIGHT_SCOUT_XERO_STAGING_PROJECT_REF!==PROJECT||env.NIGHT_SCOUT_XERO_REDIRECT_URI!==REDIRECT
   ||!tenant.test(clientId??'')||typeof clientSecret!=='string'||clientSecret.length<24||clientSecret.length>2048
   ||authUrl!==`https://${PROJECT}.supabase.co`||typeof publishableKey!=='string'||publishableKey.length<20
   ||!uuid.test(ownerId??'')||!uuid.test(storeId??''))throw unavailable();
 const bootstrapReady=isPinnedStagingDatabaseUrl(databaseUrl,'night_scout_xero_bootstrap_login')
   &&typeof ca==='string'&&ca.includes('BEGIN CERTIFICATE')&&tenant.test(expectedTenantId??'')&&typeof masterKey==='string'&&Buffer.byteLength(masterKey)>=32&&canonical.test(keyVersion??'')
   &&typeof effectiveFrom==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(effectiveFrom)&&!!mapping;
 return Object.freeze({clientId:clientId!,clientSecret,authUrl,publishableKey,databaseUrl:bootstrapReady?databaseUrl!:undefined,ca:bootstrapReady?ca:undefined,ownerId:ownerId!,storeId:storeId!,expectedTenantId:bootstrapReady?expectedTenantId!:undefined,masterKey:bootstrapReady?masterKey:undefined,keyVersion:bootstrapReady?keyVersion!:undefined,effectiveFrom:bootstrapReady?effectiveFrom:undefined,mapping:bootstrapReady?mapping:undefined,bootstrapReady});
}

export function createXeroStagingBootstrapRuntime(env:NodeJS.ProcessEnv,deps:{fetchImpl?:typeof fetch;now?:()=>number;createPool?:(options:pg.PoolConfig)=>pg.Pool;createAuthClient?:typeof createClient}={}):XeroStagingBootstrapRuntime|undefined{
 const config=readXeroStagingBootstrapConfig(env);if(!config)return undefined;
 const fetchImpl=deps.fetchImpl??fetch,now=deps.now??Date.now;
 const pool=config.bootstrapReady?(deps.createPool??(options=>new pg.Pool(options)))({connectionString:config.databaseUrl,ssl:{ca:config.ca,rejectUnauthorized:true},max:1}):undefined;
 const auth=(deps.createAuthClient??createClient)(config.authUrl,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const crypto=config.bootstrapReady?createXeroEnvelopeCrypto(config.masterKey!,config.keyVersion!):undefined,states=new Map<string,Binding>(),discoveries=new Map<string,Discovery>();
 const authenticate:XeroBootstrapAuthenticator=async authorization=>{
  const tokenValue=authorization.replace(/^Bearer\s+/i,'');const {data,error}=await auth.auth.getUser(tokenValue);
  const userId=data?.user?.id;if(error||typeof userId!=='string'||userId!==config.ownerId)throw unavailable();
  return Object.freeze({userId,isOwner:true});
 };
 const service:XeroBootstrapService=Object.freeze({
  start(identity:XeroBootstrapIdentity){
   if(!config.bootstrapReady||!identity.isOwner||identity.userId!==config.ownerId)throw unavailable();
   const raw=`b_${randomBytes(32).toString('base64url')}`,key=digest(raw);boundedSet(states,key,Object.freeze({phase:'bootstrap',userId:identity.userId,storeId:config.storeId,expectedTenantId:config.expectedTenantId!,expectedScopes:Object.freeze([...SCOPES]),expires:now()+600_000}),now());
   const url=new URL('https://login.xero.com/identity/connect/authorize');url.searchParams.set('response_type','code');url.searchParams.set('client_id',config.clientId);url.searchParams.set('redirect_uri',REDIRECT);url.searchParams.set('scope',SCOPES.join(' '));url.searchParams.set('state',raw);return Object.freeze({url:url.toString()});
  },
  startDiscovery(identity:XeroBootstrapIdentity){
   if(!identity.isOwner||identity.userId!==config.ownerId)throw unavailable();
   const raw=`d_${randomBytes(32).toString('base64url')}`,key=digest(raw);boundedSet(states,key,Object.freeze({phase:'discovery',userId:identity.userId,expectedScopes:Object.freeze([...DISCOVERY_SCOPES]),expires:now()+600_000}),now());
   const url=new URL('https://login.xero.com/identity/connect/authorize');url.searchParams.set('response_type','code');url.searchParams.set('client_id',config.clientId);url.searchParams.set('redirect_uri',REDIRECT);url.searchParams.set('scope',DISCOVERY_SCOPES.join(' '));url.searchParams.set('state',raw);return Object.freeze({url:url.toString()});
  },
  async complete(input){
   const key=digest(input.state),binding=states.get(key);states.delete(key);prune(states,now());
   if(!binding||binding.expires<now()||binding.userId!==config.ownerId)throw unavailable();
   if(input.scope!==undefined&&!matchesScopes(input.scope,binding.expectedScopes))throw unavailable();
   if(binding.phase==='discovery'){
    const provider=await exchangeAndDiscover({code:input.code,config,fetchImpl,requireRefresh:false});
    const handle=randomBytes(32).toString('base64url');boundedSet(discoveries,digest(handle),Object.freeze({userId:binding.userId,expires:now()+300_000,value:Object.freeze({tenantId:provider.tenantId,tenantName:provider.tenantName,retrievedAt:provider.retrievedAt,accounts:provider.accounts})}),now());
    return Object.freeze({status:'received',handle});
   }
   if(!config.bootstrapReady||binding.storeId!==config.storeId||binding.expectedTenantId!==config.expectedTenantId)throw unavailable();
   let refresh='';
   try{
    const provider=await exchangeAndDiscover({code:input.code,config,fetchImpl,requireRefresh:true});
    if(provider.tenantId!==binding.expectedTenantId)throw unavailable();
    refresh=provider.refreshToken;const connectionId=randomUUID();
    const envelope=crypto!.encrypt(connectionId,provider.tenantId,refresh),mapping=materialiseMapping(config.mapping!,provider.accounts);
    const directory=provider.accounts.map(({accountId,accountName,accountType,accountStatus})=>Object.freeze({accountId,accountName,accountType,accountStatus}));
    const values=[connectionId,binding.storeId,provider.tenantId,binding.userId,config.effectiveFrom,provider.retrievedAt,JSON.stringify(directory),JSON.stringify(mapping),envelope.ciphertext,envelope.encryptedDek,envelope.keyVersion,envelope.algorithm];
    const result=await pool!.query('SELECT * FROM xero_v1.bootstrap_create_initial_connection($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12)',values);
    if(result.rows.length!==1||result.rows[0]?.connection_id!==connectionId)throw unavailable();
    return Object.freeze({connectionId,storeId:binding.storeId,tenantId:provider.tenantId,status:'connected'});
   }catch{throw unavailable();}finally{refresh='';}
  },
  readDiscovery(identity,handle){
   if(!identity.isOwner||identity.userId!==config.ownerId)throw unavailable();const key=digest(handle),item=discoveries.get(key);discoveries.delete(key);prune(discoveries,now());
   if(!item||item.expires<now()||item.userId!==identity.userId)throw unavailable();return Object.freeze({handle,status:'ready',tenant:Object.freeze({id:item.value.tenantId,name:item.value.tenantName}),accounts:Object.freeze(item.value.accounts.map(account=>Object.freeze({id:account.accountId,code:account.accountCode,name:account.accountName,type:account.accountType,status:account.accountStatus})))});
  },
 });
 return Object.freeze({service,authenticate,close:async()=>{states.clear();discoveries.clear();if(pool)await pool.end();}});
}

function readMapping(raw:string|undefined){try{const value=JSON.parse(raw??'');if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...categories].sort().join(','))return null;const out:Record<string,string[]>=Object.create(null);for(const category of categories){const ids=(value as any)[category];if(!Array.isArray(ids)||ids.length<1||ids.length>20||ids.some(id=>typeof id!=='string'||id.length<1||id.length>256))return null;out[category]=[...new Set(ids)];}return Object.freeze(out);}catch{return null;}}
function materialiseMapping(mapping:Record<string,string[]>,accounts:readonly Account[]){const active=new Map(accounts.filter(a=>a.accountStatus==='ACTIVE').map(a=>[a.accountId,a])),used=new Set<string>(),rows:any[]=[];for(const category of categories)for(const accountId of mapping[category]){const account=active.get(accountId);if(!account||!allowedTypes[category].has(account.accountType as never)||used.has(accountId))throw unavailable();used.add(accountId);rows.push(Object.freeze({category,accountId}));}return Object.freeze(rows);}
function digest(value:string){return createHash('sha256').update(value).digest('base64url');}
function matchesScopes(raw:string,expected:readonly string[]){const values=raw.split(' ');return values.length===new Set(values).size&&values.length===expected.length&&values.slice().sort().every((value,index)=>value===[...expected].sort()[index]);}
function prune<T extends {expires:number}>(states:Map<string,T>,at:number){for(const [key,value] of states)if(value.expires<at)states.delete(key);}
function boundedSet<T extends {expires:number}>(items:Map<string,T>,key:string,value:T,at:number){prune(items,at);if(items.size>=32)throw unavailable();items.set(key,value);}
async function exchangeAndDiscover({code,config,fetchImpl,requireRefresh}:{code:string;config:any;fetchImpl:typeof fetch;requireRefresh:boolean}){
 const tokenBody:any=await requestJson(fetchImpl,'https://identity.xero.com/connect/token',{method:'POST',redirect:'error',headers:{authorization:`Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:REDIRECT}).toString()},32_768);
 const accessToken=tokenBody?.access_token,refreshToken=tokenBody?.refresh_token;if(typeof accessToken!=='string'||accessToken.length<16||(requireRefresh&&(typeof refreshToken!=='string'||refreshToken.length<16||refreshToken.length>8192)))throw unavailable();
 const tenants:any=await requestJson(fetchImpl,'https://api.xero.com/connections',{redirect:'error',headers:{authorization:`Bearer ${accessToken}`}},65_536);if(!Array.isArray(tenants)||tenants.length!==1||!tenant.test(tenants[0]?.tenantId??'')||typeof tenants[0]?.tenantName!=='string'||tenants[0].tenantName.length<1||tenants[0].tenantName.length>256)throw unavailable();
 const accountBody:any=await requestJson(fetchImpl,'https://api.xero.com/api.xro/2.0/Accounts',{redirect:'error',headers:{authorization:`Bearer ${accessToken}`,'xero-tenant-id':tenants[0].tenantId,accept:'application/json'}},1_048_576);if(!Array.isArray(accountBody?.Accounts)||accountBody.Accounts.length<1||accountBody.Accounts.length>500)throw unavailable();
 const accounts=accountBody.Accounts.map((row:any)=>{const value={accountId:row.AccountID,accountCode:row.Code==null||row.Code===''?null:row.Code,accountName:row.Name,accountType:row.Type,accountStatus:row.Status};if(typeof value.accountId!=='string'||value.accountId.length<1||value.accountId.length>256||value.accountCode!==null&&(typeof value.accountCode!=='string'||value.accountCode.length>256)||[value.accountName,value.accountType,value.accountStatus].some(v=>typeof v!=='string'||v.length<1||v.length>256))throw unavailable();return Object.freeze(value) as Account;});
 if(new Set(accounts.map((a:Account)=>a.accountId)).size!==accounts.length)throw unavailable();return Object.freeze({tenantId:tenants[0].tenantId,tenantName:tenants[0].tenantName,refreshToken:requireRefresh&&typeof refreshToken==='string'?refreshToken:'',retrievedAt:new Date().toISOString(),accounts:Object.freeze(accounts)});
}

async function requestJson(fetchImpl:typeof fetch,url:string,options:RequestInit,maxBytes:number){
 let response:Response;try{response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(10_000)});}catch{throw unavailable();}if(!response.ok||!response.body)throw unavailable();
 const declared=Number(response.headers.get('content-length'));if(Number.isFinite(declared)&&declared>maxBytes)throw unavailable();const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(value){total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw unavailable();}chunks.push(value);}}const body=Buffer.concat(chunks.map(value=>Buffer.from(value)),total).toString('utf8');return JSON.parse(body);}catch{throw unavailable();}
}
