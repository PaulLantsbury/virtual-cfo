/**
 * Staging-only retained Xero OAuth primitives.
 *
 * This module never reads process.env, writes a database, logs provider output,
 * or returns access tokens from its public completion boundary.  A trusted
 * server composes it with the one-shot state guard, token exchange, tenant
 * discovery, encryption and persistence ports.
 */
import {createAuthorization,createSingleUseStateGuard,XERO_READ_SCOPES} from './read-only-oauth.mjs';

export const XERO_STAGING_RETAINED_SCOPES=Object.freeze([...XERO_READ_SCOPES,'offline_access']);
const tokenEndpoint='https://identity.xero.com/connect/token';
const connectionsEndpoint='https://api.xero.com/connections';
const unavailable=()=>Error('Xero staging consent unavailable');
const id=value=>typeof value==='string'&&/^[0-9a-f-]{20,}$/i.test(value);
const secret=value=>typeof value==='string'&&value.length>=24&&value.length<=2048;
const code=value=>typeof value==='string'&&value.length>=8&&value.length<=4096;

/** Validate a private configuration object assembled by the staging host. */
export function readStagingRetainedXeroConfig({enabled,clientId,clientSecret,redirectUri}={}){
 if(enabled!=='true')return undefined;
 if(!id(clientId)||!secret(clientSecret)||redirectUri!=='http://localhost:3000/xero/callback')throw unavailable();
 return Object.freeze({clientId,clientSecret,redirectUri,scopes:XERO_STAGING_RETAINED_SCOPES});
}

/** Issues and consumes signed, in-memory, one-use consent states. */
export function createStagingRetainedStateGuard({stateKey,now}={}){
 const guard=createSingleUseStateGuard({stateKey,now});
 return Object.freeze({
  issue(config,options={}){
   if(!validConfig(config))throw unavailable();
   // Explicitly pin the extended scope list.  Generic/local OAuth configs are
   // never upgraded implicitly to a retained grant.
   return guard.issue(config,options);
  },
  consume(state,options={}){return guard.consume(state,options);},
 });
}

/**
 * Exchanges a single authorisation code and discovers exactly one tenant.
 * It is a private port for the consent bootstrap; callers must immediately
 * envelope the returned refresh credential and must never return this object
 * from a route or write it to an audit/event.
 */
export async function exchangeStagingRetainedCode({authorizationCode,config,fetchImpl=fetch}={}){
 if(!code(authorizationCode)||!validConfig(config)||typeof fetchImpl!=='function')throw unavailable();
 let accessToken;
 try{
  const response=await fetchImpl(tokenEndpoint,{method:'POST',redirect:'error',headers:{authorization:`Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:authorizationCode,redirect_uri:config.redirectUri}).toString()});
  if(!response?.ok)throw unavailable();
  const token=await response.json();
  if(typeof token?.access_token!=='string'||token.access_token.length<16||typeof token?.refresh_token!=='string'||token.refresh_token.length<16||typeof token?.expires_in!=='number'||!Number.isFinite(token.expires_in)||token.expires_in<=0)throw unavailable();
  accessToken=token.access_token;
  const connected=await fetchImpl(connectionsEndpoint,{headers:{authorization:`Bearer ${accessToken}`},redirect:'error'});
  if(!connected?.ok)throw unavailable();
  const rows=await connected.json();
  if(!Array.isArray(rows)||rows.length!==1||typeof rows[0]?.tenantId!=='string'||!rows[0].tenantId)throw unavailable();
  return Object.freeze({tenantId:rows[0].tenantId,refreshCredential:token.refresh_token});
 }catch{throw unavailable();}finally{accessToken=undefined;}
}

/** Return an authorisation URL only after a caller has explicitly selected the staging retained flow. */
export function createStagingRetainedAuthorization(config,{stateKey,now,nonce}={}){
 if(!validConfig(config))throw unavailable();
 try{return createAuthorization(config,{stateKey,now,nonce});}catch{throw unavailable();}
}
function validConfig(value){return value!==null&&typeof value==='object'&&Object.keys(value).sort().join(',')==='clientId,clientSecret,redirectUri,scopes'&&id(value.clientId)&&secret(value.clientSecret)&&value.redirectUri==='http://localhost:3000/xero/callback'&&Array.isArray(value.scopes)&&value.scopes.length===XERO_STAGING_RETAINED_SCOPES.length&&value.scopes.every((scope,index)=>scope===XERO_STAGING_RETAINED_SCOPES[index]);}
