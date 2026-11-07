import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewerAuthenticator,restoreWithReviewerToken} from './reviewer-auth.mjs';
const id='80000000-0000-4000-8000-000000000001';
const client=getUser=>({auth:{getUser}});
test('reviewer identity comes from fresh Auth verification on every invocation',async()=>{
 let calls=0;
 const auth=reviewerAuthenticator(client(async token=>{calls++;assert.equal(token,'synthetic-token');return {data:{user:{id,is_anonymous:false,email:'not-forwarded@example.invalid',user_metadata:{reviewer:true}}},error:null};}),'Bearer synthetic-token');
 assert.deepEqual(await auth(),{id});assert.deepEqual(await auth(),{id});assert.equal(calls,2);
});
test('missing and malformed bearer headers are rejected without Auth or database access',async()=>{
 let calls=0;const supabase=client(async()=>{calls++;});
 for(const header of [undefined,'','Basic token','Bearer a b','Bearer a,b','Bearer a\n','Bearer '+ 'a'.repeat(8200)]){
  await assert.rejects(reviewerAuthenticator(supabase,header)(),/sign-in required/);
 }
 assert.equal(calls,0);
});
test('expired, anonymous, malformed and failed Auth responses are refused without leaking errors',async()=>{
 for(const response of [null,{data:{user:{id,is_anonymous:false}},error:{message:'private-token'}},{data:{user:{id,is_anonymous:true}}},{data:{user:{id}}},{data:{user:{id:'forged',is_anonymous:false}}}]){
  await assert.rejects(reviewerAuthenticator(client(async()=>response),'Bearer synthetic-token')(),e=>e.message==='Reviewer sign-in could not be verified');
 }
 await assert.rejects(reviewerAuthenticator(client(async()=>{throw new Error('private-token');}),'Bearer synthetic-token')(),e=>e.message==='Reviewer sign-in could not be verified');
});
test('forged body identity or authentication callback cannot bypass token verification',async()=>{
 let writes=0;const db={transaction:async()=>{writes++;throw new Error('Must not reach database');}};
 await assert.rejects(restoreWithReviewerToken(db,{reviewerId:id,authenticateReviewer:async()=>({id}),scope:{storeId:'other-store'}},{supabase:client(async()=>({error:{message:'invalid'}})),authorization:'Bearer forged'}),/could not be verified/);
 assert.equal(writes,0);
});
