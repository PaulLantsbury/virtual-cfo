-- =============================================================================
-- Virtual CFO — Phase 1 Seed Data
-- Local / dev environment only. NOT for production.
--
-- Usage:
--   psql "$DATABASE_URL" -f supabase/seed.sql
--   npx supabase db reset    (applies migrations then this file automatically)
--
-- What this seeds:
--   1  store  ·  1 store_settings  ·  1 store_cost_assumptions
--   15 customers  ·  6 products  ·  10 product_variants
--   108 orders  ·  ~130 order_line_items
--   13 refunds  +  1 extra partial = 14 refund events total
--   14 refund_line_items
--   5 discounts  ·  8 discount_codes
--   3 opportunities  ·  5 cfo_alerts
--
-- Financial formula (all monetary values in GBP):
--   net_goods   = gross_sales - discounts
--   tax         = round(net_goods * 0.20, 2)   ← 20% UK VAT on goods
--   total_sales = net_goods + tax              = round(net_goods * 1.20, 2)
--   refunds     ≤ total_sales  (partial); = total_sales  (full)
--
-- Opportunities seed:
--   impact_low  sums to 18 000 = RECOVERABLE_LOW  in business-snapshot.ts ✓
--   impact_high sums to 42 000 = RECOVERABLE_HIGH in business-snapshot.ts ✓
--
-- Cost assumptions match current hardcoded values in commerceMetrics.ts:
--   payment_fee_rate          = 0.025
--   fulfilment_cost_per_order = 3.50
--   packaging_cost_per_order  = 1.20
--   return_handling_rate      = 0.15
-- =============================================================================

BEGIN;

-- Truncate all Phase 1 tables (reverse FK order; CASCADE handles anything missed)
TRUNCATE TABLE
  cfo_alerts,
  opportunities,
  discount_codes,
  discounts,
  refund_line_items,
  refunds,
  order_line_items,
  orders,
  product_variants,
  products,
  customers,
  store_cost_assumptions,
  store_settings,
  stores
CASCADE;

DO $$
DECLARE
  -- ── Store ──────────────────────────────────────────────────────────────────
  sid  uuid := '10000000-0000-0000-0000-000000000001';

  -- ── Customers (c01–c15) ────────────────────────────────────────────────────
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
  p01  uuid := '30000000-0000-0000-0000-000000000001'; -- Linen Dress
  p02  uuid := '30000000-0000-0000-0000-000000000002'; -- Cotton Tee
  p03  uuid := '30000000-0000-0000-0000-000000000003'; -- Silk Blouse
  p04  uuid := '30000000-0000-0000-0000-000000000004'; -- Wool Jumper
  p05  uuid := '30000000-0000-0000-0000-000000000005'; -- Leather Tote
  p06  uuid := '30000000-0000-0000-0000-000000000006'; -- Canvas Sneakers

  -- ── Product Variants ───────────────────────────────────────────────────────
  -- Markdowns: v01, v02 (compare_at=120 > price=89)
  --            v05       (compare_at=85  > price=65)
  -- Cost populated: v01,v02 (32.00), v03,v04 (8.50), v07 (28.00), v09,v10 (18.00)
  -- Cost NULL: v05, v06, v08
  v01  uuid := '40000000-0000-0000-0000-000000000001'; -- Linen Dress S  £89  cat=£120 cost=£32
  v02  uuid := '40000000-0000-0000-0000-000000000002'; -- Linen Dress M  £89  cat=£120 cost=£32
  v03  uuid := '40000000-0000-0000-0000-000000000003'; -- Cotton Tee White £30          cost=£8.50
  v04  uuid := '40000000-0000-0000-0000-000000000004'; -- Cotton Tee Navy  £30          cost=£8.50
  v05  uuid := '40000000-0000-0000-0000-000000000005'; -- Silk Blouse XS  £65  cat=£85  cost=null
  v06  uuid := '40000000-0000-0000-0000-000000000006'; -- Wool Jumper M   £75           cost=null
  v07  uuid := '40000000-0000-0000-0000-000000000007'; -- Wool Jumper L   £75           cost=£28
  v08  uuid := '40000000-0000-0000-0000-000000000008'; -- Leather Tote    £120          cost=null
  v09  uuid := '40000000-0000-0000-0000-000000000009'; -- Canvas Sneakers UK5 £55       cost=£18
  v10  uuid := '40000000-0000-0000-0000-000000000010'; -- Canvas Sneakers UK6 £55       cost=£18

  -- ── Discounts ──────────────────────────────────────────────────────────────
  d01  uuid := '50000000-0000-0000-0000-000000000001'; -- loyalty    (-10%)
  d02  uuid := '50000000-0000-0000-0000-000000000002'; -- promotional (-15%)
  d03  uuid := '50000000-0000-0000-0000-000000000003'; -- referral   (£10 off)
  d04  uuid := '50000000-0000-0000-0000-000000000004'; -- wholesale  (-20%)
  d05  uuid := '50000000-0000-0000-0000-000000000005'; -- other      (-25%)

  -- ── Special orders (fixed UUIDs — refund tables FK to these) ──────────────
  -- or01–or08 : partially_refunded
  -- or08      : the DOUBLE-REFUND-EVENT order
  -- or09–or13 : fully refunded (refunds = total_sales)
  or01 uuid := 'a0000000-0000-0000-0000-000000000001';
  or02 uuid := 'a0000000-0000-0000-0000-000000000002';
  or03 uuid := 'a0000000-0000-0000-0000-000000000003';
  or04 uuid := 'a0000000-0000-0000-0000-000000000004';
  or05 uuid := 'a0000000-0000-0000-0000-000000000005';
  or06 uuid := 'a0000000-0000-0000-0000-000000000006';
  or07 uuid := 'a0000000-0000-0000-0000-000000000007';
  or08 uuid := 'a0000000-0000-0000-0000-000000000008'; -- double-refund
  or09 uuid := 'a0000000-0000-0000-0000-000000000009'; -- refunded / guest
  or10 uuid := 'a0000000-0000-0000-0000-000000000010'; -- refunded / c09
  or11 uuid := 'a0000000-0000-0000-0000-000000000011'; -- refunded / c10
  or12 uuid := 'a0000000-0000-0000-0000-000000000012'; -- refunded / c11
  or13 uuid := 'a0000000-0000-0000-0000-000000000013'; -- refunded / guest

  -- ── Order line items for special orders (fixed UUIDs for refund FKs) ───────
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

  -- ── Refund events (fixed UUIDs) ────────────────────────────────────────────
  rf01  uuid := 'c0000000-0000-0000-0000-000000000001';
  rf02  uuid := 'c0000000-0000-0000-0000-000000000002';
  rf03  uuid := 'c0000000-0000-0000-0000-000000000003';
  rf04  uuid := 'c0000000-0000-0000-0000-000000000004';
  rf05  uuid := 'c0000000-0000-0000-0000-000000000005';
  rf06  uuid := 'c0000000-0000-0000-0000-000000000006';
  rf07  uuid := 'c0000000-0000-0000-0000-000000000007';
  rf08a uuid := 'c0000000-0000-0000-0000-000000000008'; -- 1st refund on or08
  rf08b uuid := 'c0000000-0000-0000-0000-000000000009'; -- 2nd refund on or08
  rf09  uuid := 'c0000000-0000-0000-0000-000000000010';
  rf10  uuid := 'c0000000-0000-0000-0000-000000000011';
  rf11  uuid := 'c0000000-0000-0000-0000-000000000012';
  rf12  uuid := 'c0000000-0000-0000-0000-000000000013';
  rf13  uuid := 'c0000000-0000-0000-0000-000000000014';

  -- ── Loop variables ─────────────────────────────────────────────────────────
  i           int;
  oid         uuid;
  lid         uuid;
  vid         uuid;
  pid         uuid;
  price_v     numeric;
  cat_v       numeric;  -- compare_at_price for the variant
  title_v     text;
  gross_v     numeric;
  disc_v      numeric;
  net_v       numeric;
  tax_v       numeric;
  total_v     numeric;
  cust_v      uuid;
  status_v    text;
  date_v      timestamptz;
  dc_json_v   jsonb;
  dc_code_v   text;

BEGIN

  -- ===========================================================================
  -- 1. STORES
  -- ===========================================================================
  INSERT INTO stores (id, shopify_domain, shopify_store_id, name, currency_code, timezone, is_active)
  VALUES (sid, 'bloom-and-co.myshopify.com', 'shop_98765432',
          'Bloom & Co.', 'GBP', 'Europe/London', true);

  -- ===========================================================================
  -- 2. STORE SETTINGS
  -- ===========================================================================
  INSERT INTO store_settings (store_id, cm_target_pct, runway_warn_months, repeat_rate_target_pct)
  VALUES (sid, 30.00, 3.00, 25.00);

  -- ===========================================================================
  -- 3. STORE COST ASSUMPTIONS
  --    Exact values from current costAssumptions.ts / commerceMetrics.ts
  -- ===========================================================================
  INSERT INTO store_cost_assumptions
    (store_id, payment_fee_rate, fulfilment_cost_per_order,
     packaging_cost_per_order, return_handling_rate, effective_from)
  VALUES (sid, 0.02500, 3.50, 1.20, 0.15000, '2025-01-01');

  -- ===========================================================================
  -- 4. CUSTOMERS (15 named customers — all are repeat buyers in this seed)
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
    (c15, sid, 1015, 'olivia.garcia@example.com',  false);

  -- ===========================================================================
  -- 5. PRODUCTS (6 products)
  -- ===========================================================================
  INSERT INTO products (id, store_id, shopify_product_id, title, status)
  VALUES
    (p01, sid, 9001, 'Linen Dress',     'active'),
    (p02, sid, 9002, 'Cotton Tee',      'active'),
    (p03, sid, 9003, 'Silk Blouse',     'active'),
    (p04, sid, 9004, 'Wool Jumper',     'active'),
    (p05, sid, 9005, 'Leather Tote',    'active'),
    (p06, sid, 9006, 'Canvas Sneakers', 'active');

  -- ===========================================================================
  -- 6. PRODUCT VARIANTS (10 variants)
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
    (v10, sid, p06, 8010, 'UK 6',     'CS-6',   55.00,   NULL, 18.00,  37);

  -- ===========================================================================
  -- 7. DISCOUNTS (5 price rules)
  -- ===========================================================================
  INSERT INTO discounts
    (id, store_id, shopify_price_rule_id, title, value_type, value, category)
  VALUES
    (d01, sid, 7001, 'Loyalty Reward 10%',    'percentage',  -10.00, 'loyalty'),
    (d02, sid, 7002, 'New Customer 15% Off',  'percentage',  -15.00, 'promotional'),
    (d03, sid, 7003, 'Refer a Friend £10',    'fixed_amount',-10.00, 'referral'),
    (d04, sid, 7004, 'Trade Account 20%',     'percentage',  -20.00, 'wholesale'),
    (d05, sid, 7005, 'Flash Sale 25% Off',    'percentage',  -25.00, 'other');

  -- ===========================================================================
  -- 8. DISCOUNT CODES (8 codes — 2 per loyalty/promotional/referral, 1 each)
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
    ('60000000-0000-0000-0000-000000000008', sid, d05, 'FLASH25',     38);

  -- ===========================================================================
  -- 9. SPECIAL ORDERS (or01–or13, fixed UUIDs — refund tables FK to these)
  --
  --    Verified: tax = round((gross-disc)*0.20, 2)
  --              total = round((gross-disc)*1.20, 2)
  --    Partial:  refunds < total_sales
  --    Full:     refunds = total_sales
  -- ===========================================================================

  -- or01 — Feb — C01 — partially_refunded
  --   Cotton Tee White × 2: gross=60 tax=12 total=72 | refunds=36 (1 unit) < 72 ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or01, sid, 20001, c01, '2026-02-05 10:23:00+00', '2026-02-07 14:00:00+00',
          'partially_refunded', 60.00, 0.00, 36.00, 12.00, 72.00);

  -- or02 — Feb — C02 — partially_refunded
  --   Linen Dress S (markdown): gross=89 tax=17.80 total=106.80 | refunds=50 (goodwill) < 106.80 ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or02, sid, 20002, c02, '2026-02-14 15:42:00+00', '2026-02-17 10:00:00+00',
          'partially_refunded', 89.00, 0.00, 50.00, 17.80, 106.80);

  -- or03 — Mar — C03 — partially_refunded
  --   Wool Jumper L + Cotton Tee Navy: gross=105 tax=21 total=126 | refunds=36 (tee only) < 126 ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or03, sid, 20003, c03, '2026-03-08 09:15:00+00', '2026-03-10 11:00:00+00',
          'partially_refunded', 105.00, 0.00, 36.00, 21.00, 126.00);

  -- or04 — Mar — C04 — partially_refunded
  --   Leather Tote + Cotton Tee White: gross=150 tax=30 total=180 | refunds=36 (tee only) < 180 ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or04, sid, 20004, c04, '2026-03-15 12:00:00+00', '2026-03-17 09:00:00+00',
          'partially_refunded', 150.00, 0.00, 36.00, 30.00, 180.00);

  -- or05 — Mar — C05 — partially_refunded
  --   Silk Blouse XS (markdown): gross=65 tax=13 total=78 | refunds=39 (50% goodwill) < 78 ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or05, sid, 20005, c05, '2026-03-22 16:30:00+00', '2026-03-24 10:00:00+00',
          'partially_refunded', 65.00, 0.00, 39.00, 13.00, 78.00);

  -- or06 — Apr — C06 — partially_refunded
  --   Canvas Sneakers UK5 + UK6: gross=110 tax=22 total=132 | refunds=66 (1 pair) < 132 ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or06, sid, 20006, c06, '2026-04-03 11:00:00+00', '2026-04-05 14:00:00+00',
          'partially_refunded', 110.00, 0.00, 66.00, 22.00, 132.00);

  -- or07 — Apr — C07 — partially_refunded
  --   Linen Dress M (markdown) + Cotton Tee White: gross=119 tax=23.80 total=142.80
  --   refunds=36 (tee only) < 142.80 ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or07, sid, 20007, c07, '2026-04-10 14:20:00+00', '2026-04-12 10:00:00+00',
          'partially_refunded', 119.00, 0.00, 36.00, 23.80, 142.80);

  -- or08 — Mar — C08 — partially_refunded — DOUBLE REFUND EVENT
  --   Wool Jumper M + Leather Tote: gross=195 tax=39 total=234
  --   refunds=144 (rf08a=90 Wool Jumper full + rf08b=54 Leather Tote partial) < 234 ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or08, sid, 20008, c08, '2026-03-28 09:00:00+00', '2026-04-02 16:00:00+00',
          'partially_refunded', 195.00, 0.00, 144.00, 39.00, 234.00);

  -- or09 — Feb — GUEST — refunded (full)
  --   Cotton Tee White × 1: gross=30 tax=6 total=36 | refunds=36 = total ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or09, sid, 20009, NULL, '2026-02-20 18:00:00+00', '2026-02-23 10:00:00+00',
          'refunded', 30.00, 0.00, 36.00, 6.00, 36.00);

  -- or10 — Feb — C09 — refunded (full)
  --   Silk Blouse XS (markdown): gross=65 tax=13 total=78 | refunds=78 = total ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or10, sid, 20010, c09, '2026-02-26 11:00:00+00', '2026-03-01 09:00:00+00',
          'refunded', 65.00, 0.00, 78.00, 13.00, 78.00);

  -- or11 — Mar — C10 — refunded (full)
  --   Wool Jumper M × 1: gross=75 tax=15 total=90 | refunds=90 = total ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or11, sid, 20011, c10, '2026-03-18 13:00:00+00', '2026-03-21 10:00:00+00',
          'refunded', 75.00, 0.00, 90.00, 15.00, 90.00);

  -- or12 — Apr — C11 — refunded (full)
  --   Linen Dress S (markdown) × 1: gross=89 tax=17.80 total=106.80 | refunds=106.80 = total ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or12, sid, 20012, c11, '2026-04-14 10:00:00+00', '2026-04-16 14:00:00+00',
          'refunded', 89.00, 0.00, 106.80, 17.80, 106.80);

  -- or13 — Apr — GUEST — refunded (full)
  --   Canvas Sneakers UK5 × 1: gross=55 tax=11 total=66 | refunds=66 = total ✓
  INSERT INTO orders
    (id, store_id, shopify_order_id, customer_id, created_at, updated_at,
     financial_status, gross_sales, discounts, refunds, tax, total_sales)
  VALUES (or13, sid, 20013, NULL, '2026-04-18 16:00:00+00', '2026-04-20 10:00:00+00',
          'refunded', 55.00, 0.00, 66.00, 11.00, 66.00);

  -- ===========================================================================
  -- 10. ORDER LINE ITEMS — special orders
  --
  --     compare_at_price populated on markdown variants so is_markdown = true:
  --       li02  (v01 Linen Dress S: cat=120 > price=89)
  --       li05  (v05 Silk Blouse XS: cat=85 > price=65)
  --       li07a (v02 Linen Dress M:  cat=120 > price=89)
  --       li10  (v05 Silk Blouse XS: cat=85 > price=65)
  --       li12  (v01 Linen Dress S:  cat=120 > price=89)
  -- ===========================================================================

  -- or01: Cotton Tee White × 2
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES (li01, sid, or01, p02, v03, 30001,
          'Cotton Tee – White', 2, 30.00, NULL, 0.00);

  -- or02: Linen Dress S × 1 (markdown: is_markdown = true)
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES (li02, sid, or02, p01, v01, 30002,
          'Linen Dress – Size S', 1, 89.00, 120.00, 0.00);

  -- or03: Wool Jumper L + Cotton Tee Navy
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES
    (li03a, sid, or03, p04, v07, 30003, 'Wool Jumper – L',     1, 75.00, NULL, 0.00),
    (li03b, sid, or03, p02, v04, 30004, 'Cotton Tee – Navy',   1, 30.00, NULL, 0.00);

  -- or04: Leather Tote + Cotton Tee White
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES
    (li04a, sid, or04, p05, v08, 30005, 'Leather Tote',         1, 120.00, NULL, 0.00),
    (li04b, sid, or04, p02, v03, 30006, 'Cotton Tee – White',   1,  30.00, NULL, 0.00);

  -- or05: Silk Blouse XS × 1 (markdown: is_markdown = true)
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES (li05, sid, or05, p03, v05, 30007,
          'Silk Blouse – XS', 1, 65.00, 85.00, 0.00);

  -- or06: Canvas Sneakers UK5 + UK6
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES
    (li06a, sid, or06, p06, v09, 30008, 'Canvas Sneakers – UK 5', 1, 55.00, NULL, 0.00),
    (li06b, sid, or06, p06, v10, 30009, 'Canvas Sneakers – UK 6', 1, 55.00, NULL, 0.00);

  -- or07: Linen Dress M (markdown) + Cotton Tee White
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES
    (li07a, sid, or07, p01, v02, 30010, 'Linen Dress – Size M', 1, 89.00, 120.00, 0.00),
    (li07b, sid, or07, p02, v03, 30011, 'Cotton Tee – White',   1, 30.00,   NULL, 0.00);

  -- or08: Wool Jumper M + Leather Tote (double-refund order)
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES
    (li08a, sid, or08, p04, v06, 30012, 'Wool Jumper – M', 1,  75.00, NULL, 0.00),
    (li08b, sid, or08, p05, v08, 30013, 'Leather Tote',    1, 120.00, NULL, 0.00);

  -- or09: Cotton Tee White × 1 (guest, full refund)
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES (li09, sid, or09, p02, v03, 30014,
          'Cotton Tee – White', 1, 30.00, NULL, 0.00);

  -- or10: Silk Blouse XS × 1 (markdown: is_markdown = true, full refund)
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES (li10, sid, or10, p03, v05, 30015,
          'Silk Blouse – XS', 1, 65.00, 85.00, 0.00);

  -- or11: Wool Jumper M × 1 (full refund)
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES (li11, sid, or11, p04, v06, 30016,
          'Wool Jumper – M', 1, 75.00, NULL, 0.00);

  -- or12: Linen Dress S × 1 (markdown: is_markdown = true, full refund)
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES (li12, sid, or12, p01, v01, 30017,
          'Linen Dress – Size S', 1, 89.00, 120.00, 0.00);

  -- or13: Canvas Sneakers UK5 × 1 (guest, full refund)
  INSERT INTO order_line_items
    (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
     title, quantity, price, compare_at_price, total_discount)
  VALUES (li13, sid, or13, p06, v09, 30018,
          'Canvas Sneakers – UK 5', 1, 55.00, NULL, 0.00);

  -- ===========================================================================
  -- 11. REGULAR ORDERS — 95 orders via loop
  --
  --  Date spread:
  --    date_v = '2026-02-01' + (i × 17 h)
  --    i=1  → 2026-02-01 17:00  (Feb)
  --    i=50 → 2026-03-06        (Mar)
  --    i=95 → 2026-04-08        (Apr)
  --    → Spans Feb, Mar, early Apr ✓  (3 calendar months)
  --
  --  Product cycling: ((i-1) % 10) + 1 → variants 1–10
  --  compare_at_price propagated for markdown variants (v01, v02, v05)
  --
  --  Customer cycling: (i % 8 = 0) → NULL (guest); else cycle c01–c15
  --    Loop guests: i = 8,16,24,32,40,48,56,64,72,80,88  → 11 guest orders
  --    Special guests: or09, or13                          → 2 guest orders
  --    Total guests: ~13 across 108 orders (~12%)
  --
  --  Discount: (i % 4 = 0) → apply discount (24 discounted orders)
  --    Discount type = (i / 4) % 6:
  --      0 → WELCOME15 (15%)   1 → LOYALTY10 (10%)   2 → FLASH25 (25%)
  --      3 → REFERFRIEND (£10) 4 → TRADE20 (20%)      5 → VIP15 (15%)
  --
  --  Cancelled: (i % 13 = 0) → 'cancelled'  (i=13,26,39,52,65,78,91 → 7 orders)
  --    Cancelled orders carry gross/tax/total (voided before charge) but refunds=0
  --
  --  Shopify IDs: orders 20101–20195, line items 30101–30195 (no conflict with specials)
  -- ===========================================================================

  FOR i IN 1..95 LOOP
    oid   := gen_random_uuid();
    lid   := gen_random_uuid();
    date_v := '2026-02-01 00:00:00+00'::timestamptz + (i * INTERVAL '17 hours');

    -- Product / variant for this order
    CASE ((i - 1) % 10) + 1
      WHEN 1  THEN vid := v01; pid := p01; price_v := 89.00;  cat_v := 120.00; title_v := 'Linen Dress – Size S';
      WHEN 2  THEN vid := v02; pid := p01; price_v := 89.00;  cat_v := 120.00; title_v := 'Linen Dress – Size M';
      WHEN 3  THEN vid := v03; pid := p02; price_v := 30.00;  cat_v := NULL;   title_v := 'Cotton Tee – White';
      WHEN 4  THEN vid := v04; pid := p02; price_v := 30.00;  cat_v := NULL;   title_v := 'Cotton Tee – Navy';
      WHEN 5  THEN vid := v05; pid := p03; price_v := 65.00;  cat_v := 85.00;  title_v := 'Silk Blouse – XS';
      WHEN 6  THEN vid := v06; pid := p04; price_v := 75.00;  cat_v := NULL;   title_v := 'Wool Jumper – M';
      WHEN 7  THEN vid := v07; pid := p04; price_v := 75.00;  cat_v := NULL;   title_v := 'Wool Jumper – L';
      WHEN 8  THEN vid := v08; pid := p05; price_v := 120.00; cat_v := NULL;   title_v := 'Leather Tote';
      WHEN 9  THEN vid := v09; pid := p06; price_v := 55.00;  cat_v := NULL;   title_v := 'Canvas Sneakers – UK 5';
      WHEN 10 THEN vid := v10; pid := p06; price_v := 55.00;  cat_v := NULL;   title_v := 'Canvas Sneakers – UK 6';
    END CASE;

    -- Customer (guest every 8th order, else cycle c01–c15)
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

    -- Financial status
    status_v := CASE WHEN i % 13 = 0 THEN 'cancelled' ELSE 'paid' END;

    -- Discount (every 4th order, type cycles 0–5)
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
    VALUES (oid, sid, 20100 + i, cust_v, date_v, date_v,
            status_v, gross_v, disc_v, 0.00, tax_v, total_v, dc_json_v);

    INSERT INTO order_line_items
      (id, store_id, order_id, product_id, variant_id, shopify_line_item_id,
       title, quantity, price, compare_at_price, total_discount)
    VALUES (lid, sid, oid, pid, vid, 30100 + i,
            title_v, 1, price_v, cat_v, disc_v);

  END LOOP;

  -- ===========================================================================
  -- Update customers: first_order_at and total_orders
  -- (computed from the full orders table after all inserts)
  -- ===========================================================================
  UPDATE customers c
  SET
    first_order_at = sub.first_order,
    total_orders   = sub.cnt
  FROM (
    SELECT customer_id,
           MIN(created_at)  AS first_order,
           COUNT(*)::int    AS cnt
    FROM   orders
    WHERE  store_id = sid
      AND  customer_id IS NOT NULL
    GROUP  BY customer_id
  ) sub
  WHERE c.id = sub.customer_id
    AND c.store_id = sid;

  -- ===========================================================================
  -- 12. REFUNDS
  --     14 refund events (or08 has 2 events: rf08a + rf08b)
  --     refund_subtotal = total amount refunded for this event (inclusive of tax)
  --
  --     Reconciliation vs orders.refunds:
  --       or01: rf01=36            = orders.refunds(36) ✓
  --       or02: rf02=50            = orders.refunds(50) ✓
  --       or03: rf03=36            = orders.refunds(36) ✓
  --       or04: rf04=36            = orders.refunds(36) ✓
  --       or05: rf05=39            = orders.refunds(39) ✓
  --       or06: rf06=66            = orders.refunds(66) ✓
  --       or07: rf07=36            = orders.refunds(36) ✓
  --       or08: rf08a=90+rf08b=54  = 144 = orders.refunds(144) ✓
  --       or09: rf09=36            = orders.refunds(36)  = total_sales(36) ✓
  --       or10: rf10=78            = orders.refunds(78)  = total_sales(78) ✓
  --       or11: rf11=90            = orders.refunds(90)  = total_sales(90) ✓
  --       or12: rf12=106.80        = orders.refunds(106.80) = total_sales(106.80) ✓
  --       or13: rf13=66            = orders.refunds(66)  = total_sales(66) ✓
  -- ===========================================================================
  INSERT INTO refunds
    (id, store_id, order_id, shopify_refund_id, refund_subtotal, created_at)
  VALUES
    (rf01,  sid, or01, 40001,  36.00, '2026-02-07 14:00:00+00'),
    (rf02,  sid, or02, 40002,  50.00, '2026-02-17 10:00:00+00'),
    (rf03,  sid, or03, 40003,  36.00, '2026-03-10 11:00:00+00'),
    (rf04,  sid, or04, 40004,  36.00, '2026-03-17 09:00:00+00'),
    (rf05,  sid, or05, 40005,  39.00, '2026-03-24 10:00:00+00'),
    (rf06,  sid, or06, 40006,  66.00, '2026-04-05 14:00:00+00'),
    (rf07,  sid, or07, 40007,  36.00, '2026-04-12 10:00:00+00'),
    (rf08a, sid, or08, 40008,  90.00, '2026-03-31 09:00:00+00'), -- 1st event: Wool Jumper full
    (rf08b, sid, or08, 40009,  54.00, '2026-04-02 16:00:00+00'), -- 2nd event: Leather Tote partial
    (rf09,  sid, or09, 40010,  36.00, '2026-02-23 10:00:00+00'),
    (rf10,  sid, or10, 40011,  78.00, '2026-03-01 09:00:00+00'),
    (rf11,  sid, or11, 40012,  90.00, '2026-03-21 10:00:00+00'),
    (rf12,  sid, or12, 40013, 106.80, '2026-04-16 14:00:00+00'),
    (rf13,  sid, or13, 40014,  66.00, '2026-04-20 10:00:00+00');

  -- ===========================================================================
  -- 13. REFUND LINE ITEMS (14 rows, one per refund event)
  --     subtotal = pre-tax line item value being refunded
  -- ===========================================================================
  INSERT INTO refund_line_items
    (id, store_id, refund_id, order_line_item_id, quantity, subtotal)
  VALUES
    -- rf01: 1 unit Cotton Tee from li01 (li01 qty=2 → partial qty refund)
    ('d0000000-0000-0000-0000-000000000001', sid, rf01,  li01,  1, 30.00),
    -- rf02: goodwill partial on Linen Dress S (li02)
    ('d0000000-0000-0000-0000-000000000002', sid, rf02,  li02,  1, 41.67),
    -- rf03: Cotton Tee Navy (li03b) from 2-item order
    ('d0000000-0000-0000-0000-000000000003', sid, rf03,  li03b, 1, 30.00),
    -- rf04: Cotton Tee White (li04b) from 2-item order
    ('d0000000-0000-0000-0000-000000000004', sid, rf04,  li04b, 1, 30.00),
    -- rf05: 50% goodwill on Silk Blouse XS (li05)
    ('d0000000-0000-0000-0000-000000000005', sid, rf05,  li05,  1, 32.50),
    -- rf06: 1 pair Canvas Sneakers UK5 (li06a) from 2-pair order
    ('d0000000-0000-0000-0000-000000000006', sid, rf06,  li06a, 1, 55.00),
    -- rf07: Cotton Tee White (li07b) from 2-item order
    ('d0000000-0000-0000-0000-000000000007', sid, rf07,  li07b, 1, 30.00),
    -- rf08a: Wool Jumper M full refund (li08a) — first event on or08
    ('d0000000-0000-0000-0000-000000000008', sid, rf08a, li08a, 1, 75.00),
    -- rf08b: Leather Tote partial credit (li08b) — second event on or08
    ('d0000000-0000-0000-0000-000000000009', sid, rf08b, li08b, 1, 45.00),
    -- rf09: Cotton Tee White full refund (li09)
    ('d0000000-0000-0000-0000-000000000010', sid, rf09,  li09,  1, 30.00),
    -- rf10: Silk Blouse XS full refund (li10)
    ('d0000000-0000-0000-0000-000000000011', sid, rf10,  li10,  1, 65.00),
    -- rf11: Wool Jumper M full refund (li11)
    ('d0000000-0000-0000-0000-000000000012', sid, rf11,  li11,  1, 75.00),
    -- rf12: Linen Dress S full refund (li12)
    ('d0000000-0000-0000-0000-000000000013', sid, rf12,  li12,  1, 89.00),
    -- rf13: Canvas Sneakers UK5 full refund (li13)
    ('d0000000-0000-0000-0000-000000000014', sid, rf13,  li13,  1, 55.00);

  -- ===========================================================================
  -- 14. OPPORTUNITIES (3 active weekly priorities)
  --
  --   Sum check:
  --     impact_low  total = 8 000 + 6 000 + 4 000 = 18 000 = RECOVERABLE_LOW  ✓
  --     impact_high total = 18 000 + 14 000 + 10 000 = 42 000 = RECOVERABLE_HIGH ✓
  -- ===========================================================================
  INSERT INTO opportunities
    (id, store_id, category, title, description, impact_low, impact_high, priority, status)
  VALUES
    ('70000000-0000-0000-0000-000000000001', sid,
     'pricing',
     'Reduce Discount Dependency',
     'Discount codes applied to ~25% of orders are eroding contribution margin. '
     'Shifting 5% of discounted orders to full price recovers an estimated £8k–£18k monthly.',
     8000.00, 18000.00, 1, 'open'),

    ('70000000-0000-0000-0000-000000000002', sid,
     'retention',
     'Improve Repeat Purchase Rate',
     'Only 22% of customers make a second purchase within 90 days. A post-purchase '
     'nurture sequence could recover £6k–£14k monthly in customer lifetime value.',
     6000.00, 14000.00, 2, 'open'),

    ('70000000-0000-0000-0000-000000000003', sid,
     'operations',
     'Reduce Refund Leakage',
     'Refund rate is running above the 5% benchmark. Tighter pre-despatch QC '
     'and improved size guidance could recover £4k–£10k monthly.',
     4000.00, 10000.00, 3, 'open');

  -- ===========================================================================
  -- 15. CFO ALERTS (5 alert keys, all is_triggered = false at seed time)
  -- ===========================================================================
  INSERT INTO cfo_alerts (id, store_id, alert_type, severity, title, is_read)
  VALUES
    ('80000000-0000-0000-0000-000000000001', sid, 'low_runway',          'critical', 'Low Cash Runway',         false),
    ('80000000-0000-0000-0000-000000000002', sid, 'high_discount_dep',   'warning',  'High Discount Dependency', false),
    ('80000000-0000-0000-0000-000000000003', sid, 'falling_repeat_rate', 'warning',  'Falling Repeat Rate',      false),
    ('80000000-0000-0000-0000-000000000004', sid, 'rising_cac',          'info',     'Rising Customer Acq. Cost',false),
    ('80000000-0000-0000-0000-000000000005', sid, 'high_refund_rate',    'warning',  'High Refund Rate',         false);

END $$;

COMMIT;
