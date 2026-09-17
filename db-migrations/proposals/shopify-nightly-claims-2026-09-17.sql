-- PROPOSAL ONLY. No scheduler installation or change to financial privileges.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.stores WHERE id='56d92f8a-746e-4b4f-b408-81fc98c4aa17' AND shopify_domain='pocketlaunchpad1.myshopify.com' AND shopify_store_id='95601983836' AND currency_code='GBP' AND timezone='Europe/London') THEN RAISE EXCEPTION 'Expected staging store missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='night_scout_intake_service' AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'Expected restricted intake role missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='ingest_v1.sync_attempts'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Durable journal required'; END IF;
END $$;
CREATE TABLE ingest_v1.nightly_claims(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 local_date date NOT NULL, timezone text NOT NULL CHECK(timezone='Europe/London'),
 scheduled_at timestamptz NOT NULL,
 date_from date NOT NULL,date_to date NOT NULL,
 state text NOT NULL DEFAULT 'running' CHECK(state IN ('running','completed','unconfirmed')),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),finished_at timestamptz,
 UNIQUE(store_id,local_date),
 CHECK(isfinite(local_date) AND isfinite(scheduled_at) AND isfinite(date_from) AND isfinite(date_to)),
 CHECK(date_to>=date_from AND date_to-date_from<31),
 CHECK((scheduled_at AT TIME ZONE timezone)::date=local_date AND (scheduled_at AT TIME ZONE timezone)::time='02:00'),
 CHECK((state='running' AND finished_at IS NULL) OR (state<>'running' AND finished_at IS NOT NULL AND finished_at>=started_at))
);
CREATE UNIQUE INDEX nightly_unresolved_store ON ingest_v1.nightly_claims(store_id) WHERE state IN ('running','unconfirmed');
ALTER TABLE ingest_v1.nightly_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ingest_v1.nightly_claims FROM PUBLIC,anon,authenticated,night_scout_intake_service;
GRANT SELECT ON ingest_v1.nightly_claims TO night_scout_intake_service;
GRANT INSERT(store_id,local_date,timezone,scheduled_at,date_from,date_to),UPDATE(state) ON ingest_v1.nightly_claims TO night_scout_intake_service;
CREATE POLICY nightly_read ON ingest_v1.nightly_claims FOR SELECT TO night_scout_intake_service USING(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17');
CREATE POLICY nightly_insert ON ingest_v1.nightly_claims FOR INSERT TO night_scout_intake_service WITH CHECK(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17');
CREATE POLICY nightly_update ON ingest_v1.nightly_claims FOR UPDATE TO night_scout_intake_service USING(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17') WITH CHECK(store_id='56d92f8a-746e-4b4f-b408-81fc98c4aa17');
CREATE FUNCTION ingest_v1.guard_nightly_claim() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.state<>'running' OR NEW.state NOT IN ('completed','unconfirmed') OR NEW.id<>OLD.id OR NEW.store_id<>OLD.store_id OR NEW.local_date<>OLD.local_date OR NEW.timezone<>OLD.timezone OR NEW.scheduled_at<>OLD.scheduled_at OR NEW.date_from<>OLD.date_from OR NEW.date_to<>OLD.date_to OR NEW.started_at<>OLD.started_at THEN RAISE EXCEPTION 'Invalid nightly transition'; END IF;
 NEW.finished_at=clock_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER guard_nightly_claim BEFORE UPDATE ON ingest_v1.nightly_claims FOR EACH ROW EXECUTE FUNCTION ingest_v1.guard_nightly_claim();
REVOKE ALL ON FUNCTION ingest_v1.guard_nightly_claim() FROM PUBLIC,anon,authenticated;
COMMIT;
