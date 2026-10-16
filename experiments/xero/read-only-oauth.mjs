import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

export const XERO_REDIRECT_URI='http://localhost:3000/xero/callback';
export const XERO_READ_SCOPES=Object.freeze([
 'accounting.settings.read',
 'accounting.reports.profitandloss.read','accounting.reports.balancesheet.read','accounting.reports.trialbalance.read','accounting.reports.banksummary.read',
]);
const authorize='https://login.xero.com/identity/connect/authorize',id=/^[0-9a-f-]{20,}$/i;
const invalid=()=>{throw Error('Xero test configuration is invalid');};
export function readXeroTestConfig(input={}){
 const {enabled,clientId,clientSecret,redirectUri}=input;
 if(enabled!=='true')return undefined;
 if(typeof clientId!=='string'||!id.test(clientId)||typeof clientSecret!=='string'||clientSecret.length<24||clientSecret.length>2048||redirectUri!==XERO_REDIRECT_URI)invalid();
 return Object.freeze({clientId,clientSecret,redirectUri,scopes:XERO_READ_SCOPES});
}
export function createAuthorization(config,{now=Date.now(),nonce=randomBytes(24).toString('base64url'),stateKey}={}){
 if(!config||typeof stateKey!=='string'||stateKey.length<32||!Number.isSafeInteger(now)||typeof nonce!=='string'||nonce.length<20)throw Error('Xero authorisation setup is invalid');
 const expires=now+10*60_000,body=`${expires}.${nonce}`,signature=createHmac('sha256',stateKey).update(body).digest('base64url'),state=`${body}.${signature}`;
 const url=new URL(authorize);url.searchParams.set('response_type','code');url.searchParams.set('client_id',config.clientId);url.searchParams.set('redirect_uri',config.redirectUri);url.searchParams.set('scope',config.scopes.join(' '));url.searchParams.set('state',state);
 return Object.freeze({url:url.toString(),state});
}
export function verifyAuthorizationState(state,{now=Date.now(),stateKey}={}){
 if(typeof state!=='string'||typeof stateKey!=='string'||stateKey.length<32||!Number.isSafeInteger(now))return false;
 const [expires,nonce,signature,...extra]=state.split('.');if(extra.length||!/^\d+$/.test(expires)||!nonce||!signature)return false;
 const expected=createHmac('sha256',stateKey).update(`${expires}.${nonce}`).digest('base64url');
 const supplied=Buffer.from(signature),known=Buffer.from(expected);
 return supplied.length===known.length&&timingSafeEqual(supplied,known)&&Number(expires)>=now;
}

/** Keeps signed authorisation states one-time-use in the local consent process. */
export function createSingleUseStateGuard({stateKey,now=()=>Date.now()}={}){
 if(typeof stateKey!=='string'||stateKey.length<32||typeof now!=='function')throw Error('Xero authorisation setup is invalid');
 const issued=new Map();
 return Object.freeze({
  issue(config,options={}){
   const made=createAuthorization(config,{...options,now:options.now??now(),stateKey});
   issued.set(made.state,Number(made.state.split('.',1)[0]));
   return made;
  },
  consume(state,{at=now()}={}){
   const expires=issued.get(state);
   if(!Number.isSafeInteger(expires)||expires<at||!verifyAuthorizationState(state,{now:at,stateKey}))return false;
   issued.delete(state);
   for(const [candidate,candidateExpiry] of issued)if(candidateExpiry<at)issued.delete(candidate);
   return true;
  },
 });
}
