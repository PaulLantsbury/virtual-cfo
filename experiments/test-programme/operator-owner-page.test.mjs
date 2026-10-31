import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {request as httpRequest} from 'node:http';
import {operatorOwnerPage,publicOwnerAuthConfig} from './operator-owner-page.mjs';
import {createOperatorConsentServer} from './operator-consent-server.mjs';
const project='bioalckltvkhlczusdvl',origin='https://operator.example.test',authUrl=`https://${project}.supabase.co`,publicKey='sb_publishable_syntheticPublicKeyMaterial123',nonce='syntheticNonce123456789',ownerId='10000000-0000-4000-8000-000000000001';
const jwt=payload=>Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.syntheticSignature';
const page=()=>operatorOwnerPage({origin,authUrl,publicKey,ownerId,nonce});
function browser(fetchImpl){
 const elements=Object.fromEntries(['signin','email','password','login','connect','signout','status','mfa','code','verify','enroll','enrollment','qr','setupkey','pendingRecovery','recoveryAck','removePending'].map(id=>[id,{value:'',disabled:true,textContent:'',handlers:{},removeAttribute(name){if(name==='src')this.src='';},addEventListener(event,fn){this.handlers[event]=fn;}}]));
 elements.signin.reset=()=>{elements.email.value='';elements.password.value='';};
 const callbacks={},redirects=[],calls=[],timers=[];let clock=100000;
 const context={document:{getElementById:id=>elements[id]},window:{addEventListener:(event,fn)=>{callbacks[event]=fn;}},location:{assign:url=>redirects.push(url)},URL,Date:{now:()=>clock},setTimeout:(fn)=>{timers.push(fn);return timers.length;},clearTimeout(){},fetch:async(...args)=>{calls.push(args);return fetchImpl(...args);}};
 runInNewContext(page().match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1],context);
 return {elements,calls,redirects,callbacks,timers,advance:ms=>{clock+=ms;},verify:async()=>{elements.code.value='123456';await elements.mfa.handlers.submit({preventDefault(){}});},login:async()=>{elements.email.value='owner@example.test';elements.password.value='synthetic-owner-password';await elements.signin.handlers.submit({preventDefault(){}});}};
}
const success=data=>({ok:true,json:async()=>data});
const consentUrl=()=>{const url=new URL('https://login.xero.com/identity/connect/authorize');url.searchParams.set('redirect_uri',origin+'/api/xero/test-writer/callback');return url.href;};
const httpGet=(url,headers={})=>new Promise((resolve,reject)=>{const request=httpRequest(url,{headers},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>{body+=chunk;});res.on('end',()=>resolve({status:res.statusCode,headers:{get:name=>res.headers[name.toLowerCase()]??null},text:async()=>body}));});request.on('error',reject);request.end();});

test('page accepts only fixed staging public anon/publishable configuration',()=>{
 assert.equal(publicOwnerAuthConfig({authUrl,publicKey}).publicKey,publicKey);
 assert.equal(publicOwnerAuthConfig({authUrl,publicKey:jwt({role:'anon',ref:project})}).authUrl,authUrl);
 for(const key of ['sb_secret_syntheticSecretMaterial123',jwt({role:'service_role',ref:project}),jwt({role:'anon',ref:'wrong-project'}),'not-a-public-key','</script><script>alert(1)</script>'])assert.throws(()=>publicOwnerAuthConfig({authUrl,publicKey:key}));
 assert.throws(()=>publicOwnerAuthConfig({authUrl:'https://another.supabase.co',publicKey}));
 assert.throws(()=>operatorOwnerPage({origin:'https://night-scout-xero-staging.onrender.com',authUrl,publicKey,nonce}));
 assert.throws(()=>operatorOwnerPage({origin,authUrl,publicKey,ownerId,nonce:'unsafe"nonce'}));
 assert.throws(()=>operatorOwnerPage({origin,authUrl,publicKey,nonce}));
});

const factor='50000000-0000-4000-8000-000000000001',challenge='60000000-0000-4000-8000-000000000001';
const authResponse=(url)=>{
 if(url===authUrl+'/auth/v1/user')return success({id:ownerId,factors:[{id:factor,factor_type:'totp',status:'verified'}]});
 if(url.endsWith('/challenge'))return success({id:challenge});
 if(url.endsWith('/verify'))return success({access_token:'synthetic-aal2-token',expires_in:3600,refresh_token:'never-persist-refresh'});
 return success({access_token:'synthetic-aal1-token',expires_in:3600,refresh_token:'never-persist-refresh'});
};

test('password and TOTP go directly to pinned Supabase; only upgraded token reaches connect header',async()=>{
 const b=browser(async(url)=>url.startsWith(authUrl)?authResponse(url):success({url:consentUrl()}));
 assert.equal(b.elements.login.disabled,false);assert.equal(b.elements.connect.disabled,true);
 await b.login();assert.equal(b.elements.password.value,'');assert.equal(b.elements.connect.disabled,true);assert.equal(b.elements.mfa.hidden,false);
 await b.elements.connect.handlers.click();assert.equal(b.calls.length,2);assert.match(b.elements.status.textContent,/Verify your authenticator/);
 await b.verify();assert.equal(b.elements.code.value,'');assert.equal(b.elements.connect.disabled,false);
 const [url,request]=b.calls[0];assert.equal(url,authUrl+'/auth/v1/token?grant_type=password');
 assert.equal(request.headers.apikey,publicKey);assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');
 assert.deepEqual(JSON.parse(request.body),{email:'owner@example.test',password:'synthetic-owner-password'});
 assert.equal(b.calls[1][0],authUrl+'/auth/v1/user');
 assert.equal(b.calls[2][0],authUrl+'/auth/v1/factors/'+factor+'/challenge');
 assert.equal(b.calls[3][0],authUrl+'/auth/v1/factors/'+factor+'/verify');
 assert.deepEqual(JSON.parse(b.calls[3][1].body),{challenge_id:challenge,code:'123456'});
 await b.elements.connect.handlers.click();
 assert.equal(b.calls[4][0],'/api/xero/test-writer/connect');assert.equal(b.calls[4][1].headers.Authorization,'Bearer synthetic-aal2-token');assert.equal(b.calls[4][1].body,'{}');
 assert.equal(b.redirects[0],consentUrl());assert.doesNotMatch(b.redirects[0],/synthetic|password|123456/);assert.equal(b.elements.connect.disabled,true);
});

test('no enrolled factor, wrong/expired challenge and invalid OTP keep consent locked before explicit setup',async()=>{
 for(const factors of [[],[{id:factor,factor_type:'totp',status:'unverified'}],[{id:'../unsafe',factor_type:'totp',status:'verified'}],[{id:factor,factor_type:'phone',status:'verified'}]]){
  const b=browser(async(url)=>url.endsWith('/user')?success({id:ownerId,factors}):authResponse(url));await b.login();assert.equal(b.elements.connect.disabled,true);if(factors.some(value=>value?.factor_type==='totp'&&value.status==='unverified')){assert.equal(b.elements.enroll.disabled,true);assert.match(b.elements.status.textContent,/unfinished-factor/);}else{assert.equal(b.elements.enroll.disabled,false);assert.match(b.elements.status.textContent,/no verified authenticator/);}assert.equal(b.calls.length,2);
 }
 for(const failed of ['challenge','verify']){
  const b=browser(async(url)=>url.endsWith('/'+failed)?{ok:false,json:async()=>({error:'private-error-message'})}:authResponse(url));await b.login();await b.verify();assert.equal(b.elements.connect.disabled,true);assert.equal(b.elements.code.value,'');assert.doesNotMatch(b.elements.status.textContent,/private-error-message/);
 }
 const b=browser(async(url)=>authResponse(url));await b.login();b.elements.code.value='bad';await b.elements.mfa.handlers.submit({preventDefault(){}});assert.equal(b.calls.length,2);
 const malformed=browser(async(url)=>url.endsWith('/challenge')?success({id:'../steal'}):authResponse(url));await malformed.login();await malformed.verify();assert.equal(malformed.calls.length,3);assert.equal(malformed.elements.connect.disabled,true);
 assert.doesNotMatch(page(),/otpauth|innerHTML|insertAdjacentHTML/);
});

test('cleared/expired/page-hidden sessions cannot start consent and no token input/storage is used',async()=>{
 for(const clear of ['signout','expiry','pagehide']){
  const b=browser(async(url)=>authResponse(url));await b.login();await b.verify();
  if(clear==='signout')b.elements.signout.handlers.click();else if(clear==='expiry')b.advance(3600001);else b.callbacks.pagehide();
  await b.elements.connect.handlers.click();assert.equal(b.calls.length,4);assert.deepEqual(b.redirects,[]);assert.equal(b.elements.code.value,'');
 }
 const script=page().match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
 assert.doesNotMatch(script,/localStorage|sessionStorage|document\.cookie|history\.|URLSearchParams|console\./);
 assert.doesNotMatch(page(),/<input[^>]*(bearer|token)/i);
});

test('failed consent, unsafe redirects and expired login responses remain unavailable',async()=>{
 for(const response of [{ok:false,json:async()=>({error:'private-provider-message'})},success({url:'https://evil.example/steal'}),success({url:'https://login.xero.com/identity/connect/authorize?redirect_uri=https://other.example/callback'})]){
  const b=browser(async(url)=>url.startsWith(authUrl)?authResponse(url):response);await b.login();await b.verify();await b.elements.connect.handlers.click();
  assert.deepEqual(b.redirects,[]);assert.match(b.elements.status.textContent,/Could not start Xero consent/);assert.doesNotMatch(b.elements.status.textContent,/private-provider-message/);
 }
 const b=browser(async()=>success({access_token:'synthetic-token',expires_in:0}));await b.login();assert.equal(b.elements.connect.disabled,true);
 for(const token of ['contains whitespace','token,other','token\nnewline','token\\slash']){const invalid=browser(async()=>success({access_token:token,expires_in:3600}));await invalid.login();assert.equal(invalid.elements.connect.disabled,true);}
});

test('clearing sign-in during password, MFA, or consent requests prevents restoration and redirect',async()=>{
 let resolveLogin;const loginResponse=new Promise(resolve=>{resolveLogin=resolve;});
 const b=browser(async()=>loginResponse);const pending=b.login();b.callbacks.pagehide();resolveLogin(success({access_token:'late-token',expires_in:3600}));await pending;
 assert.equal(b.elements.connect.disabled,true);assert.deepEqual(b.redirects,[]);
 let resolveVerify;const verifyResponse=new Promise(resolve=>{resolveVerify=resolve;});
 const m=browser(async(url)=>url.endsWith('/verify')?verifyResponse:authResponse(url));await m.login();const checking=m.verify();await new Promise(resolve=>setImmediate(resolve));m.callbacks.pagehide();resolveVerify(success({access_token:'late-aal2',expires_in:3600}));await checking;assert.equal(m.elements.connect.disabled,true);assert.equal(m.elements.mfa.hidden,true);
 let resolveConsent;const consentResponse=new Promise(resolve=>{resolveConsent=resolve;});
 const c=browser(async(url)=>url.startsWith(authUrl)?authResponse(url):consentResponse);await c.login();await c.verify();const connecting=c.elements.connect.handlers.click();c.elements.signout.handlers.click();resolveConsent(success({url:consentUrl()}));await connecting;assert.deepEqual(c.redirects,[]);
});

test('isolated HTTP page enforces canonical host, CSP, no-store and hides unsafe/private configuration',async()=>{
 const require=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url)),express=require('express');
 const env={NIGHT_SCOUT_XERO_TEST_WRITER_BOOTSTRAP_ENABLED:'true',NIGHT_SCOUT_RUNTIME_ENV:'staging',NIGHT_SCOUT_TEST_PROGRAMME_PROJECT_REF:project,NIGHT_SCOUT_TEST_WRITER_OPERATOR_ORIGIN:origin,NIGHT_SCOUT_REVIEW_AUTH_URL:authUrl,NIGHT_SCOUT_REVIEW_PUBLIC_KEY:publicKey,NIGHT_SCOUT_XERO_STAGING_OWNER_ID:'10000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_STAGING_STORE_ID:'20000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_ID:'30000000-0000-4000-8000-000000000001',NIGHT_SCOUT_XERO_TEST_WRITER_CLIENT_SECRET:'synthetic-private-xero-client-secret',NIGHT_SCOUT_XERO_TEST_WRITER_REDIRECT_URI:origin+'/api/xero/test-writer/callback',NIGHT_SCOUT_TEST_WRITER_ENVELOPE_MASTER_KEY:'synthetic-private-envelope-master-material',NIGHT_SCOUT_TEST_WRITER_ENVELOPE_KEY_VERSION:'writer-v1',NIGHT_SCOUT_TEST_PROGRAMME_DATABASE_URL:`postgresql://night_scout_test_writer.${project}:private-database-password@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`};
 const deps={express,createPool:()=>({on(){},end:async()=>{}}),createAuthClient:()=>({})};
 const service=createOperatorConsentServer({env,deps});const server=await new Promise(resolve=>{const s=service.app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/')).status,503);
  const res=await httpGet(base+'/',{host:new URL(origin).host});assert.equal(res.status,200);
  assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(res.headers.get('referrer-policy'),'no-referrer');assert.equal(res.headers.get('x-frame-options'),'DENY');
  const csp=res.headers.get('content-security-policy');assert.match(csp,/frame-ancestors 'none'/);assert.match(csp,/form-action 'none'/);assert.match(csp,/connect-src 'self' https:\/\/bioalckltvkhlczusdvl.supabase.co/);assert.doesNotMatch(csp,/unsafe-inline|\*/);assert.match(csp,/img-src data:/);
  const html=await res.text();assert.doesNotMatch(html,/private-database-password|private-xero-client-secret|private-envelope-master/);
  const token=html.match(/<script nonce="([^"]+)"/)[1];assert.ok(csp.includes(`'nonce-${token}'`));
  env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY=jwt({role:'service_role',ref:project});
  assert.equal((await httpGet(base+'/',{host:new URL(origin).host})).status,503);
  env.NIGHT_SCOUT_REVIEW_PUBLIC_KEY=publicKey;
  assert.equal((await httpGet(base+'/?access_token=synthetic',{host:new URL(origin).host})).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));await service.close();}
});

const enrollmentReply={id:factor,type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',secret:'JBSWY3DPEHPK3PXP'}};
const noFactorResponse=url=>url.endsWith('/user')?success({id:ownerId,factors:[]}):url===authUrl+'/auth/v1/factors'?success(enrollmentReply):authResponse(url);

test('only explicit owner enrollment creates a TOTP factor and displays safe image/text until verification',async()=>{
 const b=browser(async url=>noFactorResponse(url));await b.login();
 assert.equal(b.calls.length,2);assert.equal(b.elements.connect.disabled,true);assert.equal(b.elements.enroll.disabled,false);
 assert.equal(b.elements.qr.src,'');assert.equal(b.elements.setupkey.textContent,'');
 await b.elements.enroll.handlers.click();
 assert.equal(b.calls.length,4);assert.equal(b.calls[2][0],authUrl+'/auth/v1/user');
 const [url,request]=b.calls[3];assert.equal(url,authUrl+'/auth/v1/factors');assert.equal(request.method,'POST');assert.equal(request.headers.Authorization,'Bearer synthetic-aal1-token');
 assert.deepEqual(JSON.parse(request.body),{factor_type:'totp',friendly_name:'Night Scout operator authenticator'});
 assert.equal(b.elements.enrollment.hidden,false);assert.equal(b.elements.qr.src,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(enrollmentReply.totp.qr_code));assert.equal(b.elements.setupkey.textContent,enrollmentReply.totp.secret);
 assert.equal(b.elements.connect.disabled,true);assert.equal(b.elements.mfa.hidden,false);
 await b.verify();assert.equal(b.elements.connect.disabled,false);assert.equal(b.elements.qr.src,'');assert.equal(b.elements.setupkey.textContent,'');assert.equal(b.elements.enrollment.hidden,true);
 assert.ok(b.calls.every(([target])=>target.startsWith(authUrl)));assert.doesNotMatch(JSON.stringify(b.redirects),/JBSWY|123456/);
});

test('non-owner, stale or newly enrolled owners cannot create a factor through stale controls',async()=>{
 const outsider=browser(async url=>url.endsWith('/user')?success({id:'40000000-0000-4000-8000-000000000001',factors:[]}):authResponse(url));await outsider.login();assert.equal(outsider.elements.enroll.disabled,true);await outsider.elements.enroll.handlers.click();assert.equal(outsider.calls.length,2);
 for(const changed of ['owner','factor','expired']){
  let reads=0;const b=browser(async url=>{if(url.endsWith('/user')){reads++;return success({id:changed==='owner'&&reads>1?'40000000-0000-4000-8000-000000000001':ownerId,factors:changed==='factor'&&reads>1?[{id:factor,factor_type:'totp',status:'verified'}]:[]});}return noFactorResponse(url);});
  await b.login();if(changed==='expired')b.advance(3600001);await b.elements.enroll.handlers.click();
  assert.equal(b.calls.some(([url])=>url===authUrl+'/auth/v1/factors'),false);assert.equal(b.elements.connect.disabled,true);
 }
});

test('enrollment responses are fenced, bounded and never restored after clear, expiry or page leave',async()=>{
 for(const cancel of ['signout','expiry','pagehide']){
  let resolveEnroll;const pendingReply=new Promise(resolve=>{resolveEnroll=resolve;});
  const b=browser(async url=>url===authUrl+'/auth/v1/factors'?pendingReply:noFactorResponse(url));await b.login();const pending=b.elements.enroll.handlers.click();await new Promise(resolve=>setImmediate(resolve));
  if(cancel==='signout')b.elements.signout.handlers.click();else if(cancel==='expiry')b.timers[0]();else b.callbacks.pagehide();
  resolveEnroll(success(enrollmentReply));await pending;assert.equal(b.elements.qr.src,'');assert.equal(b.elements.setupkey.textContent,'');assert.equal(b.elements.enrollment.hidden,true);assert.equal(b.elements.connect.disabled,true);
 }
 for(const unsafe of [{...enrollmentReply,id:'../unsafe'},{...enrollmentReply,type:'phone'},{...enrollmentReply,totp:{qr_code:'<svg></svg>',secret:'<script>not-base32</script>'}}]){
  const b=browser(async url=>url===authUrl+'/auth/v1/factors'?success(unsafe):noFactorResponse(url));await b.login();await b.elements.enroll.handlers.click();assert.equal(b.elements.qr.src,'');assert.equal(b.elements.setupkey.textContent,'');assert.equal(b.elements.enroll.disabled,true);assert.match(b.elements.status.textContent,/No automatic retry or removal/);
 }
});


test('omitted optional factors allow explicit owner enrollment but malformed factors and wrong owners stay locked',async()=>{
 const b=browser(async url=>url.endsWith('/user')?success({id:ownerId}):url===authUrl+'/auth/v1/factors'?success(enrollmentReply):authResponse(url));
 await b.login();assert.equal(b.elements.enroll.disabled,false);assert.equal(b.elements.connect.disabled,true);assert.match(b.elements.status.textContent,/no verified authenticator/);
 await b.elements.enroll.handlers.click();assert.equal(b.elements.enrollment.hidden,false);assert.equal(b.elements.connect.disabled,true);
 await b.verify();assert.equal(b.elements.connect.disabled,false);
 for(const factors of [null,{},'invalid']){
  const bad=browser(async url=>url.endsWith('/user')?success({id:ownerId,factors}):authResponse(url));await bad.login();assert.equal(bad.elements.enroll.disabled,true);assert.equal(bad.elements.connect.disabled,true);assert.match(bad.elements.status.textContent,/password was accepted, but the owner-account check/);
 }
 const outsider=browser(async url=>url.endsWith('/user')?success({id:'40000000-0000-4000-8000-000000000001'}):authResponse(url));await outsider.login();assert.equal(outsider.elements.enroll.disabled,true);assert.match(outsider.elements.status.textContent,/owner-account check/);
 const rejected=browser(async()=>({ok:false}));await rejected.login();assert.match(rejected.elements.status.textContent,/Sign-in failed/);
 assert.equal(page().match(/id="status"/g).length,1);assert.ok(page().indexOf('id="status"')<page().indexOf('id="signin"'));
});


test('authenticator setup supports XML SVG and manual-only fallback without external image fetch or weaker MFA',async()=>{
 for(const qr_code of ['<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',undefined,'https://external.example/qr','<img src=x onerror=alert(1)>','<svg '+'x'.repeat(200000)]){
  const b=browser(async url=>url===authUrl+'/auth/v1/factors'?success({...enrollmentReply,totp:{...enrollmentReply.totp,qr_code}}):noFactorResponse(url));await b.login();await b.elements.enroll.handlers.click();assert.equal(b.elements.setupkey.textContent,enrollmentReply.totp.secret);assert.equal(b.elements.connect.disabled,true);
  if(qr_code?.startsWith('<?xml'))assert.match(b.elements.qr.src,/^data:image\/svg/);else{assert.equal(b.elements.qr.src,'');assert.equal(b.elements.qr.hidden,true);assert.match(b.elements.status.textContent,/manual setup key/);}
 }
});
test('enrollment reports only fixed safe categories and never retries or replaces unfinished factors',async()=>{
 for(const code of ['mfa_totp_enroll_not_enabled','mfa_factor_name_conflict','unexpected-private-payload']){const b=browser(async url=>url===authUrl+'/auth/v1/factors'?{ok:false,json:async()=>({code,message:'private-secret-payload'})}:noFactorResponse(url));await b.login();await b.elements.enroll.handlers.click();assert.match(b.elements.status.textContent,/Authenticator setup did not complete/);assert.doesNotMatch(b.elements.status.textContent,/private-secret-payload|unexpected-private-payload/);if(code!=='unexpected-private-payload')assert.ok(b.elements.status.textContent.includes(code));assert.equal(b.calls.filter(([url])=>url===authUrl+'/auth/v1/factors').length,1);}
 const pending=browser(async url=>url.endsWith('/user')?success({id:ownerId,factors:[{id:factor,factor_type:'totp',status:'unverified'}]}):authResponse(url));await pending.login();await pending.elements.enroll.handlers.click();assert.match(pending.elements.status.textContent,/unfinished-factor/);assert.equal(pending.calls.some(([url,init])=>url===authUrl+'/auth/v1/factors'&&init.method==='POST'),false);
});


test('unfinished-factor recovery requires explicit owner confirmation and removes only the fresh matching unverified factor',async()=>{
 const pendingUser={id:ownerId,factors:[{id:factor,factor_type:'totp',status:'unverified'}]};
 const b=browser(async(url,init)=>url.endsWith('/user')?success(pendingUser):init.method==='DELETE'?{ok:true}:authResponse(url));
 await b.login();assert.equal(b.elements.pendingRecovery.hidden,false);assert.equal(b.elements.removePending.disabled,true);assert.equal(b.elements.enroll.disabled,true);await b.elements.removePending.handlers.click();assert.equal(b.calls.length,2);
 b.elements.recoveryAck.checked=true;b.elements.recoveryAck.handlers.change();await b.elements.removePending.handlers.click();
 const deletes=b.calls.filter(([,init])=>init.method==='DELETE');assert.equal(deletes.length,1);assert.equal(deletes[0][0],authUrl+'/auth/v1/factors/'+factor);assert.equal(deletes[0][1].headers.Authorization,'Bearer synthetic-aal1-token');assert.match(b.elements.status.textContent,/unfinished authenticator was removed/);assert.equal(b.elements.connect.disabled,true);assert.equal(b.elements.enroll.disabled,true);assert.equal(b.calls.some(([url,init])=>url===authUrl+'/auth/v1/factors'&&init.method==='POST'),false);
});
test('recovery refuses changed owner, verification, selection, multiple factors and expired or cleared sessions',async()=>{
 const pending={id:factor,factor_type:'totp',status:'unverified'};
 for(const change of ['owner','verified','rebound','multiple','malformed','expired','cleared']){
  let reads=0;const b=browser(async url=>{if(url.endsWith('/user')){reads++;return success({id:change==='owner'&&reads>1?'40000000-0000-4000-8000-000000000001':ownerId,factors:reads===1?[pending]:change==='verified'?[{...pending,status:'verified'}]:change==='rebound'?[{...pending,id:'40000000-0000-4000-8000-000000000002'}]:change==='multiple'?[pending,{...pending,id:'40000000-0000-4000-8000-000000000002'}]:change==='malformed'?null:[pending]});}return authResponse(url);});
  await b.login();b.elements.recoveryAck.checked=true;b.elements.recoveryAck.handlers.change();if(change==='expired')b.advance(3600001);if(change==='cleared')b.elements.signout.handlers.click();await b.elements.removePending.handlers.click();assert.equal(b.calls.some(([,init])=>init.method==='DELETE'),false,change);assert.equal(b.elements.connect.disabled,true);
 }
 const verified=browser(async url=>authResponse(url));await verified.login();assert.equal(verified.elements.pendingRecovery.hidden,true);assert.equal(verified.elements.removePending.disabled,true);
});
test('uncertain recovery failures do not retry, enroll replacements, or expose provider messages',async()=>{
 const b=browser(async(url,init)=>url.endsWith('/user')?success({id:ownerId,factors:[{id:factor,factor_type:'totp',status:'unverified'}]}):init.method==='DELETE'?{ok:false,json:async()=>({message:'private-provider-detail'})}:authResponse(url));await b.login();b.elements.recoveryAck.checked=true;b.elements.recoveryAck.handlers.change();await b.elements.removePending.handlers.click();await b.elements.removePending.handlers.click();assert.equal(b.calls.filter(([,init])=>init.method==='DELETE').length,1);assert.match(b.elements.status.textContent,/removal was not confirmed/);assert.doesNotMatch(b.elements.status.textContent,/private-provider-detail/);assert.equal(b.elements.connect.disabled,true);
});
