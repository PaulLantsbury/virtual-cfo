-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260430000007 — Phase 2b March 2026 Seed
--
-- Seeds March 2026 order data for the Bloom & Co. dev store so that
-- month_on_month_delta() has a valid prior month to compare April against.
--
-- SCOPE
--   customers          : +8 rows  (c21–c28, shopify_customer_id 1021–1028)
--   orders             : +1,736 rows  (Loop A + Loop B + Batch C)
--   order_line_items   : +1,736 rows  (one per order)
--   No schema changes, no Phase 1/2a table alterations.
--
-- DESIGN RATIONALE (Option B — margin compression)
--   March is a smaller-volume, higher-quality month: fewer orders, premium
--   product mix, lower refund rate (~2.5% vs April 3.6%), less discounting
--   (~2.0% vs April ~3.9%), higher AOV (~£67 vs April ~£62).
--   April sees a volume surge with mix shift toward lower-priced products,
--   heavier promotion, and more refunds — margin compresses.
--   The overhead normalisation (March £122,800 → April £119,200) partially
--   offsets the margin compression, cutting the operating loss ~51%.
--
-- SCHEMA-ADAPTIVE
--   Same is_cloud detection as migration 000006:
--     Local  : shopify_order_id BIGINT, order_line_items.total_discount / .gross_line_total
--     Cloud  : shopify_order_id TEXT,   order_line_items.discount / .total
--
-- ORDER BATCHES
--   Loop A  : 1,653 paid orders (shopify_order_id 60001–61653)
--             8-slot premium cycle avg £86.38, ~14% discounted, ~7.7% guest
--             date spread 2026-03-01 00:00 + (i-1)×26 min → last Mar 30 ≈23:52
--   Loop B  :    61 partially_refunded orders (shopify_order_id 61654–61714)
--             5-slot cycle avg £89.60, 25% partial refund (vs April 50%)
--             date spread 2026-03-01 08:00 + (i-1)×12 h → last Mar 31 08:00
--   Batch C :    22 fully_refunded orders (shopify_order_id 61715–61736)
--             all v01 (Linen Dress S, £89), refunds = £106.80 (full VAT incl.)
--             date spread 2026-03-03 10:00 + (i-1)×24 h → last Mar 24 10:00
--
-- CUSTOMER DESIGN
--   c01–c15 : existing returning customers (first_order_at Feb 2026 < Mar 1)
--   c21–c28 : new March customers (first_order_at set to first March order)
--   c16–c20 : NOT included in March (their first_order_at stays April 2026,
--             preserving April's repeat_purchase_rate = 15/20 = 75%)
--   March RPR: 15 returning / 23 distinct = 65.2%
--
-- IDEMPOTENCY
--   Every INSERT uses ON CONFLICT DO NOTHING.
--
-- EXPECTED POST-MIGRATION METRIC VALUES (March 2026, dev store)
--   gross_revenue()            ≈ £150,245  (plan target ~£148k, +1.5% deviation)
--   net_sales()                ≈ £114,034  (plan target ~£115k, -0.9% deviation)
--   average_order_value()      ≈    £66.53  (plan target ~£67,   -0.7% deviation)
--   refund_rate()              ≈     2.47%  (plan target ~2.5%   ✓)
--   discount_dependency()      ≈     2.04%  (plan target ~2.0%   ✓)
--   repeat_purchase_rate()     ≈    65.2%   (plan target ~67%    ✓)
--   contribution_margin_pct()  ≈    89.47%  (plan target ~90.3%  — see NOTE)
--   operating_profit_monthly() ≈ −£20,772  (plan target ~−£19k  — see NOTE)
--   cash_runway_months()       unchanged ≈ 1.56 months
--
-- NOTE: CM and op_profit deviate from plan targets. The plan target of ~90.3%
-- CM is mathematically unachievable with the cost assumptions in
-- store_cost_assumptions and these order counts/prices. The achievable CM is
-- ~89.5% because:
--   variable_costs = payment_fees(2.9%) + per_order_costs(£4.75 × 1,714) / NS
--   With NS ≈ £114k and order_count 1,714: per_order_costs/NS ≈ 7.2%
--   Total variable rate ≈ 10.5% → CM ≈ 89.5%
-- For CM = 90.3%, net_AOV would need to be ≈ £75 (vs actual £66.53).
-- The MoM delta direction is still correct: March CM (89.5%) > April CM (88.7%)
-- showing real margin compression of −0.77pp. The margin_falling alert
-- (threshold −1.5pp) will NOT fire; refunds_rising, discounts_rising, and
-- runway_tightening will still fire.
--
-- MoM DELTAS (April vs March, using ABS denominator for op_profit):
--   gross_revenue   : +11.7%
--   net_sales       : +7.8%
--   average_order_value: −6.9%
--   contribution_margin_pct: −0.77pp
--   refund_rate     : +1.15pp
--   discount_dependency: +1.89pp
--   operating_profit: +51.0% (improved — smaller loss)
--   overhead        : −2.9%
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public, pg_temp;

BEGIN;

DO $$
DECLARE
  -- ── Store ──────────────────────────────────────────────────────────────────
  sid  uuid := '10000000-0000-0000-0000-000000000001';

  -- ── Existing returning customers c01–c15 (first_order_at Feb 2026) ─────────
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

  -- ── New March customers c21–c28 (first_order_at set to March 2026) ─────────
  -- c16–c20 are intentionally excluded from March orders to preserve April RPR.
  c21  uuid := '20000000-0000-0000-0000-000000000021';
  c22  uuid := '20000000-0000-0000-0000-000000000022';
  c23  uuid := '20000000-0000-0000-0000-000000000023';
  c24  uuid := '20000000-0000-0000-0000-000000000024';
  c25  uuid := '20000000-0000-0000-0000-000000000025';
  c26  uuid := '20000000-0000-0000-0000-000000000026';
  c27  uuid := '20000000-0000-0000-0000-000000000027';
  c28  uuid := '20000000-0000-0000-0000-000000000028';

  -- ── Products ───────────────────────────────────────────────────────────────
  p01  uuid := '30000000-0000-0000-0000-000000000001'; -- Linen Dress
  p03  uuid := '30000000-0000-0000-0000-000000000003'; -- Silk Blouse
  p04  uuid := '30000000-0000-0000-0000-000000000004'; -- Wool Jumper
  p05  uuid := '30000000-0000-0000-0000-000000000005'; -- Leather Tote

  -- ── Product variants ───────────────────────────────────────────────────────
  v01  uuid := '40000000-0000-0000-0000-000000000001'; -- Linen Dress S    £89
  v02  uuid := '40000000-0000-0000-0000-000000000002'; -- Linen Dress M    £89
  v05  uuid := '40000000-0000-0000-0000-000000000005'; -- Silk Blouse XS   £65
  v06  uuid := '40000000-0000-0000-0000-000000000006'; -- Wool Jumper M    £75
  v07  uuid := '40000000-0000-0000-0000-000000000007'; -- Wool Jumper L    £75
  v08  uuid := '40000000-0000-0000-0000-000000000008'; -- Leather Tote OS £120

  -- ── Schema detection ───────────────────────────────────────────────────────
  is_cloud boolean;

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
  -- SCHEMA DETECTION
  -- ═══════════════════════════════════════════════════════════════════════════
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'order_line_items'
      AND column_name  = 'discount'
  ) INTO is_cloud;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SECTION 1 — NEW MARCH CUSTOMERS c21–c28
  --   first_order_at is derived from MIN(created_at) in the UPDATE block at
  --   the end — same idempotent pattern as migration 000006.
  --   March RPR: 15 returning (c01–c15, first_order_at Feb) /
  --              23 distinct (c01–c15 + c21–c28) = 65.2%
  -- ═══════════════════════════════════════════════════════════════════════════

  INSERT INTO customers (id, store_id, shopify_customer_id, email, is_guest)
  VALUES
    (c21, sid, 1021, 'alex.reed@bloom-example.com',   false),
    (c22, sid, 1022, 'blake.morgan@bloom-example.com', false),
    (c23, sid, 1023, 'casey.brooks@bloom-example.com', false),
    (c24, sid, 1024, 'dana.hart@bloom-example.com',   false),
    (c25, sid, 1025, 'evan.cross@bloom-example.com',  false),
    (c26, sid, 1026, 'faye.duke@bloom-example.com',   false),
    (c27, sid, 1027, 'gabe.lane@bloom-example.com',   false),
    (c28, sid, 1028, 'hana.west@bloom-example.com',   false)
  ON CONFLICT (id) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SECTION 2 — LOOP A: 1,653 PAID ORDERS (shopify_order_id 60001–61653)
  --
  -- Product cycle (8-slot, avg £86.38 — premium mix, more Leather Tote & Dress):
  --   Slot 1: v08  Leather Tote OS  £120   p05
  --   Slot 2: v01  Linen Dress S     £89   p01
  --   Slot 3: v02  Linen Dress M     £89   p01
  --   Slot 4: v01  Linen Dress S     £89   p01
  --   Slot 5: v02  Linen Dress M     £89   p01
  --   Slot 6: v06  Wool Jumper M     £75   p04
  --   Slot 7: v07  Wool Jumper L     £75   p04
  --   Slot 8: v05  Silk Blouse XS    £65   p03
  --   1,653 = 206 complete cycles + 5 extra  |  SUM(gross) = £142,822
  --
  -- Discounts: i % 7 = 0  (236 orders, 3-way code cycle avg ~15%)
  --   CASE (i/7) % 3:
  --     0 → FLASH20  20%
  --     1 → SPRING15 15%
  --     2 → LOYAL10  10%
  --   SUM(discounts) ≈ £3,058  |  discount_dep ≈ 2.04%
  --
  -- Guests:    i % 13 = 0 (127 orders, ~7.7%)
  -- Customers: 23-pool cycle (c01–c15, c21–c28), ((i-1)%23)+1
  --   gcd(23,13)=1 → all 23 customers appear; all 23 appear in Loop B/C too
  -- Date: 2026-03-01 00:00 + (i-1)×26 min → last order i=1653 → Mar 30 ≈23:52
  -- ═══════════════════════════════════════════════════════════════════════════

  FOR i IN 1..1653 LOOP

    oid    := gen_random_uuid();
    date_v := '2026-03-01 00:00:00+00'::timestamptz + ((i - 1) * INTERVAL '26 minutes');

    -- Product selection (8-slot premium cycle)
    CASE ((i - 1) % 8) + 1
      WHEN 1 THEN vid := v08; pid := p05; price_v := 120.00;
      WHEN 2 THEN vid := v01; pid := p01; price_v :=  89.00;
      WHEN 3 THEN vid := v02; pid := p01; price_v :=  89.00;
      WHEN 4 THEN vid := v01; pid := p01; price_v :=  89.00;
      WHEN 5 THEN vid := v02; pid := p01; price_v :=  89.00;
      WHEN 6 THEN vid := v06; pid := p04; price_v :=  75.00;
      WHEN 7 THEN vid := v07; pid := p04; price_v :=  75.00;
      WHEN 8 THEN vid := v05; pid := p03; price_v :=  65.00;
    END CASE;

    gross_v := price_v;

    -- Discount application (every 7th order, 3-way code cycle avg 15%)
    IF i % 7 = 0 THEN
      CASE (i / 7) % 3
        WHEN 0 THEN disc_v := ROUND(gross_v * 0.20, 2); dc_code_v := 'FLASH20';
        WHEN 1 THEN disc_v := ROUND(gross_v * 0.15, 2); dc_code_v := 'SPRING15';
        WHEN 2 THEN disc_v := ROUND(gross_v * 0.10, 2); dc_code_v := 'LOYAL10';
      END CASE;
      dc_json_v := jsonb_build_array(jsonb_build_object('code', dc_code_v));
    ELSE
      disc_v    := 0.00;
      dc_json_v := NULL;
    END IF;

    tax_v   := ROUND((gross_v - disc_v) * 0.20, 2);
    total_v := ROUND((gross_v - disc_v) * 1.20, 2);

    -- Customer assignment (~7.7% guest, 23-customer pool for remainder)
    IF i % 13 = 0 THEN
      cust_v := NULL;
    ELSE
      cust_v := CASE ((i - 1) % 23) + 1
        WHEN  1 THEN c01  WHEN  2 THEN c02  WHEN  3 THEN c03  WHEN  4 THEN c04
        WHEN  5 THEN c05  WHEN  6 THEN c06  WHEN  7 THEN c07  WHEN  8 THEN c08
        WHEN  9 THEN c09  WHEN 10 THEN c10  WHEN 11 THEN c11  WHEN 12 THEN c12
        WHEN 13 THEN c13  WHEN 14 THEN c14  WHEN 15 THEN c15
        WHEN 16 THEN c21  WHEN 17 THEN c22  WHEN 18 THEN c23  WHEN 19 THEN c24
        WHEN 20 THEN c25  WHEN 21 THEN c26  WHEN 22 THEN c27  WHEN 23 THEN c28
      END;
    END IF;

    -- ── Orders INSERT ─────────────────────────────────────────────────────
    EXECUTE format(
      $sql$
      INSERT INTO orders
        (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
         financial_status, gross_sales, discounts, refunds, tax, total_sales,
         discount_codes)
      VALUES ($1, $2, %s, $3, $4, $4,
              'paid', $5, $6, 0.00, $7, $8, $9)
      ON CONFLICT (store_id, shopify_order_id) DO NOTHING
      $sql$,
      60000 + i
    ) USING oid, sid, cust_v, date_v, gross_v, disc_v, tax_v, total_v, dc_json_v;

    -- ── Order line item INSERT ────────────────────────────────────────────
    IF is_cloud THEN
      EXECUTE format(
        $sql$
        INSERT INTO order_line_items
          (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
           quantity, price, discount, total)
        SELECT gen_random_uuid(), $1, o.id, $2, $3, %L,
               1, $4, $5, $4 - $5
        FROM orders o
        WHERE o.store_id = $1 AND o.shopify_order_id = %L
        ON CONFLICT (store_id, shopify_line_item_id) DO NOTHING
        $sql$,
        (60000 + i)::text, (60000 + i)::text
      ) USING sid, pid, vid, price_v, disc_v;
    ELSE
      EXECUTE format(
        $sql$
        INSERT INTO order_line_items
          (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
           quantity, price, total_discount)
        SELECT gen_random_uuid(), $1, o.id, $2, $3, %s,
               1, $4, $5
        FROM orders o
        WHERE o.store_id = $1 AND o.shopify_order_id = %s
        ON CONFLICT (store_id, shopify_line_item_id) DO NOTHING
        $sql$,
        60000 + i, 60000 + i
      ) USING sid, pid, vid, price_v, disc_v;
    END IF;

  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SECTION 3 — LOOP B: 61 PARTIALLY REFUNDED ORDERS (shopify_order_id 61654–61714)
  --
  -- Product cycle (5-slot, avg £89.60 — same as April Loop B):
  --   Slot 1: v01  Linen Dress S    £89   p01
  --   Slot 2: v02  Linen Dress M    £89   p01
  --   Slot 3: v06  Wool Jumper M    £75   p04
  --   Slot 4: v07  Wool Jumper L    £75   p04
  --   Slot 5: v08  Leather Tote OS £120   p05
  --   61 = 12 complete cycles + 1 extra  |  SUM(gross) = £5,465
  --
  -- Partial refund: 25% of gross (vs April's 50%) — lower refund rate target.
  -- SUM(refunds) ≈ £1,366  |  contributes to refund_rate ≈ 2.47%
  --
  -- No discounts.
  -- Customers: ((i-1)%15)+1 → c01–c15 (all returning in March).
  -- Date: 2026-03-01 08:00 + (i-1)×12 h → last order Mar 31 08:00
  -- ═══════════════════════════════════════════════════════════════════════════

  FOR i IN 1..61 LOOP

    oid    := gen_random_uuid();
    date_v := '2026-03-01 08:00:00+00'::timestamptz + ((i - 1) * INTERVAL '12 hours');

    CASE ((i - 1) % 5) + 1
      WHEN 1 THEN vid := v01; pid := p01; price_v :=  89.00;
      WHEN 2 THEN vid := v02; pid := p01; price_v :=  89.00;
      WHEN 3 THEN vid := v06; pid := p04; price_v :=  75.00;
      WHEN 4 THEN vid := v07; pid := p04; price_v :=  75.00;
      WHEN 5 THEN vid := v08; pid := p05; price_v := 120.00;
    END CASE;

    gross_v  := price_v;
    disc_v   := 0.00;
    refund_v := ROUND(gross_v * 0.25, 2);   -- 25% partial refund
    tax_v    := ROUND(gross_v * 0.20, 2);
    total_v  := gross_v + tax_v;            -- pre-refund order total

    cust_v := CASE ((i - 1) % 15) + 1
      WHEN  1 THEN c01  WHEN  2 THEN c02  WHEN  3 THEN c03
      WHEN  4 THEN c04  WHEN  5 THEN c05  WHEN  6 THEN c06
      WHEN  7 THEN c07  WHEN  8 THEN c08  WHEN  9 THEN c09
      WHEN 10 THEN c10  WHEN 11 THEN c11  WHEN 12 THEN c12
      WHEN 13 THEN c13  WHEN 14 THEN c14  WHEN 15 THEN c15
    END;

    EXECUTE format(
      $sql$
      INSERT INTO orders
        (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
         financial_status, gross_sales, discounts, refunds, tax, total_sales)
      VALUES ($1, $2, %s, $3, $4, $4,
              'partially_refunded', $5, 0.00, $6, $7, $8)
      ON CONFLICT (store_id, shopify_order_id) DO NOTHING
      $sql$,
      61653 + i
    ) USING oid, sid, cust_v, date_v, gross_v, refund_v, tax_v, total_v;

    IF is_cloud THEN
      EXECUTE format(
        $sql$
        INSERT INTO order_line_items
          (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
           quantity, price, discount, total)
        SELECT gen_random_uuid(), $1, o.id, $2, $3, %L,
               1, $4, 0.00, $4
        FROM orders o
        WHERE o.store_id = $1 AND o.shopify_order_id = %L
        ON CONFLICT (store_id, shopify_line_item_id) DO NOTHING
        $sql$,
        (61653 + i)::text, (61653 + i)::text
      ) USING sid, pid, vid, price_v;
    ELSE
      EXECUTE format(
        $sql$
        INSERT INTO order_line_items
          (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
           quantity, price, total_discount)
        SELECT gen_random_uuid(), $1, o.id, $2, $3, %s,
               1, $4, 0.00
        FROM orders o
        WHERE o.store_id = $1 AND o.shopify_order_id = %s
        ON CONFLICT (store_id, shopify_line_item_id) DO NOTHING
        $sql$,
        61653 + i, 61653 + i
      ) USING sid, pid, vid, price_v;
    END IF;

  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SECTION 4 — BATCH C: 22 FULLY REFUNDED ORDERS (shopify_order_id 61715–61736)
  --
  -- All orders: v01 (Linen Dress S, £89).
  -- refunds = total_sales = £106.80 (full refund including VAT).
  -- Excluded from order_count() — does not affect AOV denominator.
  -- Net contribution per order = £89 − £106.80 − £17.80 = −£35.60
  -- SUM(gross) = £1,958  |  SUM(refunds) = £2,349.60
  --
  -- Customers: ((i-1)%10)+1 → c01–c10 (all returning in March).
  -- Date: 2026-03-03 10:00 + (i-1)×24 h → last order i=22 → Mar 24 10:00
  -- ═══════════════════════════════════════════════════════════════════════════

  FOR i IN 1..22 LOOP

    oid    := gen_random_uuid();
    date_v := '2026-03-03 10:00:00+00'::timestamptz + ((i - 1) * INTERVAL '24 hours');

    vid     := v01;
    pid     := p01;
    price_v := 89.00;
    gross_v := 89.00;
    disc_v  := 0.00;
    tax_v   := ROUND(gross_v * 0.20, 2);   -- £17.80
    refund_v := ROUND(gross_v * 1.20, 2);  -- £106.80 (full VAT-inclusive refund)
    total_v := gross_v + tax_v;            -- £106.80

    cust_v := CASE ((i - 1) % 10) + 1
      WHEN 1 THEN c01  WHEN 2 THEN c02  WHEN 3 THEN c03  WHEN 4 THEN c04
      WHEN 5 THEN c05  WHEN 6 THEN c06  WHEN 7 THEN c07  WHEN 8 THEN c08
      WHEN 9 THEN c09  WHEN 10 THEN c10
    END;

    EXECUTE format(
      $sql$
      INSERT INTO orders
        (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
         financial_status, gross_sales, discounts, refunds, tax, total_sales)
      VALUES ($1, $2, %s, $3, $4, $4,
              'refunded', $5, 0.00, $6, $7, $8)
      ON CONFLICT (store_id, shopify_order_id) DO NOTHING
      $sql$,
      61714 + i
    ) USING oid, sid, cust_v, date_v, gross_v, refund_v, tax_v, total_v;

    IF is_cloud THEN
      EXECUTE format(
        $sql$
        INSERT INTO order_line_items
          (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
           quantity, price, discount, total)
        SELECT gen_random_uuid(), $1, o.id, $2, $3, %L,
               1, $4, 0.00, $4
        FROM orders o
        WHERE o.store_id = $1 AND o.shopify_order_id = %L
        ON CONFLICT (store_id, shopify_line_item_id) DO NOTHING
        $sql$,
        (61714 + i)::text, (61714 + i)::text
      ) USING sid, p01, v01, price_v;
    ELSE
      EXECUTE format(
        $sql$
        INSERT INTO order_line_items
          (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
           quantity, price, total_discount)
        SELECT gen_random_uuid(), $1, o.id, $2, $3, %s,
               1, $4, 0.00
        FROM orders o
        WHERE o.store_id = $1 AND o.shopify_order_id = %s
        ON CONFLICT (store_id, shopify_line_item_id) DO NOTHING
        $sql$,
        61714 + i, 61714 + i
      ) USING sid, p01, v01, price_v;
    END IF;

  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SECTION 5 — UPDATE customers: first_order_at and total_orders
  --
  -- LEAST(COALESCE(existing, new), new) pattern (idempotent):
  --   c01–c15: first_order_at Feb 2026; LEAST(Feb, March) = Feb → unchanged ✓
  --   c21–c28: no prior orders; set to MIN(March created_at) → March 1 2026
  --   c16–c20: no March orders; their first_order_at stays April 2026 ✓
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
      MIN(created_at) AS first_order,
      COUNT(*)::int   AS cnt
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
