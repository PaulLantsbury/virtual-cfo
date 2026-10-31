-- PROPOSAL ONLY. Fixed staging development store; explicit approval required.
-- Adds observation SELECT/INSERT only to the existing private intake service.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.stores WHERE id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' AND shopify_domain='pocketlaunchpad1.myshopify.com' AND shopify_store_id='95601983836' AND currency_code='GBP' AND timezone='Europe/London') THEN RAISE EXCEPTION 'Expected staging development store missing or changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_intake_service' AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'Expected restricted intake role missing or changed'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.stores'::regclass) THEN RAISE EXCEPTION 'Required store RLS disabled'; END IF;
END $$;
CREATE SCHEMA shopify_identity_v1;
REVOKE ALL ON SCHEMA shopify_identity_v1 FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA shopify_identity_v1 TO night_scout_intake_service;
CREATE TABLE shopify_identity_v1.order_observations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 identity_collection_version integer NOT NULL CHECK(identity_collection_version=1),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 shop_id text NOT NULL CHECK(shop_id='gid://shopify/Shop/95601983836'),
 shopify_order_id text NOT NULL CHECK(shopify_order_id ~ '^gid://shopify/Order/[1-9][0-9]*$'),
 shopify_customer_id text CHECK(shopify_customer_id ~ '^gid://shopify/Customer/[1-9][0-9]*$'),
 source_order_updated_at timestamptz NOT NULL CHECK(isfinite(source_order_updated_at)),
 observed_at timestamptz NOT NULL CHECK(isfinite(observed_at)),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Null is an observed absence, not uncollected data or a guest identity.
-- Replay retains the earliest recorded observation of an identical source fact.
CREATE UNIQUE INDEX order_observations_source_fact ON shopify_identity_v1.order_observations(store_id,shop_id,shopify_order_id,source_order_updated_at,identity_collection_version,COALESCE(shopify_customer_id,''));
ALTER TABLE shopify_identity_v1.order_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shopify_identity_v1.order_observations FROM PUBLIC,anon,authenticated,night_scout_intake_service;
GRANT SELECT ON shopify_identity_v1.order_observations TO night_scout_intake_service;
GRANT INSERT(identity_collection_version,store_id,shop_id,shopify_order_id,shopify_customer_id,source_order_updated_at,observed_at) ON shopify_identity_v1.order_observations TO night_scout_intake_service;
CREATE POLICY identity_observation_read ON shopify_identity_v1.order_observations FOR SELECT TO night_scout_intake_service USING(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17');
CREATE POLICY identity_observation_insert ON shopify_identity_v1.order_observations FOR INSERT TO night_scout_intake_service WITH CHECK(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' AND shop_id='gid://shopify/Shop/95601983836');
COMMIT;
