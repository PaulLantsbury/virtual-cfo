import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionAccess, type SessionInput } from './sessionAccess.ts';
const a={id:'50000000-0000-0000-0000-000000000001',name:'A'};
const b={id:'50000000-0000-0000-0000-000000000002',name:'B'};
const session=(user='alice',expires=200):SessionInput=>({access_token:user,expires_at:expires,user:{id:user}});
function harness(options: {stores?: (id:string)=>Promise<typeof a[]>;verify?: (token:string)=>Promise<string>;preferences?:Map<string,string>}={}) {
 let clears=0,time=100000;
 const preferences=options.preferences??new Map<string,string>();
 const access=createSessionAccess({verify:options.verify??(async token=>token),stores:options.stores??(async()=>[a]),clear:()=>{clears++;},preferredStore:userId=>preferences.get(userId)??null,rememberStore:(userId,storeId)=>{if(storeId)preferences.set(userId,storeId);else preferences.delete(userId);},now:()=>time});
 return {access,clears:()=>clears,setTime:(value:number)=>{time=value;}};
}
function deferred<T>() {let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}

test('session is verified before membership lookup; a single store unlocks only after resolution',async()=>{
 const pending=deferred<typeof a[]>();let reads=0;
 const h=harness({stores:async id=>{assert.equal(id,'alice');reads++;return pending.promise;}});
 const done=h.access.setSession(session());
 assert.equal(h.access.getSnapshot().status,'checking');
 await Promise.resolve();assert.equal(reads,1);
 pending.resolve([a]);await done;
 assert.equal(h.access.getSnapshot().storeId,a.id);assert.equal(h.access.getSnapshot().status,'ready');
});
test('no session, expired/missing expiry and invalid identity cannot open merchant data',async()=>{
 let reads=0;const h=harness({verify:async()=> 'someone-else',stores:async()=>{reads++;return[a];}});
 for(const input of [null,session('alice',99),{...session()!,expires_at:undefined}]){await h.access.setSession(input);assert.equal(h.access.getSnapshot().status,'signed-out');}
 await h.access.setSession(session());assert.equal(h.access.getSnapshot().status,'error');assert.equal(reads,0);
});
test('missing membership or a failed membership service never uses a demo store',async()=>{
 const empty=harness({stores:async()=>[]});await empty.access.setSession(session());assert.equal(empty.access.getSnapshot().status,'no-store');assert.equal(empty.access.getSnapshot().storeId,null);
 const failed=harness({stores:async()=>{throw new Error('relation missing');}});await failed.access.setSession(session());assert.equal(failed.access.getSnapshot().status,'error');assert.equal(failed.access.getSnapshot().storeId,null);
});
test('logout and account change discard delayed results and clear old data immediately',async()=>{
 const pending=deferred<typeof a[]>();const h=harness({stores:async id=>id==='alice'?pending.promise:[b]});
 const old=h.access.setSession(session());await Promise.resolve();
 h.access.clear();assert.equal(h.access.getSnapshot().storeId,null);
 await h.access.setSession(session('bob'));pending.resolve([a]);await old;
 assert.equal(h.access.getSnapshot().userId,'bob');assert.equal(h.access.getSnapshot().storeId,b.id);assert.ok(h.clears()>=3);
 h.access.clear();assert.equal(h.access.getSnapshot().status,'signed-out');
});
test('multiple memberships require selection; switching clears state and rejects an unlisted store',async()=>{
 const h=harness({stores:async()=>[a,b]});await h.access.setSession(session());assert.equal(h.access.getSnapshot().status,'choose-store');assert.equal(h.access.getSnapshot().storeId,null);
 assert.throws(()=>h.access.select('unlisted'),/authorised/);
 h.access.select(a.id);const revision=h.access.getSnapshot().revision;const clears=h.clears();
 h.access.select(b.id);assert.ok(h.access.getSnapshot().revision>revision);assert.equal(h.clears(),clears+1);assert.equal(h.access.getSnapshot().storeId,b.id);
});
test('a selected store survives access revalidation only while membership remains authorised',async()=>{
 const preferences=new Map<string,string>();let memberships=[a,b];
 const h=harness({stores:async()=>memberships,preferences});await h.access.setSession(session());
 h.access.select(b.id);assert.equal(preferences.get('alice'),b.id);
 await h.access.setSession(session('alice',300));assert.equal(h.access.getSnapshot().status,'ready');assert.equal(h.access.getSnapshot().storeId,b.id);
 memberships=[a];await h.access.setSession(session('alice',400));assert.equal(h.access.getSnapshot().status,'ready');assert.equal(h.access.getSnapshot().storeId,a.id);assert.equal(preferences.has('alice'),false);
});
test('remembered selections are user-scoped and never bypass membership verification',async()=>{
 const preferences=new Map<string,string>([['alice',b.id],['bob',a.id]]);
 const h=harness({stores:async user=>user==='alice'?[a,b]:[b],preferences});
 await h.access.setSession(session('alice'));assert.equal(h.access.getSnapshot().storeId,b.id);
 await h.access.setSession(session('bob',300));assert.equal(h.access.getSnapshot().storeId,b.id);assert.equal(preferences.has('bob'),false);
});
test('expiry removes visible data and blocks delayed membership or store selection',async()=>{
 const h=harness();await h.access.setSession(session());h.setTime(200000);h.access.expire();assert.equal(h.access.getSnapshot().storeId,null);
 const pending=deferred<typeof a[]>();const slow=harness({stores:async()=>pending.promise});const done=slow.access.setSession(session());await Promise.resolve();slow.setTime(201000);pending.resolve([a]);await done;assert.equal(slow.access.getSnapshot().status,'signed-out');
});
test('refresh revalidates memberships and cannot retain access after revocation',async()=>{
 let memberships=[a];const h=harness({stores:async()=>memberships});await h.access.setSession(session());memberships=[];
 const refresh=h.access.setSession(session('alice',300));assert.equal(h.access.getSnapshot().storeId,null);await refresh;assert.equal(h.access.getSnapshot().status,'no-store');
});
test('malformed and duplicate membership results fail closed',async()=>{
 for(const stores of [[{id:'bad',name:'bad'}],[a,a]]){const h=harness({stores:async()=>stores});await h.access.setSession(session());assert.equal(h.access.getSnapshot().status,'error');}
});
