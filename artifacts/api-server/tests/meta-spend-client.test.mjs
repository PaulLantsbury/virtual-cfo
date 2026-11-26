import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchMetaSpendRange} from '../../virtual-cfo/src/lib/metaAdsSpendApi.ts';
test('recovered client accepts standard company UUID and rejects malformed binding before auth or fetch',async()=>{
 const storeId='11111111-1111-4111-8111-111111111111',from='2026-10-01',to='2026-10-14';
 let auth=0,requests=0;
 const deps={accessToken:async()=>{auth++;return 'fictional';},fetcher:async(url,init)=>{
  requests++;assert.equal(new URL(url,'http://fixture.invalid').searchParams.get('storeId'),storeId);
  assert.equal(init.headers.authorization,'Bearer fictional');
  return {ok:true,json:async()=>({status:'not_connected',storeId,from,to,account:null,days:[]})};
 }};
 assert.equal((await fetchMetaSpendRange(storeId,from,to,undefined,deps)).status,'not_connected');
 for(const invalid of ['11111111-1111-4111-8111111111111','not-a-company'])await assert.rejects(fetchMetaSpendRange(invalid,from,to,undefined,deps));
 assert.equal(auth,1);assert.equal(requests,1);
});
