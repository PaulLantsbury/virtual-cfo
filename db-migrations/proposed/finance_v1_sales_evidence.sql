-- PROPOSAL ONLY. Tested against a minimal cloud-shaped schema in PGlite.
-- Not in the migration runner. Reconcile cloud migration history before approval.
-- Execute atomically. No raw values, existing RPCs or grants are changed.
BEGIN;
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
COMMIT;
