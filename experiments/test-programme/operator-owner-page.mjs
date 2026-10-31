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
export function operatorOwnerPage({origin,authUrl,publicKey,ownerId,nonce,flow='writer',discoveryHandle,consentReturned=false,demoReaderReauthorization=false}){
 origin=operatorOrigin(origin);
 if(typeof nonce!=='string'||!/^[A-Za-z0-9_-]{16,64}$/.test(nonce))throw Error('Owner sign-in unavailable');
 if(typeof ownerId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId))throw Error('Owner sign-in unavailable');
 if(typeof demoReaderReauthorization!=='boolean'||demoReaderReauthorization&&flow!=='demo-reader')throw Error('Owner sign-in unavailable');
 if(typeof consentReturned!=='boolean'||consentReturned&&flow!=='demo-reader')throw Error('Owner sign-in unavailable');
 if(!['writer','demo-reader'].includes(flow)||discoveryHandle!==undefined&&(flow!=='demo-reader'||typeof discoveryHandle!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(discoveryHandle)))throw Error('Owner sign-in unavailable');
 const demo=flow==='demo-reader',config={...publicOwnerAuthConfig({authUrl,publicKey}),origin,ownerId,flow,demoReaderReauthorization,...(discoveryHandle?{discoveryHandle}:{})};
 const setupTitle=demo?'Isolated Demo reader setup':'Isolated Xero test setup';
 const mappingForm=demo?'<div id="demoMapping" hidden><p id="demoPeriod"></p><label for="demoTenant">Verified GBP Demo Company</label><select id="demoTenant"></select><label for="demoRevenue">Revenue account</label><select id="demoRevenue"></select><label for="demoProcessingFee">Processing-fee account</label><select id="demoProcessingFee"></select><label for="demoAdvertising">Advertising account</label><select id="demoAdvertising"></select><label for="demoSoftware">Software account</label><select id="demoSoftware"></select><label for="demoIncludedCash">Included bank account</label><select id="demoIncludedCash"></select><label for="demoEffective">Mapping effective from</label><input id="demoEffective" type="date" required><p>Choose distinct existing accounts. A fresh second read-only consent rechecks the same Demo Company and account choices before retaining encrypted reader credentials.</p></div>':'';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Night Scout — ${setupTitle}</title><style nonce="${nonce}">body{font:17px system-ui;background:#0b1829;color:#f1f5fb;max-width:640px;margin:0 auto;padding:2rem}section{background:#14273d;border:1px solid #38506a;border-radius:16px;padding:1.5rem;margin-top:1.5rem}h1{font-size:1.8rem}p{line-height:1.5}label{display:block;margin:1rem 0 .4rem}input,select,button{box-sizing:border-box;font:inherit;border-radius:8px;padding:.8rem;width:100%}input{background:#fff;color:#101b2a;border:1px solid #8796a8}button{cursor:pointer;background:#93d8d0;color:#10252c;border:0;margin-top:1rem;font-weight:600}button:disabled{opacity:.5;cursor:default}button.secondary{background:#344e69;color:#fff}#status{min-height:3rem}#qr{max-width:100%;background:#fff}#setupkey{display:block;overflow-wrap:anywhere;font-family:monospace;padding:.8rem;background:#0b1829}</style></head><body><h1>${setupTitle}</h1>${consentReturned?'<p role="status">Xero has returned to setup. Verify the saved Demo reader, its connection preflight and its scheduled import before treating the reader as healthy. No generation was enabled.</p>':''}<p>${demo?"Owner-only read-only connection to a separate GBP Demo Company store. This does not replace the current customer reader or enable test writes.":"Owner-only setup for the separate test-data writer. This is separate from the read-only Night Scout customer app."}</p><section><h2>1. Sign in as the existing owner</h2><p>Use your existing Night Scout staging email and password, then verify your authenticator. If you have none, you can explicitly set one up here yourself. Your password and one-time code go directly to its Supabase sign-in service. No bearer token needs copying.</p><p id="status" role="status" aria-live="polite">Sign in to continue. Tokens stay in this page’s memory and disappear when you leave or refresh.</p><form id="signin" method="post" action="/"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required disabled><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required disabled><button id="login" type="submit" disabled>Sign in</button></form><button id="enroll" type="button" class="secondary" disabled>Set up authenticator</button><div id="pendingRecovery" hidden><p>An authenticator setup was started but never verified. If you did not save its key, you can remove this unfinished setup and start again. Verified authenticators cannot be removed here.</p><label><input id="recoveryAck" type="checkbox">I want to remove only the unfinished authenticator setup.</label><button id="removePending" type="button" class="secondary" disabled>Remove unfinished authenticator</button></div><div id="enrollment" hidden><h3>Add this account to your authenticator</h3><p>This creates an authenticator for your existing account. Scan this QR code privately, or enter the setup key in your authenticator app. Do not share the QR code or key. Enter the app’s six-digit code below to finish setup.</p><img id="qr" alt="Authenticator setup QR code"><label>Manual setup key</label><output id="setupkey"></output></div><form id="mfa" method="post" action="/" hidden><label for="code">Authenticator code</label><input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required disabled><button id="verify" type="submit" disabled>Verify authenticator</button></form><button id="signout" type="button" class="secondary" disabled>Clear this sign-in</button></section><section><h2>2. ${demo?(demoReaderReauthorization?"Reconnect the existing Demo reader":"Connect the separate Demo reader"):"Authorise the separate test writer"}</h2><p>${demo?(demoReaderReauthorization?"Reconnect the same saved GBP Demo Company. Existing account choices and imported evidence are preserved. No provider records are created or changed.":"First discover a genuine GBP Demo Company and choose its accounts. Then approve a fresh retained read-only connection. No provider records are created or changed."):"Owner identity and store membership are checked again before opening Xero. Consent connects the approved test programme; it does not enable generation."}</p>${mappingForm}<button id="connect" type="button" disabled>${demo?(demoReaderReauthorization?"Reconnect existing Demo reader":discoveryHandle?"Load discovered Demo Company accounts":"Discover Demo Company accounts"):"Continue to Xero test consent"}</button></section><noscript><p>JavaScript is required. The sign-in form stays disabled without it.</p></noscript><script nonce="${nonce}">
'use strict';
(() => {
 const config=${JSON.stringify(config).replace(/</g,'\\u003c')};
 const byId=id=>document.getElementById(id),form=byId('signin'),email=byId('email'),password=byId('password'),login=byId('login'),connect=byId('connect'),signout=byId('signout'),status=byId('status'),mfa=byId('mfa'),code=byId('code'),verify=byId('verify'),enroll=byId('enroll'),enrollment=byId('enrollment'),qr=byId('qr'),setupkey=byId('setupkey'),pendingRecovery=byId('pendingRecovery'),recoveryAck=byId('recoveryAck'),removePending=byId('removePending');
 let bearer='',expiresAt=0,timer=null,busy=false,revision=0,factorId='',verified=false,pendingFactorId='';
 const demo=config.flow==='demo-reader',categories=['revenue','processingFee','advertising','software','includedCash'],controls=demo?{tenant:byId('demoTenant'),mapping:byId('demoMapping'),effective:byId('demoEffective'),period:byId('demoPeriod'),revenue:byId('demoRevenue'),processingFee:byId('demoProcessingFee'),advertising:byId('demoAdvertising'),software:byId('demoSoftware'),includedCash:byId('demoIncludedCash')}:null;
 let demoSelection=null;
 const resetDemo=()=>{demoSelection=null;if(controls){controls.mapping.hidden=true;controls.tenant.replaceChildren();for(const category of categories)controls[category].replaceChildren();controls.effective.value='';controls.period.textContent='';}};
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const eraseSetup=()=>{enrollment.hidden=true;qr.removeAttribute('src');setupkey.textContent='';};
 const clear=message=>{revision++;pendingFactorId='';pendingRecovery.hidden=true;recoveryAck.checked=false;removePending.disabled=true;eraseSetup();resetDemo();enroll.disabled=true;bearer='';expiresAt=0;factorId='';verified=false;mfa.hidden=true;code.disabled=true;verify.disabled=true;code.value='';if(timer!==null)clearTimeout(timer);timer=null;connect.disabled=true;signout.disabled=true;password.value='';status.textContent=message;};
 const signedIn=()=>bearer&&Date.now()<expiresAt;
 const adopt=(data,requestRevision)=>{if(revision!==requestRevision||typeof data.access_token!=='string'||!data.access_token||!/^[-A-Za-z0-9._]+$/.test(data.access_token)||data.access_token.length>8192||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error();bearer=data.access_token;expiresAt=Date.now()+Math.min(data.expires_in,3600)*1000;if(timer!==null)clearTimeout(timer);timer=setTimeout(()=>clear('Your sign-in expired. Sign in again to continue.'),expiresAt-Date.now());};
 const authHeaders=()=>({apikey:config.publicKey,Authorization:'Bearer '+bearer,'Content-Type':'application/json'});
 const json=async response=>{if(!response.ok)throw Error();return response.json();};
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const credentials={email:email.value.trim(),password:password.value};
  clear('Signing in…');const requestRevision=revision;busy=true;login.disabled=true;let passwordAccepted=false;
  try{
   const data=await json(await fetch(config.authUrl+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publicKey,'Content-Type':'application/json'},body:JSON.stringify(credentials),credentials:'omit',redirect:'error',cache:'no-store'}));
   adopt(data,requestRevision);passwordAccepted=true;form.reset();
   const user=await json(await fetch(config.authUrl+'/auth/v1/user',{method:'GET',headers:authHeaders(),credentials:'omit',redirect:'error',cache:'no-store'}));
   if(revision!==requestRevision||!signedIn()||user.id!==config.ownerId)throw Error();
   const factors=user.factors===undefined?[]:user.factors;
   if(!Array.isArray(factors)||factors.length>20)throw Error();
   const factor=factors.find(value=>value&&value.factor_type==='totp'&&value.status==='verified'&&uuid.test(value.id));
   if(!factor){
    const pending=factors.filter(value=>value&&value.factor_type==='totp'&&value.status==='unverified');
    if(pending.length){signout.disabled=false;enroll.disabled=true;if(pending.length===1&&uuid.test(pending[0].id)){pendingFactorId=pending[0].id;pendingRecovery.hidden=false;status.textContent='An unfinished authenticator setup exists (unfinished-factor). Use the recovery controls below to remove it yourself before starting again. Consent remains locked.';}else{status.textContent='Several unfinished authenticator setups exist. Account recovery needs review; no authenticator was removed.';}return;}
    enroll.disabled=false;signout.disabled=false;status.textContent='This owner account has no verified authenticator. You may choose Set up authenticator to create one yourself. Consent stays locked until verification.';return;
   }
   factorId=factor.id;mfa.hidden=false;code.disabled=false;verify.disabled=false;signout.disabled=false;status.textContent='Enter your existing authenticator code to complete sign-in. Consent remains locked until verification.';
  }catch{clear(passwordAccepted?'Your password was accepted, but the owner-account check did not complete. Please report this message.':'Sign-in failed. Check your existing staging account details and try again.');}
  finally{credentials.password='';busy=false;login.disabled=false;}
 });
 recoveryAck.addEventListener('change',()=>{removePending.disabled=busy||!signedIn()||!uuid.test(pendingFactorId)||recoveryAck.checked!==true;});
 removePending.addEventListener('click',async()=>{
  if(busy||removePending.disabled||recoveryAck.checked!==true||!signedIn()||!uuid.test(pendingFactorId))return;
  const requestRevision=revision,target=pendingFactorId;busy=true;removePending.disabled=true;enroll.disabled=true;login.disabled=true;status.textContent='Rechecking the unfinished authenticator before your requested removal…';
  try{
   const user=await json(await fetch(config.authUrl+'/auth/v1/user',{method:'GET',headers:authHeaders(),credentials:'omit',redirect:'error',cache:'no-store'}));
   const factors=user.factors===undefined?[]:user.factors;
   if(revision!==requestRevision||!signedIn()||user.id!==config.ownerId||!Array.isArray(factors)||factors.length>20||factors.some(value=>value&&value.factor_type==='totp'&&value.status==='verified'))throw Error();
   const pending=factors.filter(value=>value&&value.factor_type==='totp'&&value.status==='unverified');
   if(pending.length!==1||pending[0].id!==target||pendingFactorId!==target)throw Error();
   const response=await fetch(config.authUrl+'/auth/v1/factors/'+target,{method:'DELETE',headers:authHeaders(),credentials:'omit',redirect:'error',cache:'no-store'});
   if(!response.ok)throw Error();
   if(revision!==requestRevision)return;
   clear('The unfinished authenticator was removed. Sign in again, then choose Set up authenticator to create a fresh one. No new authenticator or consent was created.');
  }catch{if(revision===requestRevision)clear('Unfinished authenticator removal was not confirmed. Sign in again to inspect the current account. No automatic retry or replacement was made.');}
  finally{busy=false;login.disabled=false;}
 });
 enroll.addEventListener('click',async()=>{
  if(busy||enroll.disabled)return;if(!signedIn()){clear('Your sign-in expired. Sign in again to continue.');return;}
  const requestRevision=revision;busy=true;enroll.disabled=true;login.disabled=true;status.textContent='Preparing your authenticator setup…';let enrollmentStage='owner-check',providerCode='';
  try{
   // Recheck the fixed owner immediately before this explicit credential action.
   const user=await json(await fetch(config.authUrl+'/auth/v1/user',{method:'GET',headers:authHeaders(),credentials:'omit',redirect:'error',cache:'no-store'}));
   if(revision!==requestRevision||!signedIn()||user.id!==config.ownerId)throw Error();
   const factors=user.factors===undefined?[]:user.factors;
   if(!Array.isArray(factors)||factors.length>=20||factors.some(value=>value&&value.factor_type==='totp'&&value.status==='verified'))throw Error();
   if(factors.some(value=>value&&value.factor_type==='totp'&&value.status==='unverified')){enrollmentStage='unfinished-factor';throw Error();}
   enrollmentStage='provider-request';
   const response=await fetch(config.authUrl+'/auth/v1/factors',{method:'POST',headers:authHeaders(),body:JSON.stringify({factor_type:'totp',friendly_name:'Night Scout operator authenticator'}),credentials:'omit',redirect:'error',cache:'no-store'});
   if(!response.ok){let failure;try{failure=await response.json();}catch{}const code=failure?.code??failure?.error_code;const allowed=['mfa_totp_enroll_not_enabled','mfa_factor_name_conflict','too_many_enrolled_mfa_factors','mfa_verified_factor_exists','session_not_found','session_expired','bad_jwt','over_request_rate_limit'];if(allowed.includes(code))providerCode=code;throw Error();}
   enrollmentStage='setup-response';const data=await response.json();
   if(revision!==requestRevision||!signedIn()||data.type!=='totp'||!uuid.test(data.id)||typeof data.totp.secret!=='string'||!/^[A-Z2-7]{16,256}={0,6}$/.test(data.totp.secret))throw Error();
   factorId=data.id;const qrText=typeof data.totp?.qr_code==='string'?data.totp.qr_code.trim():'';const qrReady=qrText.length<=200000&&(/^<svg[ >]/i.test(qrText)||qrText.startsWith('<?xml')&&qrText.includes('<svg'));if(qrReady){qr.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qrText);qr.hidden=false;}else{qr.removeAttribute('src');qr.hidden=true;}setupkey.textContent=data.totp.secret;enrollment.hidden=false;mfa.hidden=false;code.disabled=false;verify.disabled=false;status.textContent=qrReady?'Scan the QR code privately, then enter your authenticator code to finish setup. Consent remains locked.':'The QR image could not be displayed. Add the manual setup key below to your authenticator, then enter its code. Consent remains locked.';
  }catch{if(revision===requestRevision)clear('Authenticator setup did not complete ('+(providerCode||enrollmentStage)+'). Sign in again to inspect your account. No automatic retry or removal was made.');}
  finally{busy=false;login.disabled=false;}
 });
 mfa.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;if(!signedIn()||!uuid.test(factorId)){clear('Your sign-in expired. Sign in again to continue.');return;}
  let oneTimeCode=code.value.trim();code.value='';if(!/^[0-9]{6}$/.test(oneTimeCode)){status.textContent='Enter the six-digit code from your authenticator.';return;}
  const requestRevision=revision;busy=true;verify.disabled=true;login.disabled=true;status.textContent='Verifying authenticator…';
  try{
   const factorPath=config.authUrl+'/auth/v1/factors/'+factorId;
   const challenge=await json(await fetch(factorPath+'/challenge',{method:'POST',headers:authHeaders(),body:'{}',credentials:'omit',redirect:'error',cache:'no-store'}));
   if(revision!==requestRevision||!signedIn()||!uuid.test(challenge.id))throw Error();
   const data=await json(await fetch(factorPath+'/verify',{method:'POST',headers:authHeaders(),body:JSON.stringify({challenge_id:challenge.id,code:oneTimeCode}),credentials:'omit',redirect:'error',cache:'no-store'}));
   adopt(data,requestRevision);eraseSetup();enroll.disabled=true;verified=true;factorId='';mfa.hidden=true;code.disabled=true;connect.disabled=false;status.textContent='Authenticator verified. Continue to Xero; the service rechecks owner identity, verified assurance and store access.';
  }catch{if(revision===requestRevision){verified=false;connect.disabled=true;status.textContent='Authenticator verification failed. Try a fresh code or sign in again. No consent was started.';}}
  finally{oneTimeCode='';code.value='';busy=false;verify.disabled=!signedIn()||verified;login.disabled=false;}
 });
 signout.addEventListener('click',()=>clear('Sign-in cleared from this page. Sign in again to continue.'));
 const option=(select,value,label)=>{const item=document.createElement('option');item.value=value;item.textContent=label;select.appendChild(item);};
 const renderAccounts=()=>{if(!demoSelection)return;const tenant=demoSelection.tenants.find(row=>row.id===controls.tenant.value),types={revenue:['REVENUE','SALES'],processingFee:['EXPENSE','OVERHEADS'],advertising:['EXPENSE','OVERHEADS'],software:['EXPENSE','OVERHEADS'],includedCash:['BANK']};for(const category of categories){const select=controls[category];select.replaceChildren();option(select,'','Choose an account');if(tenant)for(const account of tenant.accounts)if(account.status==='ACTIVE'&&types[category].includes(account.type))option(select,account.id,(account.code?account.code+' — ':'')+account.name);}};
 if(demo)controls.tenant.addEventListener('change',renderAccounts);
 connect.addEventListener('click',async()=>{
  if(busy)return;if(!signedIn()){clear('Your sign-in expired. Sign in again to continue.');return;}if(!verified){status.textContent='Verify your authenticator before continuing.';return;}
  const requestRevision=revision;busy=true;connect.disabled=true;status.textContent='Checking owner access and preparing Xero consent…';
  try{
   let path='/api/xero/test-writer/connect',body='{}',callback='/api/xero/test-writer/callback';
   if(demo){
    callback='/api/xero-demo/reader/callback';
    if(!config.demoReaderReauthorization&&config.discoveryHandle&&!demoSelection){
     const found=await json(await fetch('/api/xero-demo/reader/discovery',{method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify({handle:config.discoveryHandle}),credentials:'omit',redirect:'error',cache:'no-store'}));
     if(revision!==requestRevision||!signedIn()||!/^[-A-Za-z0-9_]{32,128}$/.test(found.selectionHandle)||!Array.isArray(found.tenants)||found.tenants.length<1||found.tenants.length>5||found.tenants.some(row=>!uuid.test(row.id)||row.isDemoCompany!==true||row.currency!=='GBP'||typeof row.name!=='string'||row.name.length>256||!Array.isArray(row.accounts)||row.accounts.length>500||row.accounts.some(account=>!uuid.test(account.id)||typeof account.name!=='string'||account.name.length>256||account.code!==null&&typeof account.code!=='string')) )throw Error();
     if(!found.period||!/^[-0-9]{10}$/.test(found.period.from)||!/^[-0-9]{10}$/.test(found.period.to)||found.period.currency!=='GBP'||found.period.timezone!=='Europe/London')throw Error();demoSelection=found;controls.effective.value=found.period.from;controls.period.textContent='Reader scope: '+found.period.from+' to '+found.period.to+' (GBP, Europe/London). Confirm that the mapping effective date covers the first day of this period. This does not request older backfill.';controls.tenant.replaceChildren();option(controls.tenant,'','Choose the verified Demo Company');for(const tenant of found.tenants)option(controls.tenant,tenant.id,tenant.name+' (GBP Demo Company)');renderAccounts();controls.mapping.hidden=false;connect.textContent='Save choices and authorise Demo reader';status.textContent='Choose the Demo Company, five distinct accounts and effective date. The next step opens a fresh read-only consent.';return;
    }
    if(config.demoReaderReauthorization)path='/api/xero-demo/reader/reauthorize';
    else if(demoSelection){const mapping={},used=new Set();for(const category of categories){const id=controls[category].value;if(!uuid.test(id)||used.has(id))throw Error();used.add(id);mapping[category]=[id];}if(!uuid.test(controls.tenant.value)||!/^[-0-9]{10}$/.test(controls.effective.value))throw Error();path='/api/xero-demo/reader/connect';body=JSON.stringify({selectionHandle:demoSelection.selectionHandle,tenantId:controls.tenant.value,effectiveFrom:controls.effective.value,mapping});}
    else path='/api/xero-demo/reader/discover';
   }
   const data=await json(await fetch(path,{method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body,credentials:'omit',redirect:'error',cache:'no-store'}));
   if(revision!==requestRevision)throw Error();const url=new URL(data.url);
   if(url.protocol!=='https:'||url.hostname!=='login.xero.com'||url.pathname!=='/identity/connect/authorize'||url.username||url.password||url.port||url.searchParams.get('redirect_uri')!==config.origin+callback)throw Error();
   clear('Opening Xero consent…');location.assign(url.href);
  }catch{status.textContent=demo?'Could not prepare the Demo reader. Check owner access, choices and isolated setup. No writer was enabled.':'Could not start Xero consent. Check owner access and isolated service setup. No generation was enabled.';}
  finally{busy=false;connect.disabled=!signedIn()||!verified;}
 });
 window.addEventListener('pagehide',()=>clear('Sign-in cleared.'));
 email.disabled=false;password.disabled=false;login.disabled=false;
})();
</script></body></html>`;
}
