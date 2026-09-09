// Run against a loopback Vite preview configured with fake Supabase URL/key.
// All non-preview requests are mocked or blocked. No real accounts are created.
import test from 'node:test';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.NIGHT_SCOUT_TEST_URL || 'http://127.0.0.1:5187';
if(new URL(origin).hostname!=='127.0.0.1')throw new Error('Loopback preview required');
const a='50000000-0000-0000-0000-000000000001',b='50000000-0000-0000-0000-000000000002';
const user={id:'60000000-0000-0000-0000-000000000001',email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-09-08T00:00:00Z'};
const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'test-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
async function fixture(options,run){
 const browser=await chromium.launch({headless:true,executablePath:process.env.NIGHT_SCOUT_CHROME_PATH});
 const context=await browser.newContext();const page=await context.newPage();const errors=[],metrics=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin)return route.continue();
  if(url.hostname!=='night-scout-test.invalid')return route.abort();
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname==='/auth/v1/token')return options.badLogin?json({error_code:'invalid_credentials',msg:'Invalid credentials'},400):json(session);
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/signup')return json({user,session:null});
  if(url.pathname==='/auth/v1/logout')return options.logoutError?json({message:'offline'},500):route.fulfill({status:204});
  if(url.pathname==='/rest/v1/store_memberships')return options.membershipError?json({message:'missing table'},404):json((options.stores??[]).map(id=>({store_id:id,stores:{id,name:id===a?'Store A':'Store B'}})));
  if(url.pathname.startsWith('/rest/v1/rpc/')){metrics.push(request.postDataJSON());return json(0);}
  return json({message:'unexpected request'},400);
 });
 try{await run(page,metrics);assert.deepEqual(errors,[]);}finally{await context.close();await browser.close();}
}
const login=async page=>{await page.goto(origin+'/login');await page.getByLabel('Email address').fill('test@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();};

test('direct merchant routes and demo flags cannot bypass login; invalid credentials stay on form',async()=>{
 await fixture({badLogin:true},async(page,metrics)=>{
  await page.addInitScript(()=>sessionStorage.setItem('demoMode','true'));
  await page.goto(origin+'/dashboard');await page.getByRole('link',{name:'Go to sign in'}).waitFor();assert.equal(metrics.length,0);
  await login(page);await page.getByRole('alert').waitFor();assert.ok(page.url().endsWith('/login'));assert.equal(metrics.length,0);
  if(process.env.NIGHT_SCOUT_AUTH_SCREENSHOT)await page.screenshot({path:process.env.NIGHT_SCOUT_AUTH_SCREENSHOT,fullPage:true});
 });
});
test('confirmed login with missing membership never mounts merchant queries',async()=>{
 for(const options of [{stores:[]},{membershipError:true}])await fixture(options,async(page,metrics)=>{
  await login(page);await page.getByRole('heading',{name:options.membershipError?'We could not verify your store access':'Your account is not linked to a store yet'}).waitFor();assert.equal(metrics.length,0);
 });
});
test('multi-store selection scopes queries; logout unmounts merchant views and removes stored session',async()=>{
 await fixture({stores:[a,b]},async(page,metrics)=>{
  await login(page);await page.getByRole('heading',{name:'Choose your store'}).waitFor();assert.equal(metrics.length,0);
  await page.getByRole('button',{name:'Store B',exact:true}).click();await page.getByRole('combobox',{name:'Active store'}).waitFor();
  await page.waitForFunction(()=>document.body.innerText.includes('No data')||document.body.innerText.includes('No trading')||document.body.innerText.includes('No recent'),{},{timeout:3000}).catch(()=>{});
  assert.ok(metrics.length>0);assert.ok(metrics.every(p=>p.p_store_id===b));
  await page.getByRole('combobox',{name:'Active store'}).selectOption(a);
  await page.waitForTimeout(100);assert.ok(metrics.some(p=>p.p_store_id===a));
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('link',{name:'Go to sign in'}).waitFor();assert.equal(await page.getByRole('combobox',{name:'Active store'}).count(),0);
  await page.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.includes('auth-token')));
 });
});
test('signup mismatch is rejected locally; email-confirmation response does not open merchant pages',async()=>{
 await fixture({},async(page,metrics)=>{
  await page.goto(origin+'/signup');await page.getByLabel('Email address').fill('test@example.invalid');await page.getByLabel('Password',{exact:true}).fill('test-password');await page.getByLabel('Confirm password').fill('different');
  await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('alert').waitFor();
  await page.getByLabel('Confirm password').fill('test-password');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('status').filter({hasText:'Check your email'}).waitFor();assert.equal(metrics.length,0);assert.equal(await page.getByRole('button',{name:'Create account',exact:true}).count(),0);assert.equal(await page.getByLabel('Email address').count(),0);await page.getByRole('link',{name:'Go to sign in',exact:true}).waitFor();
 });
});

test('failed logout keeps merchant data hidden even if the SDK refreshes the session',async()=>{
 await fixture({stores:[a],logoutError:true},async(page)=>{
  await login(page);await page.getByRole('combobox',{name:'Active store'}).waitFor();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('alert').filter({hasText:'Sign-out could not finish'}).waitFor();
  await page.evaluate(async()=>{const {supabase}=await import('/src/lib/supabase.ts');await supabase.auth.refreshSession();});
  await page.getByRole('link',{name:'Go to sign in'}).waitFor();assert.equal(await page.getByRole('combobox',{name:'Active store'}).count(),0);
 });
});
