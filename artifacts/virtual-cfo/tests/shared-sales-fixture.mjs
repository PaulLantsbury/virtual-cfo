// Run only against a loopback preview using fake Supabase configuration.
// All external traffic is mocked or blocked; no real profit data or accounts.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const { chromium } = await import(
  process.env.NIGHT_SCOUT_PLAYWRIGHT_MODULE || "playwright"
);
const origin = process.env.NIGHT_SCOUT_TEST_URL || "http://127.0.0.1:5187";
if (new URL(origin).hostname !== "127.0.0.1")
  throw new Error("Loopback preview required");
export const storeId = "50000000-0000-0000-0000-000000000001";
const user = {
  id: "60000000-0000-0000-0000-000000000001",
  email: "test@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  identities: [],
  created_at: "2026-09-08T00:00:00Z",
};
const token = [
  { alg: "HS256", typ: "JWT" },
  {
    sub: user.id,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  "signature",
]
  .map((x) =>
    Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString(
      "base64url",
    ),
  )
  .join(".");
const session = {
  access_token: token,
  refresh_token: "test-refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user,
};
export const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};
export const otherStoreId = "50000000-0000-0000-0000-000000000002";
export function evidence(params,{state="sale",currency="GBP"}={}) {
 const {p_store_id:id,p_date_from:from,p_date_to:to}=params;
 const order={id:"70000000-0000-0000-0000-000000000001",store_id:id,currency,mapping_state:"verified",day:state==="refund"?"2026-01-15":from,original_eligible:true,tax_basis:"exclusive",gross:"100.00",gross_vat:"20.00",discount:"10.00",discount_vat:"2.00",shipping:"5.00",shipping_vat:"1.00"};
 return {version:1,storeId:id,from,to,
  coverage:state==="missing"?[]:[{store_id:id,date_from:from,date_to:to,currency,sales_and_refunds_complete:true,evidence_ref:"isolated browser fixture"}],
  orders:state==="zero"?[]:[order],
  refunds:state==="refund"?[{id:"80000000-0000-0000-0000-000000000001",store_id:id,order_id:order.id,currency,mapping_state:"verified",day:from,amount:"24.00",product_cash:"24.00",product_vat:"4.00",shipping_cash:"0.00",shipping_vat:"0.00"}]:[]};
}
export async function fixture({viewport="desktop",plan="pro",state="sale",settingsMissing=false,twoStores=false,initialStorage={},respond,profitRespond,entry="/dashboard"}={},run) {
 const browser=await chromium.launch({headless:true,executablePath:process.env.NIGHT_SCOUT_CHROME_PATH});
 const context=await browser.newContext({viewport:viewports[viewport],serviceWorkers:"block",timezoneId:"America/Los_Angeles"});
 await context.addInitScript(({plan,origin,initialStorage})=>{if(location.origin===origin){sessionStorage.setItem("userPlan",plan);for(const [k,v]of Object.entries(initialStorage)){if(sessionStorage.getItem(k)===null)sessionStorage.setItem(k,v);}}},{plan,origin,initialStorage});
 const page=await context.newPage();
 await page.clock.install({time:new Date("2026-09-01T00:30:00Z")});
 const errors=[],unexpected=[],calls=[];
 page.on("pageerror",e=>errors.push(e.message));
 await context.route("**/*",async route=>{
  const request=route.request(),url=new URL(request.url());
  const json=(data,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
  if(url.origin===origin){if(url.pathname==="/api/profit-reporting" && profitRespond && request.method()==="GET"){const result=await profitRespond(Object.fromEntries(url.searchParams),request.headers());return json(result.data,result.status??200);}if(url.pathname.startsWith("/api/")){unexpected.push(url.pathname);return json({error:"Unexpected local API"},503);}return route.continue();}
  if(url.hostname!=="night-scout-test.invalid")return route.abort();
  if(url.pathname==="/auth/v1/token")return json(session);
  if(url.pathname==="/auth/v1/user")return json(user);
  if(url.pathname==="/rest/v1/store_memberships" && request.method()==="GET")return json([storeId,...(twoStores?[otherStoreId]:[])].map((id,i)=>({store_id:id,stores:{id,name:i?"Other Synthetic Store":"Synthetic Store"}})));
  if(url.pathname==="/rest/v1/stores" && request.method()==="GET" && url.searchParams.get("select")==="id,currency_code,timezone"){
   const id=url.searchParams.get("id")?.replace(/^eq\./,"");
   if(![storeId,otherStoreId].includes(id))unexpected.push("Unknown settings store");
   return settingsMissing?json({message:"Unavailable settings"},503):json({id,currency_code:id===otherStoreId?"EUR":"GBP",timezone:"Europe/London"});
  }
  if(url.pathname==="/rest/v1/rpc/verified_sales_source" && request.method()==="POST"){
   const params=request.postDataJSON();calls.push(params);
   if(respond){const custom=await respond(params);if(custom)return json(custom.data,custom.status??200);}
   return json(evidence(params,{state,currency:params.p_store_id===otherStoreId?"EUR":"GBP"}));
  }
  unexpected.push(`${request.method()} ${url.pathname}`);return json({message:"Unexpected source or write request"},503);
 });
 try{
  await page.goto(origin+"/login");await page.getByLabel("Email address").fill(user.email);await page.getByLabel("Password",{exact:true}).fill("test-password");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  if(twoStores)await page.getByRole("button",{name:"Synthetic Store",exact:true}).click();
  await page.getByRole("combobox",{name:"Active store"}).waitFor();
  if(entry!=="/dashboard"){await page.goto(origin+entry,{waitUntil:"domcontentloaded"});if(twoStores)await page.getByRole("button",{name:"Synthetic Store",exact:true}).click();}
  await page.getByRole("combobox",{name:"Reporting period",exact:true}).waitFor();
  await run(page,{calls,origin});
  assert.deepEqual(errors,[],"No browser errors");assert.deepEqual(unexpected,[],"No legacy RPCs, lookbacks, unplanned reads or writes");
 }finally{await context.close();await browser.close();}
}
export async function chooseCustom(page,from="2026-02-01",to="2026-02-28"){
 await page.getByRole("combobox",{name:"Reporting period",exact:true}).selectOption("custom");
 await page.getByLabel("From",{exact:true}).fill(from);await page.getByLabel("To",{exact:true}).fill(to);
}
export async function metrics(page,net="£90.00",aov="£90.00"){
 const region=page.getByRole("region",{name:"Verified sales figures",exact:true});
 const netGroup=region.getByRole("group",{name:"Net product sales",exact:true});
 await netGroup.getByText(net,{exact:true}).waitFor();
 const aovGroup=region.getByRole("group",{name:"Original average order value",exact:true});
 assert.ok((await aovGroup.innerText()).includes(aov),"Original AOV matches source scope");
}
