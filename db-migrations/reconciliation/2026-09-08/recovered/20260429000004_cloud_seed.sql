-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 20260429000004 — Cloud-safe Phase 1 seed dataset
--
-- Seeds the full 108-order Phase 1 test dataset into the cloud Supabase
-- development store (store_id = 10000000-0000-0000-0000-000000000001).
--
-- SAFE TO RE-RUN: every INSERT uses ON CONFLICT DO NOTHING.
-- DOES NOT TRUNCATE: existing rows are left untouched.
--
-- Cloud vs local schema differences reconciled:
--   order_line_items : no title / no compare_at_price;
--                      total_discount → discount; added total = price - discount
--   refunds          : refund_subtotal → amount; created_at used as refund_date
--   opportunities    : uplift_low/high → impact_low/high; priority_rank → priority;
--                      action_label/why_label columns do not exist
--   cfo_alerts       : alert_key → alert_type; title is NOT NULL (values inlined);
--                      is_triggered dropped; is_read defaults to false
--
-- Dataset:
--   1  store (already exists — skipped)
--   1  store_settings
--   1  store_cost_assumptions (effective_from 2025-01-01)
--   15 customers  ·  6 products  ·  10 product_variants
--   13 special orders + 95 loop orders = 108 seed orders
--   + 2 existing manual test orders (untouched)
--   ~130 order_line_items
--   14 refund events  ·  14 refund_line_items
--   5  discounts  ·  8  discount_codes
--   3  opportunities  ·  5  cfo_alerts
--
-- Opportunities uplift totals:
--   impact_low  = 8 000 + 6 000 + 4 000 = 18 000  (RECOVERABLE_LOW)
--   impact_high = 18 000 + 14 000 + 10 000 = 42 000 (RECOVERABLE_HIGH)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  -- ── Store ──────────────────────────────────────────────────────────────────
  sid  uuid := '10000000-0000-0000-0000-000000000001';

  -- ── Customers ──────────────────────────────────────────────────────────────
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

  -- ── Products ───────────────────────────────────────────────────────────────
  p01  uuid := '30000000-0000-0000-0000-000000000001';
  p02  uuid := '30000000-0000-0000-0000-000000000002';
  p03  uuid := '30000000-0000-0000-0000-000000000003';
  p04  uuid := '30000000-0000-0000-0000-000000000004';
  p05  uuid := '30000000-0000-0000-0000-000000000005';
  p06  uuid := '30000000-0000-0000-0000-000000000006';

  -- ── Product Variants ───────────────────────────────────────────────────────
  v01  uuid := '40000000-0000-0000-0000-000000000001';
  v02  uuid := '40000000-0000-0000-0000-000000000002';
  v03  uuid := '40000000-0000-0000-0000-000000000003';
  v04  uuid := '40000000-0000-0000-0000-000000000004';
  v05  uuid := '40000000-0000-0000-0000-000000000005';
  v06  uuid := '40000000-0000-0000-0000-000000000006';
  v07  uuid := '40000000-0000-0000-0000-000000000007';
  v08  uuid := '40000000-0000-0000-0000-000000000008';
  v09  uuid := '40000000-0000-0000-0000-000000000009';
  v10  uuid := '40000000-0000-0000-0000-000000000010';

  -- ── Discounts ──────────────────────────────────────────────────────────────
  d01  uuid := '50000000-0000-0000-0000-000000000001';
  d02  uuid := '50000000-0000-0000-0000-000000000002';
  d03  uuid := '50000000-0000-0000-0000-000000000003';
  d04  uuid := '50000000-0000-0000-0000-000000000004';
  d05  uuid := '50000000-0000-0000-0000-000000000005';

  -- ── Special orders ─────────────────────────────────────────────────────────
  or01 uuid := 'a0000000-0000-0000-0000-000000000001';
  or02 uuid := 'a0000000-0000-0000-0000-000000000002';
  or03 uuid := 'a0000000-0000-0000-0000-000000000003';
  or04 uuid := 'a0000000-0000-0000-0000-000000000004';
  or05 uuid := 'a0000000-0000-0000-0000-000000000005';
  or06 uuid := 'a0000000-0000-0000-0000-000000000006';
  or07 uuid := 'a0000000-0000-0000-0000-000000000007';
  or08 uuid := 'a0000000-0000-0000-0000-000000000008';
  or09 uuid := 'a0000000-0000-0000-0000-000000000009';
  or10 uuid := 'a0000000-0000-0000-0000-000000000010';
  or11 uuid := 'a0000000-0000-0000-0000-000000000011';
  or12 uuid := 'a0000000-0000-0000-0000-000000000012';
  or13 uuid := 'a0000000-0000-0000-0000-000000000013';

  -- ── Order line items (special orders, fixed UUIDs for refund FKs) ──────────
  li01  uuid := 'b0000000-0000-0000-0000-000000000001';
  li02  uuid := 'b0000000-0000-0000-0000-000000000002';
  li03a uuid := 'b0000000-0000-0000-0000-000000000003';
  li03b uuid := 'b0000000-0000-0000-0000-000000000004';
  li04a uuid := 'b0000000-0000-0000-0000-000000000005';
  li04b uuid := 'b0000000-0000-0000-0000-000000000006';
  li05  uuid := 'b0000000-0000-0000-0000-000000000007';
  li06a uuid := 'b0000000-0000-0000-0000-000000000008';
  li06b uuid := 'b0000000-0000-0000-0000-000000000009';
  li07a uuid := 'b0000000-0000-0000-0000-000000000010';
  li07b uuid := 'b0000000-0000-0000-0000-000000000011';
  li08a uuid := 'b0000000-0000-0000-0000-000000000012';
  li08b uuid := 'b0000000-0000-0000-0000-000000000013';
  li09  uuid := 'b0000000-0000-0000-0000-000000000014';
  li10  uuid := 'b0000000-0000-0000-0000-000000000015';
  li11  uuid := 'b0000000-0000-0000-0000-000000000016';
  li12  uuid := 'b0000000-0000-0000-0000-000000000017';
  li13  uuid := 'b0000000-0000-0000-0000-000000000018';

  -- ── Refund events ──────────────────────────────────────────────────────────
  rf01  uuid := 'c0000000-0000-0000-0000-000000000001';
  rf02  uuid := 'c0000000-0000-0000-0000-000000000002';
  rf03  uuid := 'c0000000-0000-0000-0000-000000000003';
  rf04  uuid := 'c0000000-0000-0000-0000-000000000004';
  rf05  uuid := 'c0000000-0000-0000-0000-000000000005';
  rf06  uuid := 'c0000000-0000-0000-0000-000000000006';
  rf07  uuid := 'c0000000-0000-0000-0000-000000000007';
  rf08a uuid := 'c0000000-0000-0000-0000-000000000008';
  rf08b uuid := 'c0000000-0000-0000-0000-000000000009';
  rf09  uuid := 'c0000000-0000-0000-0000-000000000010';
  rf10  uuid := 'c0000000-0000-0000-0000-000000000011';
  rf11  uuid := 'c0000000-0000-0000-0000-000000000012';
  rf12  uuid := 'c0000000-0000-0000-0000-000000000013';
  rf13  uuid := 'c0000000-0000-0000-0000-000000000014';

  -- ── Loop variables ─────────────────────────────────────────────────────────
  i         int;
  oid       uuid;
  vid       uuid;
  pid       uuid;
  price_v   numeric;
  title_v   text;
  gross_v   numeric;
  disc_v    numeric;
  net_v     numeric;
  tax_v     numeric;
  total_v   numeric;
  cust_v    uuid;
  status_v  text;
  date_v    timestamptz;
  dc_json_v jsonb;
  dc_code_v text;

BEGIN

  -- ===========================================================================
  -- 1. STORES — skip if already exists (seeded in remediation migration)
  -- ===========================================================================
  INSERT INTO stores (id, shopify_domain, shopify_store_id, name, currency_code, timezone, is_active)
  VALUES (sid, 'bloom-and-co.myshopify.com', 'shop_98765432',
          'Bloom & Co.', 'GBP', 'Europe/London', true)
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 2. STORE SETTINGS
  -- ===========================================================================
  INSERT INTO store_settings (store_id, cm_target_pct, runway_warn_months, repeat_rate_target_pct)
  VALUES (sid, 30.00, 3.00, 25.00)
  ON CONFLICT (store_id) DO NOTHING;

  -- ===========================================================================
  -- 3. STORE COST ASSUMPTIONS — 2025-01-01 row (commerceMetrics values)
  --    v_current_cost_assumptions will return the 2026-01-01 row (from migration 003)
  --    since it has the later effective_from. Both coexist safely.
  -- ===========================================================================
  INSERT INTO store_cost_assumptions
    (store_id, payment_fee_rate, fulfilment_cost_per_order,
     packaging_cost_per_order, return_handling_rate, effective_from)
  VALUES (sid, 0.02500, 3.50, 1.20, 0.15000, '2025-01-01')
  ON CONFLICT (store_id, effective_from) DO NOTHING;

  -- ===========================================================================
  -- 4. CUSTOMERS (15)
  -- ===========================================================================
  INSERT INTO customers (id, store_id, shopify_customer_id, email, is_guest)
  VALUES
    (c01, sid, 1001, 'alice.johnson@example.com',  false),
    (c02, sid, 1002, 'bob.smith@example.com',      false),
    (c03, sid, 1003, 'carol.white@example.com',    false),
    (c04, sid, 1004, 'david.brown@example.com',    false),
    (c05, sid, 1005, 'emily.davies@example.com',   false),
    (c06, sid, 1006, 'frank.wilson@example.com',   false),
    (c07, sid, 1007, 'grace.taylor@example.com',   false),
    (c08, sid, 1008, 'henry.moore@example.com',    false),
    (c09, sid, 1009, 'isla.anderson@example.com',  false),
    (c10, sid, 1010, 'james.thomas@example.com',   false),
    (c11, sid, 1011, 'kate.jackson@example.com',   false),
    (c12, sid, 1012, 'liam.harris@example.com',    false),
    (c13, sid, 1013, 'mia.martin@example.com',     false),
    (c14, sid, 1014, 'noah.thompson@example.com',  false),
    (c15, sid, 1015, 'olivia.garcia@example.com',  false)
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 5. PRODUCTS (6)
  -- ===========================================================================
  INSERT INTO products (id, store_id, shopify_product_id, title, status)
  VALUES
    (p01, sid, 9001, 'Linen Dress',     'active'),
    (p02, sid, 9002, 'Cotton Tee',      'active'),
    (p03, sid, 9003, 'Silk Blouse',     'active'),
    (p04, sid, 9004, 'Wool Jumper',     'active'),
    (p05, sid, 9005, 'Leather Tote',    'active'),
    (p06, sid, 9006, 'Canvas Sneakers', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 6. PRODUCT VARIANTS (10)
  -- ===========================================================================
  INSERT INTO product_variants
    (id, store_id, product_id, shopify_variant_id, title, sku,
     price, compare_at_price, cost, inventory_quantity)
  VALUES
    (v01, sid, p01, 8001, 'Size S',   'LD-S',   89.00, 120.00, 32.00, 45),
    (v02, sid, p01, 8002, 'Size M',   'LD-M',   89.00, 120.00, 32.00, 38),
    (v03, sid, p02, 8003, 'White',    'CT-W',   30.00,   NULL,  8.50, 120),
    (v04, sid, p02, 8004, 'Navy',     'CT-N',   30.00,   NULL,  8.50,  95),
    (v05, sid, p03, 8005, 'XS',       'SB-XS',  65.00,  85.00,  NULL,  22),
    (v06, sid, p04, 8006, 'M',        'WJ-M',   75.00,   NULL,  NULL,  31),
    (v07, sid, p04, 8007, 'L',        'WJ-L',   75.00,   NULL, 28.00,  29),
    (v08, sid, p05, 8008, 'One Size', 'LT-OS', 120.00,   NULL,  NULL,  18),
    (v09, sid, p06, 8009, 'UK 5',     'CS-5',   55.00,   NULL, 18.00,  42),
    (v10, sid, p06, 8010, 'UK 6',     'CS-6',   55.00,   NULL, 18.00,  37)
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 7. DISCOUNTS (5 price rules)
  -- ===========================================================================
  INSERT INTO discounts
    (id, store_id, shopify_price_rule_id, title, value_type, value, category)
  VALUES
    (d01, sid, 7001, 'Loyalty Reward 10%',   'percentage',   -10.00, 'loyalty'),
    (d02, sid, 7002, 'New Customer 15% Off', 'percentage',   -15.00, 'promotional'),
    (d03, sid, 7003, 'Refer a Friend £10',   'fixed_amount', -10.00, 'referral'),
    (d04, sid, 7004, 'Trade Account 20%',    'percentage',   -20.00, 'wholesale'),
    (d05, sid, 7005, 'Flash Sale 25% Off',   'percentage',   -25.00, 'other')
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 8. DISCOUNT CODES (8)
  -- ===========================================================================
  INSERT INTO discount_codes (id, store_id, discount_id, code, usage_count)
  VALUES
    ('60000000-0000-0000-0000-000000000001', sid, d01, 'LOYALTY10',   42),
    ('60000000-0000-0000-0000-000000000002', sid, d01, 'VIP15',       18),
    ('60000000-0000-0000-0000-000000000003', sid, d02, 'WELCOME15',   67),
    ('60000000-0000-0000-0000-000000000004', sid, d02, 'SUMMER10',    23),
    ('60000000-0000-0000-0000-000000000005', sid, d03, 'REFERFRIEND', 31),
    ('60000000-0000-0000-0000-000000000006', sid, d03, 'PARTNER20',   14),
    ('60000000-0000-0000-0000-000000000007', sid, d04, 'TRADE20',     29),
    ('60000000-0000-0000-0000-000000000008', sid, d05, 'FLASH25',     38)
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 9. SPECIAL ORDERS (or01–or13)
  --    shopify_order_id stored as text; integers 20001–20013 don't conflict
  --    with existing cloud orders (gid://shopify/Order/4001, 4002).
  -- ===========================================================================
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES
    (or01, sid, '20001', c01, '2026-02-05 10:23:00+00', '2026-02-07 14:00:00+00',
     'partially_refunded', 60.00, 0.00, 36.00, 12.00, 72.00),
    (or02, sid, '20002', c02, '2026-02-14 15:42:00+00', '2026-02-17 10:00:00+00',
     'partially_refunded', 89.00, 0.00, 50.00, 17.80, 106.80),
    (or03, sid, '20003', c03, '2026-03-08 09:15:00+00', '2026-03-10 11:00:00+00',
     'partially_refunded', 105.00, 0.00, 36.00, 21.00, 126.00),
    (or04, sid, '20004', c04, '2026-03-15 12:00:00+00', '2026-03-17 09:00:00+00',
     'partially_refunded', 150.00, 0.00, 36.00, 30.00, 180.00),
    (or05, sid, '20005', c05, '2026-03-22 16:30:00+00', '2026-03-24 10:00:00+00',
     'partially_refunded', 65.00, 0.00, 39.00, 13.00, 78.00),
    (or06, sid, '20006', c06, '2026-04-03 11:00:00+00', '2026-04-05 14:00:00+00',
     'partially_refunded', 110.00, 0.00, 66.00, 22.00, 132.00),
    (or07, sid, '20007', c07, '2026-04-10 14:20:00+00', '2026-04-12 10:00:00+00',
     'partially_refunded', 119.00, 0.00, 36.00, 23.80, 142.80),
    (or08, sid, '20008', c08, '2026-03-28 09:00:00+00', '2026-04-02 16:00:00+00',
     'partially_refunded', 195.00, 0.00, 144.00, 39.00, 234.00),
    (or09, sid, '20009', NULL, '2026-02-20 18:00:00+00', '2026-02-23 10:00:00+00',
     'refunded', 30.00, 0.00, 36.00, 6.00, 36.00),
    (or10, sid, '20010', c09, '2026-02-26 11:00:00+00', '2026-03-01 09:00:00+00',
     'refunded', 65.00, 0.00, 78.00, 13.00, 78.00),
    (or11, sid, '20011', c10, '2026-03-18 13:00:00+00', '2026-03-21 10:00:00+00',
     'refunded', 75.00, 0.00, 90.00, 15.00, 90.00),
    (or12, sid, '20012', c11, '2026-04-14 10:00:00+00', '2026-04-16 14:00:00+00',
     'refunded', 89.00, 0.00, 106.80, 17.80, 106.80),
    (or13, sid, '20013', NULL, '2026-04-18 16:00:00+00', '2026-04-20 10:00:00+00',
     'refunded', 55.00, 0.00, 66.00, 11.00, 66.00)
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 10. ORDER LINE ITEMS — special orders
  --
  --  Cloud schema: id, store_id, order_id, product_id, variant_id,
  --                shopify_line_item_id (text), quantity, price, discount, total
  --  (no title, no compare_at_price)
  -- ===========================================================================
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     quantity, price, discount, total)
  VALUES
    (li01,  sid, or01, p02, v03, '30001', 2,  30.00, 0.00,   60.00),
    (li02,  sid, or02, p01, v01, '30002', 1,  89.00, 0.00,   89.00),
    (li03a, sid, or03, p04, v07, '30003', 1,  75.00, 0.00,   75.00),
    (li03b, sid, or03, p02, v04, '30004', 1,  30.00, 0.00,   30.00),
    (li04a, sid, or04, p05, v08, '30005', 1, 120.00, 0.00,  120.00),
    (li04b, sid, or04, p02, v03, '30006', 1,  30.00, 0.00,   30.00),
    (li05,  sid, or05, p03, v05, '30007', 1,  65.00, 0.00,   65.00),
    (li06a, sid, or06, p06, v09, '30008', 1,  55.00, 0.00,   55.00),
    (li06b, sid, or06, p06, v10, '30009', 1,  55.00, 0.00,   55.00),
    (li07a, sid, or07, p01, v02, '30010', 1,  89.00, 0.00,   89.00),
    (li07b, sid, or07, p02, v03, '30011', 1,  30.00, 0.00,   30.00),
    (li08a, sid, or08, p04, v06, '30012', 1,  75.00, 0.00,   75.00),
    (li08b, sid, or08, p05, v08, '30013', 1, 120.00, 0.00,  120.00),
    (li09,  sid, or09, p02, v03, '30014', 1,  30.00, 0.00,   30.00),
    (li10,  sid, or10, p03, v05, '30015', 1,  65.00, 0.00,   65.00),
    (li11,  sid, or11, p04, v06, '30016', 1,  75.00, 0.00,   75.00),
    (li12,  sid, or12, p01, v01, '30017', 1,  89.00, 0.00,   89.00),
    (li13,  sid, or13, p06, v09, '30018', 1,  55.00, 0.00,   55.00)
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 11. REGULAR ORDERS — 95 orders via loop (shopify_order_ids 20101–20195)
  --
  --  Date spread: '2026-02-01' + (i × 17 h) → spans Feb, Mar, early Apr
  --  Cancelled: i % 13 = 0 → 7 orders
  --  Discounted: i % 4 = 0 → 24 orders, type cycles 0–5
  --  Guest: i % 8 = 0 → 11 orders; else cycle c01–c15
  -- ===========================================================================
  FOR i IN 1..95 LOOP
    oid   := gen_random_uuid();
    date_v := '2026-02-01 00:00:00+00'::timestamptz + (i * INTERVAL '17 hours');

    CASE ((i - 1) % 10) + 1
      WHEN 1  THEN vid := v01; pid := p01; price_v := 89.00;  title_v := 'Linen Dress – Size S';
      WHEN 2  THEN vid := v02; pid := p01; price_v := 89.00;  title_v := 'Linen Dress – Size M';
      WHEN 3  THEN vid := v03; pid := p02; price_v := 30.00;  title_v := 'Cotton Tee – White';
      WHEN 4  THEN vid := v04; pid := p02; price_v := 30.00;  title_v := 'Cotton Tee – Navy';
      WHEN 5  THEN vid := v05; pid := p03; price_v := 65.00;  title_v := 'Silk Blouse – XS';
      WHEN 6  THEN vid := v06; pid := p04; price_v := 75.00;  title_v := 'Wool Jumper – M';
      WHEN 7  THEN vid := v07; pid := p04; price_v := 75.00;  title_v := 'Wool Jumper – L';
      WHEN 8  THEN vid := v08; pid := p05; price_v := 120.00; title_v := 'Leather Tote';
      WHEN 9  THEN vid := v09; pid := p06; price_v := 55.00;  title_v := 'Canvas Sneakers – UK 5';
      WHEN 10 THEN vid := v10; pid := p06; price_v := 55.00;  title_v := 'Canvas Sneakers – UK 6';
    END CASE;

    IF i % 8 = 0 THEN
      cust_v := NULL;
    ELSE
      cust_v := CASE ((i - 1) % 15) + 1
        WHEN 1  THEN c01 WHEN 2  THEN c02 WHEN 3  THEN c03
        WHEN 4  THEN c04 WHEN 5  THEN c05 WHEN 6  THEN c06
        WHEN 7  THEN c07 WHEN 8  THEN c08 WHEN 9  THEN c09
        WHEN 10 THEN c10 WHEN 11 THEN c11 WHEN 12 THEN c12
        WHEN 13 THEN c13 WHEN 14 THEN c14 WHEN 15 THEN c15
      END;
    END IF;

    status_v := CASE WHEN i % 13 = 0 THEN 'cancelled' ELSE 'paid' END;

    gross_v := price_v;
    IF i % 4 = 0 THEN
      CASE (i / 4) % 6
        WHEN 0 THEN disc_v := round(gross_v * 0.15, 2); dc_code_v := 'WELCOME15';
        WHEN 1 THEN disc_v := round(gross_v * 0.10, 2); dc_code_v := 'LOYALTY10';
        WHEN 2 THEN disc_v := round(gross_v * 0.25, 2); dc_code_v := 'FLASH25';
        WHEN 3 THEN disc_v := LEAST(10.00, gross_v);    dc_code_v := 'REFERFRIEND';
        WHEN 4 THEN disc_v := round(gross_v * 0.20, 2); dc_code_v := 'TRADE20';
        WHEN 5 THEN disc_v := round(gross_v * 0.15, 2); dc_code_v := 'VIP15';
      END CASE;
      dc_json_v := jsonb_build_array(jsonb_build_object('code', dc_code_v));
    ELSE
      disc_v    := 0.00;
      dc_json_v := NULL;
    END IF;

    net_v   := gross_v - disc_v;
    tax_v   := round(net_v * 0.20, 2);
    total_v := net_v + tax_v;

    INSERT INTO orders
      (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
       financial_status, gross_sales, discounts, refunds, tax, total_sales, discount_codes)
    VALUES
      (oid, sid, (20100 + i)::text, cust_v, date_v, date_v,
       status_v, gross_v, disc_v, 0.00, tax_v, total_v, dc_json_v)
    ON CONFLICT (store_id, shopify_order_id) DO NOTHING;

    -- Line item: join back on shopify_order_id for the stable order FK.
    -- ON CONFLICT on (store_id, shopify_line_item_id) — idempotent.
    INSERT INTO order_line_items
      (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
       quantity, price, discount, total)
    SELECT gen_random_uuid(), sid,
           o.id, pid, vid, (30100 + i)::text,
           1, price_v, disc_v, price_v - disc_v
    FROM   orders o
    WHERE  o.store_id = sid
      AND  o.shopify_order_id = (20100 + i)::text
    ON CONFLICT (store_id, shopify_line_item_id) DO NOTHING;

  END LOOP;

  -- ===========================================================================
  -- Update customers: first_order_at and total_orders
  -- Uses LEAST() so an existing earlier date is never overwritten.
  -- Only updates seed customers c01–c15 (UUIDs 20000000-...-0001 to -0015).
  -- The 2 existing cloud orders (customer_id = 8b663557-...) are unaffected.
  -- ===========================================================================
  UPDATE customers c
  SET
    first_order_at = COALESCE(
                       LEAST(c.first_order_at, sub.first_order),
                       sub.first_order
                     ),
    total_orders   = sub.cnt
  FROM (
    SELECT customer_id,
           MIN(created_at) AS first_order,
           COUNT(*)::int   AS cnt
    FROM   orders
    WHERE  store_id = sid
      AND  customer_id IS NOT NULL
    GROUP  BY customer_id
  ) sub
  WHERE c.id = sub.customer_id
    AND c.store_id = sid;

  -- ===========================================================================
  -- 12. REFUNDS (14 events)
  --
  --  Cloud schema: id, store_id, order_id, shopify_refund_id (text nullable),
  --                refund_date (timestamptz nullable), amount (numeric nullable),
  --                reason (text nullable), created_at (not null, defaults now())
  --  Mapping: seed refund_subtotal → amount; seed created_at → refund_date
  -- ===========================================================================
  INSERT INTO refunds
    (id, store_id, order_id, shopify_refund_id, refund_date, amount)
  VALUES
    (rf01,  sid, or01, '40001',  '2026-02-07 14:00:00+00',  36.00),
    (rf02,  sid, or02, '40002',  '2026-02-17 10:00:00+00',  50.00),
    (rf03,  sid, or03, '40003',  '2026-03-10 11:00:00+00',  36.00),
    (rf04,  sid, or04, '40004',  '2026-03-17 09:00:00+00',  36.00),
    (rf05,  sid, or05, '40005',  '2026-03-24 10:00:00+00',  39.00),
    (rf06,  sid, or06, '40006',  '2026-04-05 14:00:00+00',  66.00),
    (rf07,  sid, or07, '40007',  '2026-04-12 10:00:00+00',  36.00),
    (rf08a, sid, or08, '40008',  '2026-03-31 09:00:00+00',  90.00),
    (rf08b, sid, or08, '40009',  '2026-04-02 16:00:00+00',  54.00),
    (rf09,  sid, or09, '40010',  '2026-02-23 10:00:00+00',  36.00),
    (rf10,  sid, or10, '40011',  '2026-03-01 09:00:00+00',  78.00),
    (rf11,  sid, or11, '40012',  '2026-03-21 10:00:00+00',  90.00),
    (rf12,  sid, or12, '40013',  '2026-04-16 14:00:00+00', 106.80),
    (rf13,  sid, or13, '40014',  '2026-04-20 10:00:00+00',  66.00)
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 13. REFUND LINE ITEMS (14 rows)
  -- ===========================================================================
  INSERT INTO refund_line_items
    (id, store_id, refund_id, order_line_item_id, quantity, subtotal)
  VALUES
    ('d0000000-0000-0000-0000-000000000001', sid, rf01,  li01,  1, 30.00),
    ('d0000000-0000-0000-0000-000000000002', sid, rf02,  li02,  1, 41.67),
    ('d0000000-0000-0000-0000-000000000003', sid, rf03,  li03b, 1, 30.00),
    ('d0000000-0000-0000-0000-000000000004', sid, rf04,  li04b, 1, 30.00),
    ('d0000000-0000-0000-0000-000000000005', sid, rf05,  li05,  1, 32.50),
    ('d0000000-0000-0000-0000-000000000006', sid, rf06,  li06a, 1, 55.00),
    ('d0000000-0000-0000-0000-000000000007', sid, rf07,  li07b, 1, 30.00),
    ('d0000000-0000-0000-0000-000000000008', sid, rf08a, li08a, 1, 75.00),
    ('d0000000-0000-0000-0000-000000000009', sid, rf08b, li08b, 1, 45.00),
    ('d0000000-0000-0000-0000-000000000010', sid, rf09,  li09,  1, 30.00),
    ('d0000000-0000-0000-0000-000000000011', sid, rf10,  li10,  1, 65.00),
    ('d0000000-0000-0000-0000-000000000012', sid, rf11,  li11,  1, 75.00),
    ('d0000000-0000-0000-0000-000000000013', sid, rf12,  li12,  1, 89.00),
    ('d0000000-0000-0000-0000-000000000014', sid, rf13,  li13,  1, 55.00)
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 14. OPPORTUNITIES (3)
  --
  --  Cloud schema: id, store_id, category, title, description, impact_low,
  --                impact_high, priority, status
  --  Mapping: uplift_low → impact_low, uplift_high → impact_high,
  --           priority_rank → priority; action_label/why_label not in cloud
  --  Sum check: impact_low = 8k+6k+4k = 18k (RECOVERABLE_LOW)
  --             impact_high = 18k+14k+10k = 42k (RECOVERABLE_HIGH)
  -- ===========================================================================
  INSERT INTO opportunities
    (id, store_id, category, title, description, impact_low, impact_high, priority, status)
  VALUES
    ('70000000-0000-0000-0000-000000000001', sid,
     'pricing',
     'Reduce Discount Dependency',
     'Discount codes applied to ~25% of orders are eroding contribution margin. '
     'Shifting 5% of discounted orders to full price recovers an estimated £8k–£18k monthly.',
     8000.00, 18000.00, 1, 'active'),
    ('70000000-0000-0000-0000-000000000002', sid,
     'retention',
     'Improve Repeat Purchase Rate',
     'Only 22% of customers make a second purchase within 90 days. A post-purchase '
     'nurture sequence could recover £6k–£14k monthly in customer lifetime value.',
     6000.00, 14000.00, 2, 'active'),
    ('70000000-0000-0000-0000-000000000003', sid,
     'operations',
     'Reduce Refund Leakage',
     'Refund rate is running above the 5% benchmark. Tighter pre-despatch QC '
     'and improved size guidance could recover £4k–£10k monthly.',
     4000.00, 10000.00, 3, 'active')
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 15. CFO ALERTS (5)
  --
  --  Cloud schema: id, store_id, alert_type (NOT NULL), severity, title (NOT NULL),
  --                body (nullable), is_read (default false)
  --  Mapping: alert_key → alert_type; titles inlined; is_triggered dropped
  -- ===========================================================================
  INSERT INTO cfo_alerts (id, store_id, alert_type, severity, title, is_read)
  VALUES
    ('80000000-0000-0000-0000-000000000001', sid,
     'low_runway',          'danger', 'Cash runway is low',           false),
    ('80000000-0000-0000-0000-000000000002', sid,
     'high_discount_dep',   'warn',   'High discount dependency',     false),
    ('80000000-0000-0000-0000-000000000003', sid,
     'falling_repeat_rate', 'warn',   'Falling repeat purchase rate', false),
    ('80000000-0000-0000-0000-000000000004', sid,
     'rising_cac',          'info',   'Rising Meta CAC',              false),
    ('80000000-0000-0000-0000-000000000005', sid,
     'high_refund_rate',    'warn',   'High refund rate',             false)
  ON CONFLICT (id) DO NOTHING;

END $$;

COMMIT;
