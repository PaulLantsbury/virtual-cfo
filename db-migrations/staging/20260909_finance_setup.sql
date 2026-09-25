-- STAGING ONLY: bioalckltvkhlczusdvl. Verify dashboard target.
-- Atomic evidence schema, member read endpoint and synthetic acceptance data.
-- September coverage is a complete synthetic fixture, not a live completed month.
BEGIN;
-- PROPOSAL ONLY. Tested against a minimal cloud-shaped schema in PGlite.
-- Not in the migration runner. Reconcile cloud migration history before approval.
-- Execute atomically. No raw values, existing RPCs or grants are changed.

CREATE SCHEMA finance_v1;
REVOKE ALL ON SCHEMA finance_v1 FROM PUBLIC;

-- Existing id-only PKs do not support same-store composite foreign keys.
CREATE UNIQUE INDEX finance_v1_orders_store_id_idx ON public.orders(store_id,id);
CREATE UNIQUE INDEX finance_v1_refunds_store_id_idx ON public.refunds(store_id,id);

CREATE TABLE finance_v1.order_evidence (
  store_id uuid NOT NULL, order_id uuid NOT NULL,
  observed_raw jsonb NOT NULL CHECK(jsonb_typeof(observed_raw)='object'),
  event_date date NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  original_eligible boolean NOT NULL,
  tax_basis text NOT NULL CHECK(tax_basis IN ('inclusive','exclusive')),
  gross_product_vat numeric NOT NULL CHECK(gross_product_vat>=0),
  discount_vat numeric NOT NULL CHECK(discount_vat>=0),
  shipping_vat numeric NOT NULL CHECK(shipping_vat>=0),
  evidence_ref text NOT NULL CHECK(length(trim(evidence_ref))>0),
  verified_by text NOT NULL CHECK(length(trim(verified_by))>0),
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(store_id,order_id),
  FOREIGN KEY(store_id,order_id) REFERENCES public.orders(store_id,id)
);
CREATE TABLE finance_v1.refund_evidence (
  store_id uuid NOT NULL, refund_id uuid NOT NULL, order_id uuid NOT NULL,
  observed_raw jsonb NOT NULL CHECK(jsonb_typeof(observed_raw)='object'),
  event_date date NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  product_cash numeric NOT NULL CHECK(product_cash>=0),
  product_vat numeric NOT NULL CHECK(product_vat>=0 AND product_vat<=product_cash),
  shipping_cash numeric NOT NULL CHECK(shipping_cash>=0),
  shipping_vat numeric NOT NULL CHECK(shipping_vat>=0 AND shipping_vat<=shipping_cash),
  evidence_ref text NOT NULL CHECK(length(trim(evidence_ref))>0),
  verified_by text NOT NULL CHECK(length(trim(verified_by))>0),
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(store_id,refund_id),
  FOREIGN KEY(store_id,refund_id) REFERENCES public.refunds(store_id,id),
  FOREIGN KEY(store_id,order_id) REFERENCES public.orders(store_id,id)
);
CREATE TABLE finance_v1.coverage_evidence (
  store_id uuid NOT NULL REFERENCES public.stores(id),
  date_from date NOT NULL, date_to date NOT NULL CHECK(date_to>=date_from),
  currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  sales_and_refunds_complete boolean NOT NULL DEFAULT false,
  evidence_ref text NOT NULL CHECK(length(trim(evidence_ref))>0),
  verified_by text NOT NULL CHECK(length(trim(verified_by))>0),
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(store_id,date_from,date_to)
);
ALTER TABLE finance_v1.order_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_v1.refund_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_v1.coverage_evidence ENABLE ROW LEVEL SECURITY;
-- No client policies/grants: privileged server authorisation must be implemented
-- and reviewed separately. Never expose these views with an anonymous RPC.
CREATE VIEW finance_v1.order_mapping WITH (security_invoker=true) AS
SELECT o.id,o.store_id,o.gross_sales::text AS gross,o.discounts::text AS discount,
  o.shipping::text AS shipping,e.event_date::text AS day,e.currency,e.original_eligible,
  e.tax_basis,e.gross_product_vat::text AS gross_vat,e.discount_vat::text AS discount_vat,
  e.shipping_vat::text AS shipping_vat,e.evidence_ref,
  CASE WHEN e.order_id IS NULL THEN 'missing_evidence'
       WHEN e.observed_raw<>s.snapshot THEN 'stale_evidence' ELSE 'verified' END AS mapping_state,
  s.snapshot AS current_snapshot
FROM public.orders o
CROSS JOIN LATERAL (SELECT jsonb_build_object(
  'gross_sales',o.gross_sales::text,'discounts',o.discounts::text,'shipping',o.shipping::text,
  'tax',o.tax::text,'currency',o.currency,'financial_status',o.financial_status,
  'order_date',o.order_date AT TIME ZONE 'UTC','refunds',o.refunds::text) AS snapshot) s
LEFT JOIN finance_v1.order_evidence e ON e.store_id=o.store_id AND e.order_id=o.id;
CREATE VIEW finance_v1.refund_mapping WITH (security_invoker=true) AS
SELECT r.id,r.store_id,r.order_id,r.amount::text AS amount,e.event_date::text AS day,
  e.currency,e.product_cash::text AS product_cash,e.product_vat::text AS product_vat,
  e.shipping_cash::text AS shipping_cash,e.shipping_vat::text AS shipping_vat,e.evidence_ref,
  CASE WHEN e.refund_id IS NULL THEN 'missing_evidence'
       WHEN e.order_id<>r.order_id OR e.observed_raw<>s.snapshot THEN 'stale_evidence'
       ELSE 'verified' END AS mapping_state,s.snapshot AS current_snapshot
FROM public.refunds r
CROSS JOIN LATERAL (SELECT jsonb_build_object('order_id',r.order_id,'amount',r.amount::text,
  'refund_date',r.refund_date AT TIME ZONE 'UTC') AS snapshot) s
LEFT JOIN finance_v1.refund_evidence e ON e.store_id=r.store_id AND e.refund_id=r.id;
REVOKE ALL ON ALL TABLES IN SCHEMA finance_v1 FROM PUBLIC;

-- Apply only after finance_v1_sales_evidence.sql, on reviewed staging.
-- No evidence write privileges or security-definer functions.

REVOKE ALL ON SCHEMA finance_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA finance_v1 FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA finance_v1 TO authenticated;
GRANT SELECT ON finance_v1.order_evidence,finance_v1.refund_evidence,finance_v1.coverage_evidence,
 finance_v1.order_mapping,finance_v1.refund_mapping TO authenticated;
CREATE POLICY member_read ON finance_v1.order_evidence FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id=(SELECT auth.uid())));
CREATE POLICY member_read ON finance_v1.refund_evidence FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id=(SELECT auth.uid())));
CREATE POLICY member_read ON finance_v1.coverage_evidence FOR SELECT TO authenticated
 USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id=(SELECT auth.uid())));
CREATE FUNCTION public.verified_sales_source(p_store_id uuid,p_date_from date,p_date_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp AS $fn$
BEGIN
 IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to<p_date_from THEN
  RAISE EXCEPTION 'Invalid reporting period' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_memberships WHERE user_id=(SELECT auth.uid()) AND store_id=p_store_id) THEN
  RAISE EXCEPTION 'Store access unavailable' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object(
  'version',1,'storeId',p_store_id,'from',p_date_from,'to',p_date_to,
  'coverage',COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM finance_v1.coverage_evidence c WHERE store_id=p_store_id AND date_from=p_date_from AND date_to=p_date_to),'[]'::jsonb),
  'orders',COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM finance_v1.order_mapping o WHERE store_id=p_store_id),'[]'::jsonb),
  'refunds',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM finance_v1.refund_mapping r WHERE store_id=p_store_id),'[]'::jsonb));
END;
$fn$;
REVOKE ALL ON FUNCTION public.verified_sales_source(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.verified_sales_source(uuid,date,date) TO authenticated;


DO $guard$ BEGIN
 IF (SELECT count(*) FROM public.orders)<>2 OR (SELECT count(*) FROM public.refunds)<>0
 OR (SELECT count(*) FROM public.orders WHERE
 (id='91000000-0000-4000-8000-000000000001' AND store_id='90000000-0000-4000-8000-000000000001' AND gross_sales=123 AND shopify_order_id='staging-isolation-a') OR
 (id='91000000-0000-4000-8000-000000000002' AND store_id='90000000-0000-4000-8000-000000000002' AND gross_sales=987 AND shopify_order_id='staging-isolation-b'))<>2
 OR EXISTS(SELECT 1 FROM public.orders WHERE discounts<>0 OR refunds<>0 OR tax<>0 OR shipping IS DISTINCT FROM 0 OR currency IS DISTINCT FROM 'GBP' OR order_date IS DISTINCT FROM '2026-08-15T12:00:00Z'::timestamptz OR financial_status<>'paid') THEN
 RAISE EXCEPTION 'Expected unchanged synthetic staging fixture; review before applying'; END IF;
END; $guard$;
INSERT INTO public.refunds(id,store_id,order_id,shopify_refund_id,refund_date,amount,reason) VALUES
('92000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','staging-finance-refund-a','2026-09-05T12:00:00Z',23,'SYNTHETIC FINANCIAL ACCEPTANCE'),
('92000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','staging-finance-refund-b','2026-09-05T12:00:00Z',87,'SYNTHETIC FINANCIAL ACCEPTANCE');
UPDATE public.orders SET refunds=CASE WHEN id='91000000-0000-4000-8000-000000000001' THEN 23 ELSE 87 END
 WHERE id IN ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002');
INSERT INTO finance_v1.order_evidence(store_id,order_id,observed_raw,event_date,currency,original_eligible,tax_basis,gross_product_vat,discount_vat,shipping_vat,evidence_ref,verified_by)
 SELECT store_id,id,current_snapshot,'2026-08-15','GBP',true,'exclusive',0,0,0,'synthetic staging fixture: explicit tax-exclusive zero-VAT paid original order; Europe/London','staging fixture setup' FROM finance_v1.order_mapping;
INSERT INTO finance_v1.refund_evidence(store_id,refund_id,order_id,observed_raw,event_date,currency,product_cash,product_vat,shipping_cash,shipping_vat,evidence_ref,verified_by)
 SELECT store_id,id,order_id,current_snapshot,'2026-09-05','GBP',amount::numeric,0,0,0,'synthetic staging fixture: product-only zero-VAT refund; Europe/London','staging fixture setup' FROM finance_v1.refund_mapping;
INSERT INTO finance_v1.coverage_evidence(store_id,date_from,date_to,currency,sales_and_refunds_complete,evidence_ref,verified_by)
 SELECT id,m.f,m.t,'GBP',true,'complete synthetic staging fixture only','staging fixture setup' FROM public.stores
 CROSS JOIN (VALUES ('2026-08-01'::date,'2026-08-31'::date),('2026-09-01'::date,'2026-09-30'::date)) m(f,t)
 WHERE id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002');

COMMIT;
