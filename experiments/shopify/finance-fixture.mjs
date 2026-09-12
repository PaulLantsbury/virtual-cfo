// Disposable synthetic database fixture; never run against live data.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {fetchVerifiedSales} from '../financial-v1/rpc-sales-adapter.mjs';
import {expected} from './fixtures.mjs';
export const A='90000000-0000-4000-8000-000000000001',B='90000000-0000-4000-8000-000000000002',U='80000000-0000-4000-8000-000000000001',O='91000000-0000-4000-8000-000000000001';
export const sql=p=>readFileSync(new URL('../../db-migrations/'+p,import.meta.url),'utf8');
export async function setup(db=new PGlite(),{createRoles=true,installIntake=true}={}){
 if(createRoles)await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;`);
 await db.exec(`CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;`);
 await db.exec(sql('staging/20260909_bootstrap.sql'));
 await db.query("INSERT INTO stores(id,shopify_domain,shopify_store_id) VALUES($1,$2,'1'),($3,'other.myshopify.com','2')",[A,expected.domain,B]);
 await db.query('INSERT INTO auth.users VALUES($1)',[U]);await db.query('INSERT INTO store_memberships VALUES($1,$2),($1,$3)',[U,A,B]);
 await db.query("INSERT INTO orders(id,store_id,shopify_order_id,order_date,created_at,currency,gross_sales,net_sales,total_sales,shipping) VALUES($1,$2,'staging-isolation-a','2026-08-15T12:00:00Z','2026-08-15T12:00:00Z','GBP',123,123,123,0),('91000000-0000-4000-8000-000000000002',$3,'staging-isolation-b','2026-08-15T12:00:00Z','2026-08-15T12:00:00Z','GBP',987,987,987,0)",[O,A,B]);
 await db.exec(sql('staging/20260909_finance_setup.sql'));
 if(installIntake){
 await db.exec(sql('proposed/ingest_v1_candidate_batches.sql'));
 await db.exec(sql('proposed/ingest_v1_verified_invalidation.sql'));
 }
 const read=async(storeId=A)=>{await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[U]);await db.exec('SET ROLE authenticated');try{return await fetchVerifiedSales(async(_,p)=>({data:(await db.query('SELECT public.verified_sales_source($1,$2,$3) data',[p.p_store_id,p.p_date_from,p.p_date_to])).rows[0].data,error:null}),{storeId,currency:'GBP',from:'2026-08-01',to:'2026-08-31'});}finally{await db.exec('RESET ROLE');}};
 return {db,read};
}
