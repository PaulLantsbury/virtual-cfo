-- Read-only reconciliation against the CURRENT deployed definitions, not a
-- certification of their accounting treatment. Change only the store parameter.
-- Each populated month/week is checked, including boundary weeks and refunds.
WITH config AS (SELECT '10000000-0000-0000-0000-000000000001'::uuid AS store_id),
periods AS (
  SELECT DISTINCT grain, date_trunc(grain, o.created_at)::date AS date_from,
    (date_trunc(grain, o.created_at) + CASE grain WHEN 'month' THEN interval '1 month' ELSE interval '1 week' END - interval '1 day')::date AS date_to
  FROM public.orders o CROSS JOIN config CROSS JOIN (VALUES ('month'), ('week')) g(grain)
  WHERE o.store_id = config.store_id
), totals AS (
  SELECT p.*, count(o.id) AS trading_orders,
    count(o.id) FILTER (WHERE o.financial_status <> 'refunded') AS qualifying_orders,
    coalesce(sum(o.gross_sales),0) AS gross,
    coalesce(sum(coalesce(o.gross_sales,0)-coalesce(o.discounts,0)-coalesce(o.refunds,0)-coalesce(o.tax,0)),0) AS net,
    coalesce(sum(o.discounts),0) AS discounts, coalesce(sum(o.refunds),0) AS refunds,
    count(DISTINCT c.id) AS linked_customers,
    count(DISTINCT c.id) FILTER (WHERE c.first_order_at < p.date_from::timestamptz) AS returning_customers
  FROM periods p CROSS JOIN config
  LEFT JOIN public.orders o ON o.store_id=config.store_id AND o.created_at::date BETWEEN p.date_from AND p.date_to AND o.financial_status <> 'cancelled'
  LEFT JOIN public.customers c ON c.id=o.customer_id AND c.store_id=config.store_id
  GROUP BY p.grain,p.date_from,p.date_to
), checks AS (
  SELECT t.*, v.metric, v.expected, v.actual
  FROM totals t CROSS JOIN config
  CROSS JOIN LATERAL (VALUES
    ('grossRevenue', gross, public.gross_revenue(config.store_id,date_from,date_to)),
    ('netSales', net, public.net_sales(config.store_id,date_from,date_to)),
    ('averageOrderValue', coalesce(net/nullif(qualifying_orders,0),0), public.average_order_value(config.store_id,date_from,date_to)),
    ('discountDependency', coalesce(discounts/nullif(gross,0),0), public.discount_dependency(config.store_id,date_from,date_to)),
    ('refundRate', coalesce(refunds/nullif(gross,0),0), public.refund_rate(config.store_id,date_from,date_to)),
    ('repeatPurchaseRate', coalesce(returning_customers::numeric/nullif(linked_customers,0),0), public.repeat_purchase_rate(config.store_id,date_from,date_to)),
    ('qualifyingOrders', qualifying_orders, public.order_count(config.store_id,date_from,date_to))
  ) v(metric,expected,actual)
)
SELECT grain, date_from, date_to, max(trading_orders) AS trading_orders,
  max(qualifying_orders) AS qualifying_orders, count(*) AS checks,
  count(*) FILTER (WHERE actual IS NULL OR abs(expected-actual)>0.00000001) AS mismatches,
  jsonb_object_agg(metric, actual) AS rpc_values
FROM checks GROUP BY grain,date_from,date_to ORDER BY grain,date_from;
