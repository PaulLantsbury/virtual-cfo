import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const sql=p=>readFileSync(new URL(p,root),'utf8').replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
const seed=`
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
`;
writeFileSync(new URL('db-migrations/staging/20260909_finance_setup.sql',root),`-- STAGING ONLY: bioalckltvkhlczusdvl. Verify dashboard target.
-- Atomic evidence schema, member read endpoint and synthetic acceptance data.
-- September coverage is a complete synthetic fixture, not a live completed month.
BEGIN;
${sql('db-migrations/proposed/finance_v1_sales_evidence.sql')}
${sql('db-migrations/proposed/finance_v1_member_read.sql')}
${seed}
COMMIT;
`);
