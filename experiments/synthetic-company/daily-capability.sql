-- EXECUTABLE OFFLINE PROPOSAL ONLY. Apply solely to a new disposable PostgreSQL cluster.
-- Generic roles only; no account, host, credential, schedule or live binding.
-- The trusted review operator must separately provision a bounded programme and approved
-- immutable day material. No invoker can provision material, choose scope or supply SQL/JSON.
BEGIN;
DO $$BEGIN
 IF to_regnamespace('finance_daily_v1') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('daily_capability_owner','daily_capability_invoker','daily_capability_reviewer')) THEN
  RAISE EXCEPTION 'Fresh capability namespace and roles required';
 END IF;
END$$;
CREATE ROLE daily_capability_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE daily_capability_invoker NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE ROLE daily_capability_reviewer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
CREATE SCHEMA finance_daily_v1;
REVOKE ALL ON SCHEMA finance_daily_v1 FROM PUBLIC;
GRANT USAGE ON SCHEMA finance_daily_v1 TO daily_capability_owner,daily_capability_invoker;
CREATE TABLE finance_daily_v1.programme(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 store_id uuid NOT NULL,
 contract_base jsonb NOT NULL,
 initial_through date NOT NULL,
 ceiling date NOT NULL CHECK(ceiling>initial_through),
 protected_seals jsonb NOT NULL CHECK(jsonb_typeof(protected_seals)='array'),
 protected_heads jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(protected_heads)='array'),
 enabled boolean NOT NULL DEFAULT false,
 CHECK(contract_base ?& ARRAY['store_id','profile','edition','date_from','currency','timezone']),
 CHECK(contract_base->>'store_id' IS NOT DISTINCT FROM store_id::text),
 CHECK(contract_base->>'profile' IS NOT DISTINCT FROM 'uk-gifts-v2'),
 CHECK(contract_base->>'edition' IS NOT DISTINCT FROM 'synthetic-history-v2-2026-11'),
 CHECK(contract_base->>'date_from' IS NOT DISTINCT FROM '2024-11-01'),
 CHECK(contract_base->>'currency' IS NOT DISTINCT FROM 'GBP'),
 CHECK(contract_base->>'timezone' IS NOT DISTINCT FROM 'Europe/London')
);
CREATE TABLE finance_daily_v1.reviewed_days(
 day date PRIMARY KEY,material jsonb NOT NULL,material_sha256 text NOT NULL CHECK(material_sha256~'^[0-9a-f]{64}$'),
 review_ref text NOT NULL CHECK(length(trim(review_ref))>0)
);
CREATE TABLE finance_daily_v1.publication_receipts(
 day date PRIMARY KEY,store_id uuid NOT NULL,run_id uuid NOT NULL UNIQUE,published_at timestamptz NOT NULL
);
ALTER TABLE finance_daily_v1.publication_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_publication_read ON finance_daily_v1.publication_receipts FOR SELECT TO daily_capability_owner USING(store_id=(SELECT store_id FROM finance_daily_v1.programme WHERE singleton));
CREATE POLICY owner_publication_insert ON finance_daily_v1.publication_receipts FOR INSERT TO daily_capability_owner WITH CHECK(store_id=(SELECT store_id FROM finance_daily_v1.programme WHERE singleton) AND day>(SELECT initial_through FROM finance_daily_v1.programme WHERE singleton) AND day<=(SELECT ceiling FROM finance_daily_v1.programme WHERE singleton));
GRANT SELECT,INSERT ON finance_daily_v1.publication_receipts TO daily_capability_owner;
ALTER TABLE finance_daily_v1.programme ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_daily_v1.reviewed_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_programme_read ON finance_daily_v1.programme FOR SELECT TO daily_capability_owner USING(true);
CREATE POLICY owner_reviewed_read ON finance_daily_v1.reviewed_days FOR SELECT TO daily_capability_owner USING(true);
GRANT SELECT ON finance_daily_v1.programme,finance_daily_v1.reviewed_days TO daily_capability_owner;
CREATE FUNCTION finance_daily_v1.guard_reviewed_material() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$BEGIN RAISE EXCEPTION 'Reviewed day material is immutable';END$$;
CREATE TRIGGER publication_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_daily_v1.publication_receipts FOR EACH STATEMENT EXECUTE FUNCTION finance_daily_v1.guard_reviewed_material();
CREATE TRIGGER reviewed_material_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_daily_v1.reviewed_days FOR EACH STATEMENT EXECUTE FUNCTION finance_daily_v1.guard_reviewed_material();
CREATE FUNCTION finance_daily_v1.guard_programme() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$BEGIN
 IF TG_OP<>'UPDATE' OR (to_jsonb(NEW)-'enabled')<>(to_jsonb(OLD)-'enabled') THEN RAISE EXCEPTION 'Programme scope and ceiling are immutable';END IF;RETURN NEW;
END$$;
CREATE TRIGGER programme_fixed BEFORE UPDATE OR DELETE ON finance_daily_v1.programme FOR EACH ROW EXECUTE FUNCTION finance_daily_v1.guard_programme();
CREATE TRIGGER programme_no_truncate BEFORE TRUNCATE ON finance_daily_v1.programme FOR EACH STATEMENT EXECUTE FUNCTION finance_daily_v1.guard_reviewed_material();
GRANT USAGE ON SCHEMA finance_history_v2 TO daily_capability_owner;
GRANT SELECT ON finance_history_v2.contracts,finance_history_v2.invalidations TO daily_capability_owner;
GRANT UPDATE(through_day) ON finance_history_v2.contracts TO daily_capability_owner;
GRANT SELECT,INSERT ON finance_history_v2.events,finance_history_v2.orders,finance_history_v2.refunds,finance_history_v2.lines,finance_history_v2.returns,finance_history_v2.coverage,finance_history_v2.seals,finance_history_v2.runs TO daily_capability_owner;
DO $scope$ DECLARE name text;BEGIN
 FOREACH name IN ARRAY ARRAY['contracts','events','orders','refunds','lines','returns','coverage','seals','runs'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='finance_history_v2' AND c.relname=name AND c.relrowsecurity AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname='daily_capability_owner')) THEN RAISE EXCEPTION 'Protected source RLS and separate owner required';END IF;
  EXECUTE format('CREATE POLICY daily_owner_scope ON finance_history_v2.%I TO daily_capability_owner USING(store_id=(SELECT store_id FROM finance_daily_v1.programme WHERE singleton)) WITH CHECK(store_id=(SELECT store_id FROM finance_daily_v1.programme WHERE singleton))',name);
 END LOOP;
END$scope$;
CREATE POLICY daily_owner_invalidation_read ON finance_history_v2.invalidations FOR SELECT TO daily_capability_owner USING(snapshot_id IN(SELECT snapshot_id FROM finance_history_v2.seals WHERE store_id=(SELECT store_id FROM finance_daily_v1.programme WHERE singleton)));

-- Optional correction heads are read only and pinned; this capability cannot select versions.
DO $heads$ BEGIN IF to_regclass('finance_history_v2.version_heads') IS NOT NULL THEN
 GRANT SELECT ON finance_history_v2.version_heads TO daily_capability_owner;
 CREATE POLICY daily_owner_head_read ON finance_history_v2.version_heads FOR SELECT TO daily_capability_owner USING(store_id=(SELECT store_id FROM finance_daily_v1.programme WHERE singleton));
END IF;END$heads$;

-- Internal validator accepts only the operator's immutable material and fixed programme.
-- Financial canonical generation/independent review occurs before provisioning; a JSON/hash
-- supplied by the invoker is never accepted by the public capability signature.
CREATE FUNCTION finance_daily_v1.validate_reviewed_day(requested_day date,material jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p finance_daily_v1.programme%ROWTYPE;name text;r jsonb;scope jsonb;is_month_end boolean;BEGIN
 SELECT * INTO STRICT p FROM finance_daily_v1.programme WHERE singleton;
 IF NOT (material ?& ARRAY['contract','storeId','day','expectedThrough','edition','profile','anchor','sources','coverage','seals','run','sourceHash','validationSets']) OR material->>'contract' IS DISTINCT FROM 'reviewed-synthetic-daily-material-v1' OR material->>'storeId' IS DISTINCT FROM p.store_id::text OR material->>'day' IS DISTINCT FROM requested_day::text OR material->>'expectedThrough' IS DISTINCT FROM (requested_day-1)::text OR requested_day>p.ceiling OR requested_day<=p.initial_through OR material->>'edition' IS DISTINCT FROM 'synthetic-history-v2-2026-11' OR material->>'profile' IS DISTINCT FROM 'uk-gifts-v2' OR material->>'anchor' IS DISTINCT FROM '2024-11-01' OR material->>'sourceHash' IS NULL OR material->>'sourceHash' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Reviewed material scope differs';END IF;
 FOREACH name IN ARRAY ARRAY['events','orders','refunds','lines','returns'] LOOP
  IF jsonb_typeof(material->'validationSets'->name) IS DISTINCT FROM 'object' OR material->'validationSets'->name->>'rowCount' IS NULL OR material->'validationSets'->name->>'sha256' IS NULL THEN RAISE EXCEPTION 'Reviewed actual validation set required';END IF;
  IF jsonb_typeof(material->'sources'->name) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Reviewed source array required';END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(material->'sources'->name) LOOP
   IF r->>'store_id' IS DISTINCT FROM p.store_id::text OR r->>'event_date' IS NULL OR (r->>'event_date')::date>requested_day OR r->>'source_id' IS NULL OR jsonb_typeof(r->'body') IS DISTINCT FROM 'object' OR r->>'row_hash' IS NULL THEN RAISE EXCEPTION 'Reviewed source scope differs';END IF;
  END LOOP;
 END LOOP;
 is_month_end=requested_day=(date_trunc('month',requested_day)+interval '1 month - 1 day')::date;
 IF jsonb_typeof(material->'coverage') IS DISTINCT FROM 'array' OR jsonb_typeof(material->'seals') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Reviewed evidence arrays required';END IF;
 IF jsonb_array_length(material->'coverage')<>(CASE WHEN is_month_end THEN 2 ELSE 1 END) OR jsonb_array_length(material->'seals')<>(CASE WHEN is_month_end THEN 1 ELSE 0 END) OR (SELECT count(*) FROM jsonb_array_elements(material->'coverage') q(value) WHERE q.value->>'kind'='day')<>1 OR (SELECT count(*) FROM jsonb_array_elements(material->'coverage') q(value) WHERE q.value->>'kind'='month')<>(CASE WHEN is_month_end THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Exactly one day evidence and complete-month evidence required';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(material->'coverage') LOOP
  scope=r->'source_manifest'->'scope';
  IF r->>'store_id' IS DISTINCT FROM p.store_id::text OR r->>'date_to' IS DISTINCT FROM requested_day::text OR r->>'date_from' IS DISTINCT FROM (CASE WHEN r->>'kind'='month' THEN to_char(requested_day,'YYYY-MM')||'-01' ELSE requested_day::text END) OR scope->>'storeId' IS DISTINCT FROM p.store_id::text OR scope->>'currency' IS DISTINCT FROM 'GBP' OR scope->>'to' IS DISTINCT FROM requested_day::text OR scope->>'from' IS DISTINCT FROM r->>'date_from' OR r->'source_manifest'->>'edition' IS DISTINCT FROM 'synthetic-history-v2-2026-11' OR r->'source_manifest'->>'anchor' IS DISTINCT FROM '2024-11-01' OR r->'source_manifest'->>'profile' IS DISTINCT FROM 'uk-gifts-v2' OR r->'source_manifest'->>'timezone' IS DISTINCT FROM 'Europe/London' OR r->'source_manifest'->>'formulaVersion' IS DISTINCT FROM 'night-scout-v11-2026-10-30' OR (r->'source_manifest'->>'sourceAsOf')::timestamptz IS DISTINCT FROM ((requested_day+1)::timestamp AT TIME ZONE 'Europe/London') OR r->'source_manifest'->>'observedAt' IS NULL OR (r->'source_manifest'->>'observedAt')::timestamptz>pg_catalog.clock_timestamp() OR ((r->'source_manifest'->>'observedAt')::timestamptz AT TIME ZONE 'Europe/London')::date IS DISTINCT FROM requested_day+1 THEN RAISE EXCEPTION 'Reviewed evidence scope differs';END IF;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(material->'seals') LOOP
  IF r->>'store_id' IS DISTINCT FROM p.store_id::text OR r->>'date_to' IS DISTINCT FROM requested_day::text OR r->>'date_from' IS DISTINCT FROM to_char(requested_day,'YYYY-MM')||'-01' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(material->'coverage') c WHERE c->>'kind'='month' AND c->>'coverage_id'=r->>'coverage_id' AND c->'source_manifest'=r->'source_manifest') THEN RAISE EXCEPTION 'Reviewed month seal scope differs';END IF;
 END LOOP;
 IF material->'run'->>'store_id' IS DISTINCT FROM p.store_id::text OR material->'run'->>'date_from' IS DISTINCT FROM requested_day::text OR material->'run'->>'date_to' IS DISTINCT FROM requested_day::text OR material->'run'->>'source_hash' IS DISTINCT FROM material->>'sourceHash' OR material->'run'->'receipt'->>'sourceHash' IS DISTINCT FROM material->>'sourceHash' OR material->'run'->'receipt'->>'contract' IS DISTINCT FROM 'synthetic-daily-preparation-v1' OR material->'run'->'receipt'->>'runId' IS DISTINCT FROM material->'run'->>'run_id' OR (material->'run'->'receipt'->>'sourceAsOf')::timestamptz IS DISTINCT FROM ((requested_day+1)::timestamp AT TIME ZONE 'Europe/London') OR material->'run'->'receipt'->>'day' IS DISTINCT FROM requested_day::text OR material->'run'->'receipt'->>'anchor' IS DISTINCT FROM '2024-11-01' OR material->'run'->'receipt'->>'profile' IS DISTINCT FROM 'uk-gifts-v2' OR material->'run'->'receipt'->>'edition' IS DISTINCT FROM 'synthetic-history-v2-2026-11' THEN RAISE EXCEPTION 'Reviewed receipt scope differs';END IF;
END$$;

CREATE FUNCTION finance_daily_v1.inspect_daily_receipt(requested_day date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p finance_daily_v1.programme%ROWTYPE;m jsonb;recorded jsonb;name text;r jsonb;actual jsonb;cl jsonb;protected jsonb;publication jsonb;programme_context jsonb;BEGIN
 SELECT * INTO STRICT p FROM finance_daily_v1.programme WHERE singleton;
 SELECT material INTO m FROM finance_daily_v1.reviewed_days WHERE day=requested_day AND material_sha256=encode(sha256(convert_to(material::text,'UTF8')),'hex');
 IF m IS NULL THEN RAISE EXCEPTION 'Exact reviewed day material required';END IF;
 PERFORM finance_daily_v1.validate_reviewed_day(requested_day,m);
 SELECT to_jsonb(t) INTO cl FROM finance_history_v2.contracts t WHERE store_id=p.store_id;
 IF cl IS NULL OR cl-'through_day' IS DISTINCT FROM p.contract_base THEN RAISE EXCEPTION 'Pinned inspection contract differs';END IF;
 programme_context=jsonb_build_object('storeId',p.store_id,'profile',p.contract_base->>'profile','edition',p.contract_base->>'edition','anchor',p.contract_base->>'date_from','currency',p.contract_base->>'currency','timezone',p.contract_base->>'timezone','initialThrough',p.initial_through,'ceiling',p.ceiling,'currentThrough',cl->>'through_day','enabled',p.enabled);
 SELECT to_jsonb(t) INTO recorded FROM finance_history_v2.runs t WHERE store_id=p.store_id AND date_from=requested_day AND date_to=requested_day;
 IF recorded IS NULL THEN IF EXISTS(SELECT 1 FROM finance_daily_v1.publication_receipts WHERE day=requested_day AND store_id=p.store_id) THEN RAISE EXCEPTION 'Orphan publication receipt requires review';END IF;RETURN jsonb_build_object('state','absent-review-before-retry','programme',programme_context);END IF;
 IF recorded<>m->'run' THEN RAISE EXCEPTION 'Receipt differs from reviewed day';END IF;
 SELECT jsonb_build_object('runId',run_id,'publishedAt',published_at) INTO publication FROM finance_daily_v1.publication_receipts WHERE day=requested_day AND store_id=p.store_id AND run_id=(recorded->>'run_id')::uuid AND published_at<=pg_catalog.clock_timestamp();
 IF publication IS NULL THEN RAISE EXCEPTION 'Exact durable publication timestamp required';END IF;
 IF EXISTS(SELECT 1 FROM generate_series(p.initial_through+1,(SELECT through_day FROM finance_history_v2.contracts WHERE store_id=p.store_id),interval '1 day') d LEFT JOIN finance_daily_v1.reviewed_days v ON v.day=d::date LEFT JOIN finance_history_v2.runs receipt_row ON receipt_row.store_id=p.store_id AND receipt_row.date_from=d::date AND receipt_row.date_to=d::date WHERE v.day IS NULL OR receipt_row.run_id IS NULL OR to_jsonb(receipt_row) IS DISTINCT FROM v.material->'run' OR v.material_sha256 IS DISTINCT FROM encode(sha256(convert_to(v.material::text,'UTF8')),'hex')) THEN RAISE EXCEPTION 'Contiguous exact reviewed receipts required';END IF;
 SELECT to_jsonb(t) INTO cl FROM finance_history_v2.contracts t WHERE store_id=p.store_id;
 IF cl-'through_day'<>p.contract_base OR (cl->>'through_day')::date<requested_day THEN RAISE EXCEPTION 'Receipt contract differs';END IF;
 FOREACH name IN ARRAY ARRAY['events','orders','refunds','lines','returns'] LOOP
  FOR r IN SELECT value FROM jsonb_array_elements(m->'sources'->name) LOOP
   EXECUTE format('SELECT to_jsonb(t) FROM finance_history_v2.%I t WHERE store_id=$1 AND source_id=$2',name) INTO actual USING p.store_id,r->>'source_id';
   IF actual IS NULL OR actual<>r THEN RAISE EXCEPTION 'Receipt actual source differs';END IF;
  END LOOP;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(m->'coverage') LOOP
  SELECT to_jsonb(t) INTO actual FROM finance_history_v2.coverage t WHERE store_id=p.store_id AND coverage_id=(r->>'coverage_id')::uuid;
  IF actual IS NULL OR actual<>r THEN RAISE EXCEPTION 'Receipt coverage differs';END IF;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(m->'seals') LOOP
  SELECT to_jsonb(t) INTO actual FROM finance_history_v2.seals t WHERE store_id=p.store_id AND snapshot_id=(r->>'snapshot_id')::uuid;
  IF actual IS NULL OR actual<>r OR EXISTS(SELECT 1 FROM finance_history_v2.invalidations WHERE snapshot_id=(r->>'snapshot_id')::uuid) THEN RAISE EXCEPTION 'Receipt complete-month seal differs or invalidated';END IF;
 END LOOP;
 SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY snapshot_id),'[]'::jsonb) INTO protected FROM finance_history_v2.seals t WHERE store_id=p.store_id AND date_to<=p.initial_through;
 IF protected<>p.protected_seals THEN RAISE EXCEPTION 'Protected closed-month evidence differs';END IF;
 IF EXISTS(SELECT 1 FROM finance_history_v2.invalidations i JOIN finance_history_v2.seals s USING(snapshot_id) WHERE s.store_id=p.store_id AND s.date_to<=p.initial_through) THEN RAISE EXCEPTION 'Protected closed-month invalidation requires separate review';END IF;
 IF to_regclass('finance_history_v2.version_heads') IS NOT NULL THEN
  EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY date_from,date_to),''[]''::jsonb) FROM finance_history_v2.version_heads t WHERE store_id=$1' INTO actual USING p.store_id;
  IF actual IS DISTINCT FROM p.protected_heads THEN RAISE EXCEPTION 'Protected selected version heads differ';END IF;
 ELSIF p.protected_heads<>'[]'::jsonb THEN RAISE EXCEPTION 'Pinned correction heads table missing';END IF;
 -- Re-read the complete scoped raw history, not only planned insert rows or cached revisions.
 -- All dates through this receipt are included, covering prior-order/refund/cost dependencies
 -- and unexpected extra rows while permitting separately reviewed later-day receipts.
 FOREACH name IN ARRAY ARRAY['events','orders','refunds','lines','returns'] LOOP
  EXECUTE format('SELECT jsonb_build_object(''rowCount'',count(*),''sha256'',encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY source_id),''[]''::jsonb)::text,''UTF8'')),''hex'')) FROM finance_history_v2.%I t WHERE store_id=$1 AND event_date<=$2',name) INTO actual USING p.store_id,requested_day;
  IF actual IS DISTINCT FROM m->'validationSets'->name THEN RAISE EXCEPTION 'Receipt complete actual source set differs';END IF;
 END LOOP;
 RETURN jsonb_build_object('state','committed-reconciled','receipt',recorded->'receipt','programme',programme_context,'publication',publication,'inspectedAt',pg_catalog.clock_timestamp());
END$$;

CREATE FUNCTION finance_daily_v1.append_completed_day(expected_through date,requested_day date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET lock_timeout='5s' AS $$
DECLARE p finance_daily_v1.programme%ROWTYPE;m jsonb;cl jsonb;actual jsonb;r jsonb;name text;columns text;found_run boolean;clock timestamptz;cutoff date;result jsonb;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('synthetic-reviewed-daily-programme',0));
 SELECT * INTO STRICT p FROM finance_daily_v1.programme WHERE singleton;
 IF NOT p.enabled THEN RAISE EXCEPTION 'Daily capability is disabled';END IF;
 SELECT material INTO m FROM finance_daily_v1.reviewed_days WHERE day=requested_day AND material_sha256=encode(sha256(convert_to(material::text,'UTF8')),'hex');
 IF m IS NULL THEN RAISE EXCEPTION 'Exact reviewed day material required';END IF;
 PERFORM finance_daily_v1.validate_reviewed_day(requested_day,m);
 PERFORM pg_advisory_xact_lock(hashtextextended('history-v2:'||p.store_id::text,0));
 SELECT to_jsonb(t) INTO cl FROM finance_history_v2.contracts t WHERE store_id=p.store_id FOR UPDATE;
 IF cl IS NULL OR cl-'through_day'<>p.contract_base THEN RAISE EXCEPTION 'Pinned source contract differs';END IF;
 SELECT EXISTS(SELECT 1 FROM finance_history_v2.runs WHERE store_id=p.store_id AND date_from=requested_day AND date_to=requested_day) INTO found_run;
 IF found_run THEN RETURN finance_daily_v1.inspect_daily_receipt(requested_day)||jsonb_build_object('replay',true,'inserted',0);END IF;
 clock=pg_catalog.clock_timestamp();cutoff=(clock AT TIME ZONE 'Europe/London')::date-1;
 IF requested_day<>cutoff OR (clock AT TIME ZONE 'Europe/London')::time NOT BETWEEN time '02:00:00' AND time '02:14:59.999999' THEN RAISE EXCEPTION 'Yesterday and reviewed London window required; gaps need separate review';END IF;
 IF requested_day>p.ceiling OR expected_through<>requested_day-1 OR (cl->>'through_day')::date<>expected_through OR m->>'expectedThrough'<>expected_through::text THEN RAISE EXCEPTION 'Stale horizon or noncontiguous append';END IF;
 -- Whitelisted row types and column lists; reviewed material is never executable SQL.
 FOREACH name IN ARRAY ARRAY['events','orders','refunds','lines','returns'] LOOP
  columns=CASE WHEN name='events' THEN 'store_id,source_id,event_date,kind,order_ref,dependency_only,body,row_hash' ELSE 'store_id,source_id,event_date,body,row_hash' END;
  FOR r IN SELECT value FROM jsonb_array_elements(m->'sources'->name) LOOP
   EXECUTE format('INSERT INTO finance_history_v2.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::finance_history_v2.%I,$1) ON CONFLICT(store_id,source_id) DO NOTHING',name,columns,columns,name) USING r;
   EXECUTE format('SELECT to_jsonb(t) FROM finance_history_v2.%I t WHERE store_id=$1 AND source_id=$2',name) INTO actual USING p.store_id,r->>'source_id';
   IF actual IS NULL OR actual<>r THEN RAISE EXCEPTION 'Immutable reviewed source conflict';END IF;
  END LOOP;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(m->'coverage') LOOP
  INSERT INTO finance_history_v2.coverage(coverage_id,store_id,date_from,date_to,kind,source_manifest,source_hash) SELECT coverage_id,store_id,date_from,date_to,kind,source_manifest,source_hash FROM jsonb_populate_record(NULL::finance_history_v2.coverage,r);
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(m->'seals') LOOP
  INSERT INTO finance_history_v2.seals(snapshot_id,store_id,date_from,date_to,coverage_id,sales_revision,cost_revision,source_manifest) SELECT snapshot_id,store_id,date_from,date_to,coverage_id,sales_revision,cost_revision,source_manifest FROM jsonb_populate_record(NULL::finance_history_v2.seals,r);
 END LOOP;
 INSERT INTO finance_history_v2.runs(run_id,store_id,date_from,date_to,source_hash,receipt) SELECT run_id,store_id,date_from,date_to,source_hash,receipt FROM jsonb_populate_record(NULL::finance_history_v2.runs,m->'run');
 INSERT INTO finance_daily_v1.publication_receipts(day,store_id,run_id,published_at) VALUES(requested_day,p.store_id,(m->'run'->>'run_id')::uuid,pg_catalog.clock_timestamp());
 UPDATE finance_history_v2.contracts SET through_day=requested_day WHERE store_id=p.store_id AND through_day=expected_through;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compare-and-set horizon failed';END IF;
 result=finance_daily_v1.inspect_daily_receipt(requested_day);
 RETURN result||jsonb_build_object('replay',false);
END$$;
ALTER FUNCTION finance_daily_v1.validate_reviewed_day(date,jsonb) OWNER TO daily_capability_owner;
ALTER FUNCTION finance_daily_v1.inspect_daily_receipt(date) OWNER TO daily_capability_owner;
ALTER FUNCTION finance_daily_v1.append_completed_day(date,date) OWNER TO daily_capability_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance_daily_v1 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finance_daily_v1.append_completed_day(date,date),finance_daily_v1.inspect_daily_receipt(date) TO daily_capability_invoker;
REVOKE ALL ON ALL TABLES IN SCHEMA finance_daily_v1 FROM PUBLIC,daily_capability_invoker;
ALTER TABLE finance_daily_v1.publication_receipts OWNER TO daily_capability_reviewer;
ALTER TABLE finance_daily_v1.programme OWNER TO daily_capability_reviewer;
ALTER TABLE finance_daily_v1.reviewed_days OWNER TO daily_capability_reviewer;
ALTER FUNCTION finance_daily_v1.guard_programme() OWNER TO daily_capability_reviewer;
ALTER FUNCTION finance_daily_v1.guard_reviewed_material() OWNER TO daily_capability_reviewer;
ALTER SCHEMA finance_daily_v1 OWNER TO daily_capability_reviewer;
COMMIT;
