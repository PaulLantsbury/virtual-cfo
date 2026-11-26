import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const member = '11111111-1111-4111-8111-111111111111';
const outsider = '11111111-1111-4111-8111-111111111112';
const store = '22222222-2222-4222-8222-222222222222';
const pending = '33333333-3333-4333-8333-333333333333';
const connected = '33333333-3333-4333-8333-333333333334';
const account = '44444444-4444-4444-8444-444444444444';
const run = '55555555-5555-4555-8555-555555555555';
const digest = new Uint8Array(32).fill(171);
async function asLogin(db, role, fn) {
  const original = (await db.query('SELECT session_user')).rows[0].session_user;
  await db.exec(`SET SESSION AUTHORIZATION ${role}`);
  try {
    const { rows } = await db.query('SELECT session_user, current_user');
    assert.equal(rows[0].session_user, role);
    assert.equal(rows[0].current_user, role);
    return await fn();
  } finally { await db.exec(`SET SESSION AUTHORIZATION ${original}`); }
}
async function setup() {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE public.stores(id uuid PRIMARY KEY);
      CREATE TABLE public.store_memberships(user_id uuid, store_id uuid, PRIMARY KEY(user_id,store_id));`);
    for (const provider of ['meta', 'google']) {
      for (const capability of ['api', 'collector', 'report']) {
        const stem = `night_scout_${provider}_ads_${capability}`;
        await db.exec(`CREATE ROLE ${stem}_group NOLOGIN; CREATE ROLE ${stem}_login LOGIN INHERIT; GRANT ${stem}_group TO ${stem}_login;`);
      }
      const date = provider === 'meta' ? '2026-11-20' : '2026-11-21';
      for (const suffix of ['store', 'rpcs', 'read-rpc']) {
        const sql = await readFile(new URL(`../../db-migrations/proposals/${provider}-ads-spend-${suffix}-${date}.sql`, import.meta.url), 'utf8');
        await db.exec(sql); // Exact proposal, no rewriting or stub functions.
      }
    }
    await db.query('INSERT INTO auth.users VALUES ($1),($2)', [member, outsider]);
    await db.query('INSERT INTO public.stores VALUES ($1)', [store]);
    await db.query('INSERT INTO public.store_memberships VALUES ($1,$2)', [member, store]);
    return db;
  } catch (error) { await db.close(); throw error; }
}

test('exact six provider proposals enforce effective-role separation and membership in disposable PostgreSQL', async () => {
  const db = await setup();
  try {
    for (const provider of ['meta', 'google']) {
      const schema = `${provider}_ads_v1`;
      for (const capability of ['api', 'collector', 'report']) {
        await asLogin(db, `night_scout_${provider}_ads_${capability}_login`, async () => {
          await assert.rejects(db.query(`SELECT * FROM ${schema}.credential_envelopes`), /permission denied/);
          const create = (who) => db.query(`SELECT * FROM ${schema}.worker_create_oauth_state($1,$2,$3,clock_timestamp()+interval '5 minutes')`, [digest, who, store]);
          const report = (who) => db.query(`SELECT * FROM ${schema}.worker_read_daily_spend($1,$2,current_date-1,current_date-1,clock_timestamp())`, [who, store]);
          if (capability === 'api') {
            await assert.rejects(create(outsider), /OAuth state unavailable/);
            assert.equal((await create(member)).rows[0].created, true);
            await assert.rejects(report(member), /permission denied/);
          } else {
            await assert.rejects(create(member), /permission denied/);
            if (capability === 'report') {
              await assert.rejects(report(outsider), /spend report unavailable/);
              assert.equal((await report(member)).rows.length, 1);
            } else await assert.rejects(report(member), /permission denied/);
          }
        });
      }
    }
  } finally { await db.close(); }
});

test('both pending-connection RPCs reject extra/missing account fields and accept exact account contracts', async () => {
  const db = await setup();
  try {
    for (const provider of ['meta','google']) {
      await asLogin(db, `night_scout_${provider}_ads_api_login`, async () => {
        const accountValue = provider === 'meta'
          ? {accountId:'123456789',currency:'GBP',timeZone:'Europe/London'}
          : {customerId:'1234567890',loginCustomerId:null};
        const scope = provider === 'meta' ? "ARRAY['ads_read'],clock_timestamp()+interval '1 day'"
          : "ARRAY['https://www.googleapis.com/auth/adwords'],'production'";
        const create = (value) => db.query(`SELECT * FROM ${provider}_ads_v1.worker_create_pending_connection(
          $1,$2,$3,${scope},$4,$5,'synthetic-v1','AES-256-GCM',$6,clock_timestamp()+interval '5 minutes',$7::jsonb)`,
          [pending, member, store, new Uint8Array([1,2]), new Uint8Array([3,4]), digest, JSON.stringify([value])]);
        await assert.rejects(create({...accountValue, unexpected:'must-be-rejected'}), /pending connection unavailable/);
        const missing = {...accountValue}; delete missing[Object.keys(accountValue)[0]];
        await assert.rejects(create(missing), /pending connection unavailable/);
        assert.equal((await create(accountValue)).rows[0].created, true);
      });
    }
  } finally { await db.close(); }
});

async function seedMetaHistory(db) {
  await db.query(`INSERT INTO meta_ads_v1.connections(id,store_id,created_by,status,granted_scope,token_expires_at,connected_at)
    VALUES($1,$2,$3,'connected',ARRAY['ads_read'],clock_timestamp()+interval '1 day',clock_timestamp()-interval '2 days')`, [connected,store,member]);
  await db.query(`INSERT INTO meta_ads_v1.ad_accounts(id,connection_id,store_id,provider_account_id,currency,timezone_name,selected_at,active)
    VALUES($1,$2,$3,'123456789','GBP','Europe/London',clock_timestamp()-interval '2 days',true)`, [account,connected,store]);
  await db.query(`INSERT INTO meta_ads_v1.collection_runs(id,account_id,connection_id,store_id,requested_from,requested_to,idempotency_key,api_version,status,pages_read,started_at,finished_at)
    VALUES($1,$2,$3,$4,current_date-1,current_date-1,'synthetic-completed-run','v25.0','complete',1,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour')`, [run,account,connected,store]);
  await db.query(`INSERT INTO meta_ads_v1.daily_spend_observations(run_id,account_id,spend_date,coverage_state,spend_minor,observed_at)
    VALUES($1,$2,current_date-1,'provider_row',12345,clock_timestamp()-interval '1 hour')`, [run,account]);
}

test('Meta cancellation deletes only matching pending encrypted credentials and preserves accepted history', async () => {
  const db = await setup();
  try {
    await seedMetaHistory(db);
    await db.query(`INSERT INTO meta_ads_v1.connections(id,store_id,created_by,status,pending_selection_digest,pending_selection_expires_at)
      VALUES($1,$2,$3,'pending',$4,clock_timestamp()+interval '5 minutes')`, [pending,store,member,digest]);
    await db.query(`INSERT INTO meta_ads_v1.credential_envelopes(connection_id,ciphertext,encrypted_dek,key_version,algorithm,version,token_expires_at)
      VALUES($1,$2,$3,'synthetic-v1','AES-256-GCM',1,clock_timestamp()+interval '1 day')`, [pending,new Uint8Array([1]),new Uint8Array([2])]);
    for (const role of ['collector','report']) await asLogin(db, `night_scout_meta_ads_${role}_login`, () => assert.rejects(
      db.query('SELECT * FROM meta_ads_v1.worker_cancel_pending_selection($1,$2,$3,clock_timestamp())',[digest,member,store]), /permission denied/));
    await asLogin(db,'night_scout_meta_ads_api_login',async()=>{
      const cancel = (who) => db.query('SELECT * FROM meta_ads_v1.worker_cancel_pending_selection($1,$2,$3,clock_timestamp())',[digest,who,store]);
      assert.equal((await cancel(outsider)).rows[0].completed,false);
      assert.equal((await cancel(member)).rows[0].completed,true);
      assert.equal((await cancel(member)).rows[0].completed,false);
    });
    assert.equal((await db.query('SELECT * FROM meta_ads_v1.credential_envelopes WHERE connection_id=$1',[pending])).rows.length,0);
    assert.equal((await db.query('SELECT * FROM meta_ads_v1.connections WHERE id=$1',[pending])).rows.length,0);
    assert.equal((await db.query('SELECT * FROM meta_ads_v1.daily_spend_observations WHERE run_id=$1',[run])).rows.length,1);
  } finally { await db.close(); }
});

test('Meta expiry preserves exact saved account-day history before and after cleanup, while reconnect remains required',async()=>{
  const db=await setup();
  try {
    await seedMetaHistory(db);
    const report=()=>asLogin(db,'night_scout_meta_ads_report_login',()=>db.query('SELECT * FROM meta_ads_v1.worker_read_daily_spend($1,$2,current_date-1,current_date-1,clock_timestamp())',[member,store]));
    assert.equal(String((await report()).rows[0].spend_minor),'12345');
    await db.query("UPDATE meta_ads_v1.connections SET token_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[connected]);
    assert.equal((await report()).rows[0].provider_account_id,'123456789');
    assert.equal((await report()).rows[0].reauthorization_required,true);
    await asLogin(db,'night_scout_meta_ads_collector_login',()=>db.query('SELECT * FROM meta_ads_v1.worker_list_active_accounts(clock_timestamp())'));
    assert.equal((await db.query('SELECT status FROM meta_ads_v1.connections WHERE id=$1',[connected])).rows[0].status,'reauthorization_required');
    assert.equal((await report()).rows[0].provider_account_id,'123456789');
    assert.equal(String((await report()).rows[0].spend_minor),'12345');
    assert.equal((await db.query('SELECT * FROM meta_ads_v1.daily_spend_observations WHERE run_id=$1',[run])).rows.length,1,'expiry cleanup preserves the accepted observations');
  } finally {await db.close();}
});

test('both collector completion RPCs reject extra source/coverage properties and persist exact facts',async()=>{
  const db=await setup();
  try {
    const day=(await db.query("SELECT (current_date-1)::text AS day")).rows[0].day;
    for(const provider of ['meta','google']) {
      const schema=`${provider}_ads_v1`;
      const version=provider==='meta'?'v25.0':'v22';
      const expiryColumn=provider==='meta'?'token_expires_at':'credential_expires_at';
      await db.query(`INSERT INTO ${schema}.connections(id,store_id,created_by,status,${expiryColumn},connected_at)
        VALUES($1,$2,$3,'connected',clock_timestamp()+interval '1 day',clock_timestamp()-interval '1 day')`,[connected,store,member]);
      const identityColumns=provider==='meta'?'provider_account_id':'customer_id';
      const providerId=provider==='meta'?'123456789':'1234567890';
      await db.query(`INSERT INTO ${schema}.ad_accounts(id,connection_id,store_id,${identityColumns},currency,timezone_name,selected_at,active)
        VALUES($1,$2,$3,$4,'GBP','Europe/London',clock_timestamp()-interval '1 day',true)`,[account,connected,store,providerId]);
      await db.query(`INSERT INTO ${schema}.collection_runs(id,account_id,connection_id,store_id,requested_from,requested_to,idempotency_key,api_version,status,pages_read,started_at,lease_expires_at)
        VALUES($1,$2,$3,$4,current_date-1,current_date-1,'synthetic-claimed-run','${version}','running',0,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '5 minutes')`,[run,account,connected,store]);
      const source={provider:`${provider}_ads`,storeId:store,connectionId:connected,currency:'GBP',timeZone:'Europe/London',apiVersion:version,
        ...(provider==='meta'?{accountId:providerId}:{customerId:providerId,loginCustomerId:null})};
      const coverage={date:day,coverageState:'provider_row',[provider==='meta'?'spendMinor':'spendMicros']:'12345'};
      await asLogin(db,`night_scout_${provider}_ads_collector_login`,async()=>{
        const complete=(src,cov)=>db.query(`SELECT * FROM ${schema}.worker_complete_collection_run($1,'synthetic-claimed-run','complete',current_date-1,current_date-1,clock_timestamp(),1,$2::jsonb,$3::jsonb)`,[run,JSON.stringify(src),JSON.stringify([cov])]);
        await assert.rejects(complete({...source,extra:true},coverage),/collection unavailable/);
        await assert.rejects(complete(source,{...coverage,extra:true}),/coverage unavailable|collection unavailable/);
        assert.equal((await complete(source,coverage)).rows[0].completed,true);
      });
      const saved=await db.query(`SELECT * FROM ${schema}.daily_spend_observations WHERE run_id=$1`,[run]);
      assert.equal(saved.rows.length,1);
      assert.equal(String(saved.rows[0][provider==='meta'?'spend_minor':'spend_micros']),'12345');
    }
  } finally {await db.close();}
});

test('Meta authoritative selection prevents historical fallback across revoked/disconnected/new-owner/ambiguous selections',async()=>{
  const db=await setup();
  try {
    await seedMetaHistory(db);
    const report=(who=member,target=store,offset=1)=>asLogin(db,'night_scout_meta_ads_report_login',()=>db.query('SELECT * FROM meta_ads_v1.worker_read_daily_spend($1,$2,current_date-$3::integer,current_date-$3::integer,clock_timestamp())',[who,target,offset]));
    await assert.rejects(report(outsider),/spend report unavailable/);
    await assert.rejects(report(member,pending),/spend report unavailable/);
    const noFacts=(await report(member,store,2)).rows[0];
    assert.equal(noFacts.provider_account_id,'123456789');
    assert.equal(noFacts.spend_minor,null,'another period must not borrow a stored day');
    await db.query("UPDATE meta_ads_v1.ad_accounts SET active=false WHERE id=$1",[account]);
    await db.query(`INSERT INTO meta_ads_v1.connections(id,store_id,created_by,status,connected_at,disconnected_at)
      VALUES($1,$2,$3,'disconnected',clock_timestamp()-interval '1 hour',clock_timestamp())`,[pending,store,member]);
    await db.query(`INSERT INTO meta_ads_v1.ad_accounts(id,connection_id,store_id,provider_account_id,currency,timezone_name,selected_at,active)
      VALUES($1,$2,$3,'987654321','USD','America/New_York',clock_timestamp(),false)`,[run,pending,store]);
    for (const status of ['disconnected','revoked']) {
      await db.query('UPDATE meta_ads_v1.connections SET status=$1 WHERE id=$2',[status,pending]);
      assert.equal((await report()).rows[0].provider_account_id,null,'ineligible newest grant cannot expose old saved account');
    }
    await db.query("UPDATE meta_ads_v1.connections SET status='reauthorization_required',disconnected_at=NULL WHERE id=$1",[pending]);
    const expiredEmpty=(await report()).rows[0];
    assert.equal(expiredEmpty.provider_account_id,'987654321');
    assert.equal(expiredEmpty.currency,'USD');
    assert.equal(expiredEmpty.spend_minor,null);
    assert.equal(expiredEmpty.reauthorization_required,true);
    await db.query('UPDATE meta_ads_v1.connections SET created_by=$1 WHERE id=$2',[outsider,pending]);
    assert.equal((await report()).rows[0].provider_account_id,null,'selection authority precedes caller eligibility');
    await db.query('UPDATE meta_ads_v1.connections SET created_by=$1 WHERE id=$2',[member,pending]);
    await db.query('UPDATE meta_ads_v1.ad_accounts SET selected_at=(SELECT selected_at FROM meta_ads_v1.ad_accounts WHERE id=$1) WHERE id=$2',[run,account]);
    assert.equal((await report()).rows[0].provider_account_id,null,'ambiguous latest selection fails closed');
    await db.query('DELETE FROM public.store_memberships WHERE user_id=$1 AND store_id=$2',[member,store]);
    await assert.rejects(report(),/spend report unavailable/);
  } finally {await db.close();}
});
