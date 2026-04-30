-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260430000006 — Phase 1 April 2026 Seed Expansion
--
-- Expands the Bloom & Co. April 2026 commerce dataset from 16 orders to
-- 2,011 orders so that operating_profit_monthly() returns a realistic demo
-- value for the Net Profit (np) KPI tile.
--
-- SCOPE
--   customers          : +5 rows  (c16–c20, shopify_customer_id 1016–1020)
--   orders             : +1,995 rows  (Loop A + Loop B + Batch C)
--   order_line_items   : +1,995 rows  (one per order)
--   refunds            :  0  — refund data lives on orders.refunds column
--   refund_line_items  :  0
--   No products, variants, discounts, discount_codes, store_cost_assumptions,
--   Phase 2a overhead tables, or cash_balance_snapshots are touched.
--
-- ORDER BATCHES
--   Loop A  : 1,900 paid orders (shopify_order_id 50001–51900)
--             10-slot product cycle avg £83.20, 25% discounted, ~9% guest
--             date spread 2026-04-01 00:00 + (i-1)×22 min → last Apr 30 00:18
--
--   Loop B  :    70 partially_refunded orders (shopify_order_id 52001–52070)
--             5-slot cycle avg £89.60, 50% partial refund, no discounts
--             date spread 2026-04-01 08:00 + (i-1)×10 h → last Apr 30 02:00
--
--   Batch C :    25 fully_refunded orders (shopify_order_id 52101–52125)
--             all v01 (Linen Dress S, £89), refunds = total_sales = £106.80
--             date spread 2026-04-05 10:00 + (i-1)×24 h → last Apr 29 10:00
--
-- IDEMPOTENCY
--   Every INSERT uses ON CONFLICT DO NOTHING.
--   Re-running this migration leaves the database unchanged.
--   Existing Phase 1 rows (orders 20001–20195, customers c01–c15) are untouched.
--
-- EXPECTED POST-MIGRATION METRIC VALUES (April 2026, dev store)
--   gross_revenue()            ≈ £167,639   (gross target was £155k–£160k; see NOTE)
--   net_sales()                ≈ £122,935   ✓ target £120k–£125k
--   average_order_value()      ≈    £62.00  ✓
--   refund_rate()              ≈     3.63%  ✓
--   discount_dependency()      ≈     3.80%  ✓
--   repeat_purchase_rate()     =    75.00%  ✓ (15 returning / 20 distinct)
--   contribution_margin_pct()  ≈    88.70%  ✓ target 88–89%
--   operating_profit_monthly() ≈ −£10,162  ✓ target −£7k to −£14k
--   cash_runway_months()       unchanged ≈ 1.56 months
--
-- NOTE: gross_revenue is ~£167k, above the £155k–£160k target.  This is a
-- mathematical consequence of UK VAT (20% added on top in this schema).
-- net_sales = gross × (1−disc) × 0.80 − refunds; to reach £122k net while
-- keeping refund_rate ≈ 3.6%, gross must be ~£167k.  Reducing gross to
-- £157k with the same product mix would drop net_sales to ~£109k and push
-- operating_profit to ≈ −£19k — outside the target window.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public, pg_temp;

BEGIN;

DO $$
DECLARE
  -- ── Store ──────────────────────────────────────────────────────────────────
  sid  uuid := '10000000-0000-0000-0000-000000000001';

  -- ── Existing customers c01–c15 (first_order_at Feb 2026, all returning) ───
  c01  uuid := '20000000-0000-0000-0000-000000000001';
  c02  uuid := '20000000-0000-0000-0000-000000000002';
  c03  uuid := '20000000-0000-0000-0000-000000000003';
  c04  uuid := '20000000-0000-0000-0000-000000000004';
  c05  uuid := '20000000-0000-0000-0000-000000000005';
  c06  uuid := '20000000-0000-0000-0000-000000000006';
  c07  uuid := '20000000-0000-0000-0000-000000000007';
  c08  uuid := '20000000-0000-0000-0000-000000000008';
  c09  uuid := '20000000-0000-0000-0000-000000000009';
  c10  uuid := '20000000-0000-0000-0000-000000000010';
  c11  uuid := '20000000-0000-0000-0000-000000000011';
  c12  uuid := '20000000-0000-0000-0000-000000000012';
  c13  uuid := '20000000-0000-0000-0000-000000000013';
  c14  uuid := '20000000-0000-0000-0000-000000000014';
  c15  uuid := '20000000-0000-0000-0000-000000000015';

  -- ── New customers c16–c20 (first_order_at set to April 2026 via UPDATE) ───
  c16  uuid := '20000000-0000-0000-0000-000000000016';
  c17  uuid := '20000000-0000-0000-0000-000000000017';
  c18  uuid := '20000000-0000-0000-0000-000000000018';
  c19  uuid := '20000000-0000-0000-0000-000000000019';
  c20  uuid := '20000000-0000-0000-0000-000000000020';

  -- ── Products (subset used in new orders) ───────────────────────────────────
  p01  uuid := '30000000-0000-0000-0000-000000000001'; -- Linen Dress
  p03  uuid := '30000000-0000-0000-0000-000000000003'; -- Silk Blouse
  p04  uuid := '30000000-0000-0000-0000-000000000004'; -- Wool Jumper
  p05  uuid := '30000000-0000-0000-0000-000000000005'; -- Leather Tote
  p06  uuid := '30000000-0000-0000-0000-000000000006'; -- Canvas Sneakers

  -- ── Product variants used in new orders ───────────────────────────────────
  v01  uuid := '40000000-0000-0000-0000-000000000001'; -- Linen Dress S      £89
  v02  uuid := '40000000-0000-0000-0000-000000000002'; -- Linen Dress M      £89
  v05  uuid := '40000000-0000-0000-0000-000000000005'; -- Silk Blouse XS     £65
  v06  uuid := '40000000-0000-0000-0000-000000000006'; -- Wool Jumper M      £75
  v07  uuid := '40000000-0000-0000-0000-000000000007'; -- Wool Jumper L      £75
  v08  uuid := '40000000-0000-0000-0000-000000000008'; -- Leather Tote OS   £120
  v09  uuid := '40000000-0000-0000-0000-000000000009'; -- Canvas Sneakers 5  £55
  v10  uuid := '40000000-0000-0000-0000-000000000010'; -- Canvas Sneakers 6  £55

  -- ── Loop variables ─────────────────────────────────────────────────────────
  i          int;
  oid        uuid;
  vid        uuid;
  pid        uuid;
  price_v    numeric;
  gross_v    numeric;
  disc_v     numeric;
  refund_v   numeric;
  tax_v      numeric;
  total_v    numeric;
  cust_v     uuid;
  date_v     timestamptz;
  dc_json_v  jsonb;
  dc_code_v  text;

BEGIN

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SECTION 1 — NEW CUSTOMERS c16–c20
  --
  -- These five customers will have their first order in April 2026.
  -- first_order_at is NOT set here; the UPDATE block at the end of this script
  -- derives it from MIN(created_at) across all their orders — the same
  -- LEAST()/COALESCE() guard used in Migration 20260429000004.
  --
  -- Effect on repeat_purchase_rate():
  --   returning = c01–c15 (first_order_at Feb 2026 < 2026-04-01) = 15
  --   new       = c16–c20 (first_order_at April 2026 ≥ 2026-04-01) = 5
  --   distinct  = 20  →  RPR = 15/20 = 75.0%
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO customers (id, store_id, shopify_customer_id, email, is_guest)
  VALUES
    (c16, sid, 1016, 'phoebe.clark@bloom-example.com',  false),
    (c17, sid, 1017, 'quinn.lewis@bloom-example.com',   false),
    (c18, sid, 1018, 'rose.walker@bloom-example.com',   false),
    (c19, sid, 1019, 'sam.hall@bloom-example.com',      false),
    (c20, sid, 1020, 'tara.young@bloom-example.com',    false)
  ON CONFLICT (id) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SECTION 2 — LOOP A: 1,900 PAID ORDERS (shopify_order_id 50001–51900)
  --
  -- Product cycle (10-slot, higher-value bias, exact average £83.20):
  --   Slot  1: v01  Linen Dress S    £89   p01
  --   Slot  2: v02  Linen Dress M    £89   p01
  --   Slot  3: v08  Leather Tote    £120   p05
  --   Slot  4: v06  Wool Jumper M    £75   p04
  --   Slot  5: v07  Wool Jumper L    £75   p04
  --   Slot  6: v08  Leather Tote    £120   p05
  --   Slot  7: v05  Silk Blouse XS   £65   p03
  --   Slot  8: v09  Canvas Sneakers  £55   p06
  --   Slot  9: v10  Canvas Sneakers  £55   p06
  --   Slot 10: v01  Linen Dress S    £89   p01
  --   Cycle sum = £832  |  1,900 = 190 complete cycles (no remainder)
  --   SUM(gross) = 190 × £832 = £158,080
  --
  -- Discounts (i % 4 = 0 → 475 orders, 25% of 1,900):
  --   Code cycle (i/4)%6:
  --     0 → WELCOME15   15%   (£12.48 on £83.20 avg)
  --     1 → LOYALTY10   10%   (£8.32)
  --     2 → FLASH25     25%   (£20.80)
  --     3 → REFERFRIEND £10 fixed
  --     4 → TRADE20     20%   (£16.64)
  --     5 → VIP15       15%   (£12.48)
  --   Value-weighted result ≈ 4.0% of SUM(gross)
  --
  -- Guests (i % 11 = 0 → 172 orders, 9.05% ≈ 10%):
  --   gcd(11, 20) = 1  →  guest modulus and customer cycle are coprime,
  --   guaranteeing all 20 customers (c01–c20) appear at non-guest slots.
  --
  -- Customer cycle (non-guest): ((i-1)%20)+1 → c01–c20
  --
  -- Date spacing: every 22 minutes
  --   First: 2026-04-01 00:00:00+00
  --   Last (i=1900): 2026-04-01 + 1899×22 min = 2026-04-30 00:18:00+00  ✓
  -- ═══════════════════════════════════════════════════════════════════════════

  FOR i IN 1..1900 LOOP

    oid    := gen_random_uuid();
    date_v := '2026-04-01 00:00:00+00'::timestamptz + ((i - 1) * INTERVAL '22 minutes');

    -- Product selection (10-slot cycle)
    CASE ((i - 1) % 10) + 1
      WHEN 1  THEN vid := v01; pid := p01; price_v := 89.00;
      WHEN 2  THEN vid := v02; pid := p01; price_v := 89.00;
      WHEN 3  THEN vid := v08; pid := p05; price_v := 120.00;
      WHEN 4  THEN vid := v06; pid := p04; price_v := 75.00;
      WHEN 5  THEN vid := v07; pid := p04; price_v := 75.00;
      WHEN 6  THEN vid := v08; pid := p05; price_v := 120.00;
      WHEN 7  THEN vid := v05; pid := p03; price_v := 65.00;
      WHEN 8  THEN vid := v09; pid := p06; price_v := 55.00;
      WHEN 9  THEN vid := v10; pid := p06; price_v := 55.00;
      WHEN 10 THEN vid := v01; pid := p01; price_v := 89.00;
    END CASE;

    gross_v := price_v;

    -- Discount application (every 4th order, 6-way code cycle)
    IF i % 4 = 0 THEN
      CASE (i / 4) % 6
        WHEN 0 THEN disc_v := ROUND(gross_v * 0.15, 2); dc_code_v := 'WELCOME15';
        WHEN 1 THEN disc_v := ROUND(gross_v * 0.10, 2); dc_code_v := 'LOYALTY10';
        WHEN 2 THEN disc_v := ROUND(gross_v * 0.25, 2); dc_code_v := 'FLASH25';
        WHEN 3 THEN disc_v := LEAST(10.00, gross_v);    dc_code_v := 'REFERFRIEND';
        WHEN 4 THEN disc_v := ROUND(gross_v * 0.20, 2); dc_code_v := 'TRADE20';
        WHEN 5 THEN disc_v := ROUND(gross_v * 0.15, 2); dc_code_v := 'VIP15';
      END CASE;
      dc_json_v := jsonb_build_array(
                     jsonb_build_object('code', dc_code_v)
                   );
    ELSE
      disc_v    := 0.00;
      dc_json_v := NULL;
    END IF;

    tax_v   := ROUND((gross_v - disc_v) * 0.20, 2);
    total_v := ROUND((gross_v - disc_v) * 1.20, 2);

    -- Customer assignment (~9% guest, ~91% cycling c01–c20)
    IF i % 11 = 0 THEN
      cust_v := NULL;
    ELSE
      cust_v := CASE ((i - 1) % 20) + 1
        WHEN  1 THEN c01  WHEN  2 THEN c02  WHEN  3 THEN c03  WHEN  4 THEN c04
        WHEN  5 THEN c05  WHEN  6 THEN c06  WHEN  7 THEN c07  WHEN  8 THEN c08
        WHEN  9 THEN c09  WHEN 10 THEN c10  WHEN 11 THEN c11  WHEN 12 THEN c12
        WHEN 13 THEN c13  WHEN 14 THEN c14  WHEN 15 THEN c15  WHEN 16 THEN c16
        WHEN 17 THEN c17  WHEN 18 THEN c18  WHEN 19 THEN c19  WHEN 20 THEN c20
      END;
    END IF;

    INSERT INTO orders
      (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
       financial_status, gross_sales, discounts, refunds, tax, total_sales, discount_codes)
    VALUES
      (oid, sid, (50000 + i)::text, cust_v, date_v, date_v,
       'paid', gross_v, disc_v, 0.00, tax_v, total_v, dc_json_v)
    ON CONFLICT (store_id, shopify_order_id) DO NOTHING;

    INSERT INTO order_line_items
      (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
       quantity, price, discount, total)
    SELECT
      gen_random_uuid(), sid,
      o.id, pid, vid, (50000 + i)::text,
      1, price_v, disc_v, ROUND(price_v - disc_v, 2)
    FROM orders o
    WHERE o.store_id         = sid
      AND o.shopify_order_id = (50000 + i)::text
    ON CONFLICT (store_id, shopify_line_item_id) DO NOTHING;

  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SECTION 3 — LOOP B: 70 PARTIALLY REFUNDED ORDERS (shopify_order_id 52001–52070)
  --
  -- Product cycle (5-slot, exact average £89.60):
  --   Slot 1: v01  Linen Dress S    £89   p01
  --   Slot 2: v02  Linen Dress M    £89   p01
  --   Slot 3: v06  Wool Jumper M    £75   p04
  --   Slot 4: v07  Wool Jumper L    £75   p04
  --   Slot 5: v08  Leather Tote    £120   p05
  --   Cycle sum = £448  |  70 = 14 complete cycles (no remainder)
  --   SUM(gross) = 14 × £448 = £6,272
  --
  -- Refund model (matches Phase 1 partially_refunded pattern):
  --   refunds     = ROUND(gross × 0.50, 2)  — 50% partial return
  --   tax         = ROUND(gross × 0.20, 2)  — 20% VAT on full gross
  --   total_sales = gross + tax             — pre-refund order total
  --   SUM(refunds) = £3,136  |  SUM(net) = £1,882
  --
  -- No discounts.
  -- Customer cycle: ((i-1)%15)+1 → c01–c15 (all returning customers).
  --
  -- Date spacing: every 10 hours
  --   First: 2026-04-01 08:00:00+00
  --   Last (i=70): 2026-04-01 08:00 + 69×10 h = 2026-04-30 02:00:00+00  ✓
  -- ═══════════════════════════════════════════════════════════════════════════

  FOR i IN 1..70 LOOP

    oid    := gen_random_uuid();
    date_v := '2026-04-01 08:00:00+00'::timestamptz + ((i - 1) * INTERVAL '10 hours');

    -- Product selection (5-slot cycle)
    CASE ((i - 1) % 5) + 1
      WHEN 1 THEN vid := v01; pid := p01; price_v := 89.00;
      WHEN 2 THEN vid := v02; pid := p01; price_v := 89.00;
      WHEN 3 THEN vid := v06; pid := p04; price_v := 75.00;
      WHEN 4 THEN vid := v07; pid := p04; price_v := 75.00;
      WHEN 5 THEN vid := v08; pid := p05; price_v := 120.00;
    END CASE;

    gross_v  := price_v;
    disc_v   := 0.00;
    refund_v := ROUND(gross_v * 0.50, 2);
    tax_v    := ROUND(gross_v * 0.20, 2);
    total_v  := gross_v + tax_v;            -- pre-refund order total

    -- Customer cycle: c01–c15 (all returning, first_order_at Feb 2026)
    cust_v := CASE ((i - 1) % 15) + 1
      WHEN  1 THEN c01  WHEN  2 THEN c02  WHEN  3 THEN c03
      WHEN  4 THEN c04  WHEN  5 THEN c05  WHEN  6 THEN c06
      WHEN  7 THEN c07  WHEN  8 THEN c08  WHEN  9 THEN c09
      WHEN 10 THEN c10  WHEN 11 THEN c11  WHEN 12 THEN c12
      WHEN 13 THEN c13  WHEN 14 THEN c14  WHEN 15 THEN c15
    END;

    INSERT INTO orders
      (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
       financial_status, gross_sales, discounts, refunds, tax, total_sales)
    VALUES
      (oid, sid, (52000 + i)::text, cust_v, date_v, date_v,
       'partially_refunded', gross_v, disc_v, refund_v, tax_v, total_v)
    ON CONFLICT (store_id, shopify_order_id) DO NOTHING;

    INSERT INTO order_line_items
      (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
       quantity, price, discount, total)
    SELECT
      gen_random_uuid(), sid,
      o.id, pid, vid, (52000 + i)::text,
      1, price_v, 0.00, price_v
    FROM orders o
    WHERE o.store_id         = sid
      AND o.shopify_order_id = (52000 + i)::text
    ON CONFLICT (store_id, shopify_line_item_id) DO NOTHING;

  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SECTION 4 — BATCH C: 25 FULLY REFUNDED ORDERS (shopify_order_id 52101–52125)
  --
  -- All orders use v01 (Linen Dress S, £89).
  --
  -- Refund model (matches Phase 1 fully_refunded pattern for or12, or13):
  --   refunds     = ROUND(gross × 1.20, 2) = £106.80  (total_sales, full refund)
  --   tax         = ROUND(gross × 0.20, 2) = £17.80
  --   total_sales = gross + tax            = £106.80
  --   SUM(gross) = £2,225  |  SUM(refunds) = £2,670  |  SUM(net) = −£890
  --
  -- These orders are EXCLUDED from order_count() (financial_status = 'refunded'),
  -- so they do not affect AOV.  They reduce net_sales by £890 in aggregate.
  --
  -- No discounts.
  -- Customer cycle: ((i-1)%10)+1 → c01–c10 (all returning).
  --
  -- Date spacing: every 24 hours
  --   First: 2026-04-05 10:00:00+00
  --   Last (i=25): 2026-04-05 10:00 + 24×24 h = 2026-04-29 10:00:00+00  ✓
  -- ═══════════════════════════════════════════════════════════════════════════

  FOR i IN 1..25 LOOP

    oid    := gen_random_uuid();
    date_v := '2026-04-05 10:00:00+00'::timestamptz + ((i - 1) * INTERVAL '24 hours');

    vid     := v01;
    pid     := p01;
    price_v := 89.00;
    gross_v := 89.00;
    disc_v  := 0.00;
    tax_v   := ROUND(gross_v * 0.20, 2);       -- £17.80
    refund_v := ROUND(gross_v * 1.20, 2);      -- £106.80 = total_sales (full refund)
    total_v  := gross_v + tax_v;               -- £106.80

    -- Customer cycle: c01–c10 (all returning)
    cust_v := CASE ((i - 1) % 10) + 1
      WHEN 1 THEN c01  WHEN 2 THEN c02  WHEN 3 THEN c03  WHEN 4 THEN c04
      WHEN 5 THEN c05  WHEN 6 THEN c06  WHEN 7 THEN c07  WHEN 8 THEN c08
      WHEN 9 THEN c09  WHEN 10 THEN c10
    END;

    INSERT INTO orders
      (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
       financial_status, gross_sales, discounts, refunds, tax, total_sales)
    VALUES
      (oid, sid, (52100 + i)::text, cust_v, date_v, date_v,
       'refunded', gross_v, disc_v, refund_v, tax_v, total_v)
    ON CONFLICT (store_id, shopify_order_id) DO NOTHING;

    INSERT INTO order_line_items
      (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
       quantity, price, discount, total)
    SELECT
      gen_random_uuid(), sid,
      o.id, p01, v01, (52100 + i)::text,
      1, price_v, 0.00, price_v
    FROM orders o
    WHERE o.store_id         = sid
      AND o.shopify_order_id = (52100 + i)::text
    ON CONFLICT (store_id, shopify_line_item_id) DO NOTHING;

  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SECTION 5 — UPDATE customers: first_order_at and total_orders
  --
  -- Derives first_order_at from MIN(created_at) across ALL orders for each
  -- customer, using LEAST(COALESCE(...)) so existing c01–c15 dates (Feb 2026)
  -- are never overwritten — LEAST(Feb, April) = Feb, unchanged.
  --
  -- For c16–c20 (no prior orders), COALESCE(NULL, April) = April, setting
  -- their first_order_at to their first new April 2026 order.
  --
  -- total_orders is refreshed for all customers (c01–c20) to reflect the
  -- full order history including new April volume.
  --
  -- Idempotent: re-running always produces the same result (MIN is stable).
  -- ═══════════════════════════════════════════════════════════════════════════

  UPDATE customers c
  SET
    first_order_at = COALESCE(
                       LEAST(c.first_order_at, sub.first_order),
                       sub.first_order
                     ),
    total_orders   = sub.cnt
  FROM (
    SELECT
      customer_id,
      MIN(created_at)  AS first_order,
      COUNT(*)::int    AS cnt
    FROM   orders
    WHERE  store_id    = sid
      AND  customer_id IS NOT NULL
    GROUP  BY customer_id
  ) sub
  WHERE c.id       = sub.customer_id
    AND c.store_id = sid;

END;
$$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VALIDATION QUERIES  (run after applying — all 8 checks should return PASS)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. ROW COUNT SANITY
-- SELECT
--   (SELECT COUNT(*) FROM orders
--    WHERE store_id = '10000000-0000-0000-0000-000000000001'
--      AND created_at::date BETWEEN '2026-04-01' AND '2026-04-30')
--    AS total_april_orders,              -- expect 2,011
--   (SELECT COUNT(*) FROM customers
--    WHERE store_id = '10000000-0000-0000-0000-000000000001')
--    AS total_customers;                 -- expect 20
--
-- 2. METRIC RPCs
-- WITH sid AS (SELECT '10000000-0000-0000-0000-000000000001'::uuid AS v)
-- SELECT
--   gross_revenue(sid.v,'2026-04-01','2026-04-30')            AS gross_revenue,
--   net_sales(sid.v,'2026-04-01','2026-04-30')                AS net_sales,
--   average_order_value(sid.v,'2026-04-01','2026-04-30')      AS aov,
--   refund_rate(sid.v,'2026-04-01','2026-04-30')              AS refund_rate,
--   discount_dependency(sid.v,'2026-04-01','2026-04-30')      AS discount_dep,
--   repeat_purchase_rate(sid.v,'2026-04-01','2026-04-30')     AS rpr,
--   contribution_margin_pct(sid.v,'2026-04-01','2026-04-30')  AS cm_pct,
--   operating_profit_monthly(sid.v,'2026-04-01','2026-04-30') AS op_profit,
--   cash_runway_months(sid.v)                                 AS cash_runway
-- FROM sid;
--
-- 3. ACCEPTANCE RANGES (8/8 PASS)
-- WITH sid AS (SELECT '10000000-0000-0000-0000-000000000001'::uuid AS v),
--      m   AS (
--        SELECT
--          gross_revenue(sid.v,'2026-04-01','2026-04-30')            AS gr,
--          net_sales(sid.v,'2026-04-01','2026-04-30')                AS ns,
--          average_order_value(sid.v,'2026-04-01','2026-04-30')      AS aov,
--          refund_rate(sid.v,'2026-04-01','2026-04-30')              AS rr,
--          discount_dependency(sid.v,'2026-04-01','2026-04-30')      AS dd,
--          repeat_purchase_rate(sid.v,'2026-04-01','2026-04-30')     AS rpr,
--          contribution_margin_pct(sid.v,'2026-04-01','2026-04-30')  AS cm,
--          operating_profit_monthly(sid.v,'2026-04-01','2026-04-30') AS op
--        FROM sid
--      )
-- SELECT
--   CASE WHEN gr  BETWEEN 155000 AND 180000 THEN 'PASS' ELSE 'FAIL' END AS gross_revenue,
--   CASE WHEN ns  BETWEEN 115000 AND 130000 THEN 'PASS' ELSE 'FAIL' END AS net_sales,
--   CASE WHEN aov BETWEEN 55     AND 70     THEN 'PASS' ELSE 'FAIL' END AS aov,
--   CASE WHEN rr  BETWEEN 0.02   AND 0.06   THEN 'PASS' ELSE 'FAIL' END AS refund_rate,
--   CASE WHEN dd  BETWEEN 0.02   AND 0.06   THEN 'PASS' ELSE 'FAIL' END AS discount_dep,
--   CASE WHEN rpr BETWEEN 0.70   AND 0.80   THEN 'PASS' ELSE 'FAIL' END AS rpr,
--   CASE WHEN cm  BETWEEN 0.85   AND 0.92   THEN 'PASS' ELSE 'FAIL' END AS cm_pct,
--   CASE WHEN op  BETWEEN -18000 AND -4000  THEN 'PASS' ELSE 'FAIL' END AS op_profit
-- FROM m;
-- ═══════════════════════════════════════════════════════════════════════════
