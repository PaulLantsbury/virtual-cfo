-- PROPOSAL ONLY: private evidence storage contract, NOT READY FOR APPLICATION.
-- Requires existing finance_v1 and public source tables. No source amounts altered.
-- No reader/writer grants or reporting RPC. Fresh schema inspection and separate
-- approval required. Tables append-only; create a new version to correct evidence.
BEGIN;
CREATE TABLE finance_v1.profit_evidence_versions (
 id uuid PRIMARY KEY, store_id uuid NOT NULL REFERENCES public.stores(id),
 date_from date NOT NULL CHECK(date_from=date_trunc('month',date_from)::date),
 date_to date NOT NULL CHECK(date_to=(date_from+interval '1 month'-interval '1 day')::date),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 contract_version integer NOT NULL DEFAULT 1 CHECK(contract_version=1),
 source_manifest jsonb NOT NULL CHECK(jsonb_typeof(source_manifest)='object'),
 evidence_ref text NOT NULL CHECK(length(trim(evidence_ref))>0),
 verified_by text NOT NULL CHECK(length(trim(verified_by))>0),
 recorded_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,store_id)
);
CREATE TABLE finance_v1.line_cost_evidence (
 version_id uuid NOT NULL, store_id uuid NOT NULL,
 line_id uuid NOT NULL REFERENCES public.order_line_items(id),
 order_id uuid NOT NULL REFERENCES public.orders(id),
 sale_date date NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 observed_line jsonb NOT NULL CHECK(jsonb_typeof(observed_line)='object'),
 quantity integer NOT NULL CHECK(quantity>0),
 -- Landed historical unit cost is new evidence, not current product_variants.cost.
 historic_unit_cost_pence bigint NOT NULL CHECK(historic_unit_cost_pence>=0 AND historic_unit_cost_pence<=9007199254740991),
 evidence_ref text NOT NULL CHECK(length(trim(evidence_ref))>0),
 PRIMARY KEY(version_id,line_id), UNIQUE(version_id,store_id,line_id),
 FOREIGN KEY(version_id,store_id) REFERENCES finance_v1.profit_evidence_versions(id,store_id)
);
CREATE TABLE finance_v1.stock_return_evidence (
 version_id uuid NOT NULL, store_id uuid NOT NULL, source_return_id text NOT NULL CHECK(length(trim(source_return_id))>0),
 line_id uuid NOT NULL, saleable_date date NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0),
 evidence_ref text NOT NULL CHECK(length(trim(evidence_ref))>0),
 -- Independent warehouse event; no refund-date fallback or compulsory refund FK.
 PRIMARY KEY(version_id,source_return_id),
 FOREIGN KEY(version_id,store_id,line_id) REFERENCES finance_v1.line_cost_evidence(version_id,store_id,line_id)
);
CREATE TABLE finance_v1.expense_evidence (
 version_id uuid NOT NULL, store_id uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('overhead_entry','marketing_daily')),
 source_id uuid NOT NULL,
 classification text NOT NULL CHECK(classification IN ('variable','advertising','overhead','depreciation_amortisation','excluded_interest','excluded_corporation_tax')),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 observed_source jsonb NOT NULL CHECK(jsonb_typeof(observed_source)='object'),
 evidence_ref text NOT NULL CHECK(length(trim(evidence_ref))>0),
 canonical_expense_key text NOT NULL CHECK(length(trim(canonical_expense_key))>0),
 -- No independently editable amount: reader must check snapshot and read source.
 PRIMARY KEY(version_id,source_kind,source_id), UNIQUE(version_id,canonical_expense_key),
 FOREIGN KEY(version_id,store_id) REFERENCES finance_v1.profit_evidence_versions(id,store_id)
);
CREATE TABLE finance_v1.profit_component_coverage (
 version_id uuid PRIMARY KEY REFERENCES finance_v1.profit_evidence_versions(id),
 historic_cost_complete boolean NOT NULL DEFAULT false,
 stock_return_complete boolean NOT NULL DEFAULT false,
 variable_expense_complete boolean NOT NULL DEFAULT false,
 advertising_complete boolean NOT NULL DEFAULT false,
 overhead_complete boolean NOT NULL DEFAULT false,
 depreciation_complete boolean NOT NULL DEFAULT false,
 source_manifest jsonb NOT NULL CHECK(jsonb_typeof(source_manifest)='object'),
 evidence_ref text NOT NULL CHECK(length(trim(evidence_ref))>0)
);
-- Inserting coverage seals the version. Coverage expresses attested completeness,
-- not an automatic count check. Reader/manifest reconciliation is still required.
CREATE FUNCTION finance_v1.profit_evidence_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v finance_v1.profit_evidence_versions; l public.order_line_items;
 o public.overhead_entries; c public.overhead_categories;
 m public.marketing_channel_daily_metrics; lc finance_v1.line_cost_evidence;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Profit evidence is append-only'; END IF;
 IF TG_TABLE_NAME='profit_evidence_versions' THEN RETURN NEW; END IF;
 SELECT * INTO STRICT v FROM finance_v1.profit_evidence_versions WHERE id=NEW.version_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM finance_v1.profit_component_coverage WHERE version_id=v.id) THEN
  RAISE EXCEPTION 'Evidence version is sealed';
 END IF;
 IF TG_TABLE_NAME='profit_component_coverage' THEN RETURN NEW; END IF;
 IF NEW.store_id<>v.store_id THEN RAISE EXCEPTION 'Evidence store mismatch'; END IF;
 IF TG_TABLE_NAME='line_cost_evidence' THEN
  SELECT * INTO STRICT l FROM public.order_line_items WHERE id=NEW.line_id;
  IF l.store_id<>v.store_id OR l.order_id IS DISTINCT FROM NEW.order_id OR l.quantity IS DISTINCT FROM NEW.quantity
    OR NEW.currency<>v.currency OR NEW.sale_date>v.date_to
    OR NOT EXISTS(SELECT 1 FROM public.orders WHERE id=NEW.order_id AND store_id=v.store_id)
    OR NEW.observed_line<>to_jsonb(l) THEN RAISE EXCEPTION 'Line source scope/snapshot mismatch'; END IF;
 ELSIF TG_TABLE_NAME='stock_return_evidence' THEN
  SELECT * INTO STRICT lc FROM finance_v1.line_cost_evidence WHERE version_id=v.id AND line_id=NEW.line_id;
  IF NEW.saleable_date<lc.sale_date OR NEW.saleable_date>v.date_to OR
    NEW.quantity+COALESCE((SELECT sum(quantity) FROM finance_v1.stock_return_evidence WHERE version_id=v.id AND line_id=NEW.line_id),0)>lc.quantity
    THEN RAISE EXCEPTION 'Invalid or excessive saleable return'; END IF;
 ELSIF TG_TABLE_NAME='expense_evidence' THEN
  IF NEW.currency<>v.currency THEN RAISE EXCEPTION 'Expense currency mismatch'; END IF;
  IF NEW.source_kind='overhead_entry' THEN
   SELECT * INTO STRICT o FROM public.overhead_entries WHERE id=NEW.source_id;
   SELECT * INTO STRICT c FROM public.overhead_categories WHERE id=o.category_id;
   IF o.store_id<>v.store_id OR c.store_id<>v.store_id OR o.currency_code<>v.currency
      OR o.entry_type<>'actual' OR o.amount<0 OR o.period_start<>v.date_from OR o.period_end<>v.date_to
      OR NEW.observed_source<>jsonb_build_object('entry',to_jsonb(o),'category',to_jsonb(c))
      THEN RAISE EXCEPTION 'Unsupported or stale overhead source'; END IF;
  ELSE
   SELECT * INTO STRICT m FROM public.marketing_channel_daily_metrics WHERE id=NEW.source_id;
   IF m.store_id<>v.store_id OR m.metric_date<v.date_from OR m.metric_date>v.date_to
      OR m.spend<0 OR m.data_source='estimated' OR NEW.classification<>'advertising'
      OR NEW.observed_source<>to_jsonb(m) THEN RAISE EXCEPTION 'Unsupported or stale marketing source'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER immutable_profit_version BEFORE INSERT OR UPDATE OR DELETE ON finance_v1.profit_evidence_versions FOR EACH ROW EXECUTE FUNCTION finance_v1.profit_evidence_guard();
CREATE TRIGGER immutable_line_cost BEFORE INSERT OR UPDATE OR DELETE ON finance_v1.line_cost_evidence FOR EACH ROW EXECUTE FUNCTION finance_v1.profit_evidence_guard();
CREATE TRIGGER immutable_stock_return BEFORE INSERT OR UPDATE OR DELETE ON finance_v1.stock_return_evidence FOR EACH ROW EXECUTE FUNCTION finance_v1.profit_evidence_guard();
CREATE TRIGGER immutable_expense BEFORE INSERT OR UPDATE OR DELETE ON finance_v1.expense_evidence FOR EACH ROW EXECUTE FUNCTION finance_v1.profit_evidence_guard();
CREATE TRIGGER immutable_profit_coverage BEFORE INSERT OR UPDATE OR DELETE ON finance_v1.profit_component_coverage FOR EACH ROW EXECUTE FUNCTION finance_v1.profit_evidence_guard();
ALTER TABLE finance_v1.profit_evidence_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_v1.line_cost_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_v1.stock_return_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_v1.expense_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_v1.profit_component_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON finance_v1.profit_evidence_versions,finance_v1.line_cost_evidence,finance_v1.stock_return_evidence,finance_v1.expense_evidence,finance_v1.profit_component_coverage FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION finance_v1.profit_evidence_guard() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
