import {operatorOrigin} from './operator-origin.mjs';
const project='bioalckltvkhlczusdvl';
/** Only publishable Supabase configuration may reach this isolated sign-in page. */
export function publicOwnerAuthConfig({authUrl,publicKey}){
 if(authUrl!==`https://${project}.supabase.co`||typeof publicKey!=='string'||publicKey.length>4096)throw Error('Owner sign-in unavailable');
 let safe=/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(publicKey);
 if(!safe&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(publicKey)){
  try{const payload=JSON.parse(Buffer.from(publicKey.split('.')[1],'base64url').toString('utf8'));safe=payload.role==='anon'&&payload.ref===project;}catch{}
 }
 if(!safe)throw Error('Owner sign-in unavailable');
 return Object.freeze({authUrl,publicKey});
}

/** Dependency-free browser UI. Password goes directly to Supabase; access token is
 * transient memory only, never a URL/query, cookie, localStorage or manual input.
 */
export function operatorOwnerPage({origin,authUrl,publicKey,nonce}){
 origin=operatorOrigin(origin);
 if(typeof nonce!=='string'||!/^[A-Za-z0-9_-]{16,64}$/.test(nonce))throw Error('Owner sign-in unavailable');
 const config={...publicOwnerAuthConfig({authUrl,publicKey}),origin};
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Night Scout — isolated Xero test setup</title><style nonce="${nonce}">body{font:17px system-ui;background:#0b1829;color:#f1f5fb;max-width:640px;margin:0 auto;padding:2rem}section{background:#14273d;border:1px solid #38506a;border-radius:16px;padding:1.5rem;margin-top:1.5rem}h1{font-size:1.8rem}p{line-height:1.5}label{display:block;margin:1rem 0 .4rem}input,button{box-sizing:border-box;font:inherit;border-radius:8px;padding:.8rem;width:100%}input{background:#fff;color:#101b2a;border:1px solid #8796a8}button{cursor:pointer;background:#93d8d0;color:#10252c;border:0;margin-top:1rem;font-weight:600}button:disabled{opacity:.5;cursor:default}button.secondary{background:#344e69;color:#fff}#status{min-height:3rem}</style></head><body><h1>Isolated Xero test setup</h1><p>Owner-only setup for the separate test-data writer. This is separate from the read-only Night Scout customer app.</p><section><h2>1. Sign in as the existing owner</h2><p>Use your existing Night Scout staging email and password. Your password is sent directly to its Supabase sign-in service. No bearer token needs copying.</p><form id="signin" method="post" action="/"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required disabled><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required disabled><button id="login" type="submit" disabled>Sign in</button></form><button id="signout" type="button" class="secondary" disabled>Clear this sign-in</button></section><section><h2>2. Authorise the separate test writer</h2><p>Owner identity and store membership are checked again before opening Xero. Consent connects the approved test programme; it does not enable generation.</p><button id="connect" type="button" disabled>Continue to Xero test consent</button><p id="status" role="status" aria-live="polite">Sign in to continue. Tokens stay in this page’s memory and disappear when you leave or refresh.</p></section><noscript><p>JavaScript is required. The sign-in form stays disabled without it.</p></noscript><script nonce="${nonce}">
'use strict';
(() => {
 const config=${JSON.stringify(config).replace(/</g,'\\u003c')};
 const byId=id=>document.getElementById(id),form=byId('signin'),email=byId('email'),password=byId('password'),login=byId('login'),connect=byId('connect'),signout=byId('signout'),status=byId('status');
 let bearer='',expiresAt=0,timer=null,busy=false,revision=0;
 const clear=message=>{revision++;bearer='';expiresAt=0;if(timer!==null)clearTimeout(timer);timer=null;connect.disabled=true;signout.disabled=true;password.value='';status.textContent=message;};
 const signedIn=()=>bearer&&Date.now()<expiresAt;
 const json=async response=>{if(!response.ok)throw Error();return response.json();};
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const credentials={email:email.value.trim(),password:password.value};
  clear('Signing in…');const requestRevision=revision;busy=true;login.disabled=true;
  try{
   const data=await json(await fetch(config.authUrl+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publicKey,'Content-Type':'application/json'},body:JSON.stringify(credentials),credentials:'omit',redirect:'error',cache:'no-store'}));
   if(revision!==requestRevision||typeof data.access_token!=='string'||!data.access_token||!/^[-A-Za-z0-9._]+$/.test(data.access_token)||data.access_token.length>8192||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error();
   bearer=data.access_token;expiresAt=Date.now()+Math.min(data.expires_in,3600)*1000;
   timer=setTimeout(()=>clear('Your sign-in expired. Sign in again to continue.'),expiresAt-Date.now());
   connect.disabled=false;signout.disabled=false;form.reset();status.textContent='Signed in. Continue to Xero; owner and store access will be verified by the isolated service.';
  }catch{clear('Sign-in failed. Check your existing staging account details and try again.');}
  finally{credentials.password='';busy=false;login.disabled=false;}
 });
 signout.addEventListener('click',()=>clear('Sign-in cleared from this page. Sign in again to continue.'));
 connect.addEventListener('click',async()=>{
  if(busy)return;if(!signedIn()){clear('Your sign-in expired. Sign in again to continue.');return;}
  const requestRevision=revision;busy=true;connect.disabled=true;status.textContent='Checking owner access and preparing Xero consent…';
  try{
   const data=await json(await fetch('/api/xero/test-writer/connect',{method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:'{}',credentials:'omit',redirect:'error',cache:'no-store'}));
   if(revision!==requestRevision)throw Error();const url=new URL(data.url);
   if(url.protocol!=='https:'||url.hostname!=='login.xero.com'||url.pathname!=='/identity/connect/authorize'||url.username||url.password||url.port||url.searchParams.get('redirect_uri')!==config.origin+'/api/xero/test-writer/callback')throw Error();
   clear('Opening Xero consent…');location.assign(url.href);
  }catch{status.textContent='Could not start Xero consent. Check owner access and isolated service setup. No generation was enabled.';}
  finally{busy=false;connect.disabled=!signedIn();}
 });
 window.addEventListener('pagehide',()=>clear('Sign-in cleared.'));
 email.disabled=false;password.disabled=false;login.disabled=false;
})();
</script></body></html>`;
}
