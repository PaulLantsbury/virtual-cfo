import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,chmod,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkDevelopmentConnection,parseDevelopmentCheckArguments} from './check-development-connection.mjs';
const config={domain:'synthetic-check.myshopify.com',shopId:'gid://shopify/Shop/100',currency:'GBP',timezone:'Europe/London',clientId:'synthetic-client',clientSecret:'synthetic-private-secret'};
const context={shop:{id:config.shopId,myshopifyDomain:config.domain,currencyCode:config.currency,ianaTimezone:config.timezone},currentAppInstallation:{accessScopes:[{handle:'read_orders'},{handle:'read_all_orders'}]}};
async function withConfig(fn){const dir=await mkdtemp(join(tmpdir(),'night-scout-check-'));try{const path=join(dir,'private.json');await writeFile(path,JSON.stringify(config),{mode:0o600});await fn(path,dir);}finally{await rm(dir,{recursive:true,force:true});}}
function responses(orderNodes=[]){return async(url,options)=>{
 if(url.endsWith('/admin/oauth/access_token'))return {ok:true,json:async()=>({access_token:'synthetic-private-token',expires_in:86400})};
 assert.equal(options.redirect,'error');const query=JSON.parse(options.body).query;
 return {ok:true,headers:new Headers({'x-shopify-api-version':'2026-07'}),json:async()=>({data:query.includes('NightScoutContext')?context:{orders:{nodes:orderNodes,pageInfo:{hasNextPage:false,endCursor:null}}}})};
};}

test('CLI requires an explicit private path and rejects unknown/duplicate flags',()=>{
 assert.deepEqual(parseDevelopmentCheckArguments(['--config','/private/test.json','--read-orders']),{configPath:'/private/test.json',readOrders:true});
 for(const args of [[],['--config'],['--read-orders'],['--config','x','--config','y'],['--config','x','--read-orders','--read-orders'],['--config','x','--other']])assert.throws(()=>parseDevelopmentCheckArguments(args),/Usage/);
});

test('context-only and empty bounded read return safe truthful summary, never raw secrets',async()=>withConfig(async path=>{
 const first=await checkDevelopmentConnection({configPath:path,fetchImpl:responses()});assert.equal(first.status,'context_verified');assert.equal(first.ordersCollected,false);
 const second=await checkDevelopmentConnection({configPath:path,readOrders:true,fetchImpl:responses()});assert.equal(second.status,'order_summaries_read');assert.equal(second.sourceOrderCount,0);assert.equal(second.pageCount,1);
 for(const result of [first,second]){assert.equal(result.dataImported,false);assert.equal(result.sourceReconciled,false);assert.equal(result.coverageCertified,false);assert.doesNotMatch(JSON.stringify(result),/synthetic-private|clientSecret|access_token/);}
}));

test('test order is counted as a source fact without eligibility or revenue claim',async()=>withConfig(async path=>{
 const result=await checkDevelopmentConnection({configPath:path,readOrders:true,fetchImpl:responses([{id:'gid://shopify/Order/55',processedAt:'2026-09-17T10:00:00Z',updatedAt:'2026-09-17T10:00:00Z',test:true,edited:false,taxesIncluded:false,currencyCode:'GBP',transactions:[],transactionsCount:{count:0,precision:'EXACT'},refunds:[],privateCustomerName:'NEVER PRINT THIS'}])});
 assert.equal(result.sourceOrderCount,1);assert.equal(result.testOrderCount,1);assert.equal(result.financialEligibilityAssessed,false);assert.equal(result.detailMappingCompleted,false);assert.doesNotMatch(JSON.stringify(result),/NEVER PRINT|Order\/55/);
}));

test('unsafe configuration permissions, symlinks and unexpected failures never leak values or paths',async()=>withConfig(async(path,dir)=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('synthetic-private-secret');};
 await chmod(path,0o644);await assert.rejects(checkDevelopmentConnection({configPath:path,fetchImpl}),/check failed/);assert.equal(calls,0);
 await chmod(path,0o600);const link=join(dir,'link.json');await symlink(path,link);await assert.rejects(checkDevelopmentConnection({configPath:link,fetchImpl}),/check failed/);assert.equal(calls,0);
 try{await checkDevelopmentConnection({configPath:path,fetchImpl});assert.fail('should fail');}catch(error){assert.doesNotMatch(error.message,/synthetic-private|private.json/);assert.equal(error.cause,undefined);}
}));
