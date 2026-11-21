-- Read-only, aggregate-only checks. Keep customer/order identifiers out of reports.
WITH orders AS (
  SELECT * FROM public.orders WHERE store_id='10000000-0000-0000-0000-000000000001'
), trading AS (SELECT * FROM orders WHERE financial_status <> 'cancelled'),
events AS (
  SELECT order_id, sum(amount) AS amount FROM public.refunds
  WHERE store_id='10000000-0000-0000-0000-000000000001' GROUP BY order_id
), costs AS (
  SELECT l.quantity,v.cost FROM public.order_line_items l
  JOIN trading o ON o.id=l.order_id AND o.store_id=l.store_id
  LEFT JOIN public.product_variants v ON v.id=l.variant_id AND v.store_id=l.store_id
)
SELECT jsonb_build_object(
  'orders', (SELECT count(*) FROM orders),
  'missingStoredNet', (SELECT count(*) FROM orders WHERE net_sales IS NULL),
  'missingCurrency', (SELECT count(*) FROM orders WHERE currency IS NULL),
  'dateDisagreements', (SELECT count(*) FROM orders WHERE order_date::date<>created_at::date),
  'unknownStatus', (SELECT count(*) FROM orders WHERE financial_status IS NULL),
  'cancelFlagDisagreements', (SELECT count(*) FROM orders WHERE (financial_status='cancelled') IS DISTINCT FROM is_cancelled),
  'tradingOrders', (SELECT count(*) FROM trading),
  'taxEquals20PercentExclusiveBase', (SELECT count(*) FROM trading WHERE abs(coalesce(tax,0)-(coalesce(gross_sales,0)-coalesce(discounts,0))*0.2)<0.01),
  'ordersWithRefunds', (SELECT count(*) FROM trading WHERE refunds>0),
  'refundedOrdersWithoutEvents', (SELECT count(*) FROM trading t LEFT JOIN events e ON e.order_id=t.id WHERE t.refunds>0 AND e.order_id IS NULL),
  'orderRefunds', (SELECT sum(refunds) FROM trading),
  'linkedEventRefunds', (SELECT sum(coalesce(e.amount,0)) FROM trading t LEFT JOIN events e ON e.order_id=t.id),
  'eventAmountMismatches', (SELECT count(*) FROM trading t JOIN events e ON e.order_id=t.id WHERE abs(t.refunds-e.amount)>0.01),
  'refundTaxComponentMismatches', (SELECT count(*) FROM trading WHERE abs(coalesce(refund_ex_vat,0)+coalesce(refund_tax,0)-coalesce(refunds,0))>0.01),
  'tradingLines', (SELECT count(*) FROM costs),
  'linesMissingCost', (SELECT count(*) FROM costs WHERE cost IS NULL),
  'unitsMissingCost', (SELECT sum(quantity) FROM costs WHERE cost IS NULL),
  'knownCostOnly', (SELECT sum(quantity*cost) FROM costs)
) AS completeness;
