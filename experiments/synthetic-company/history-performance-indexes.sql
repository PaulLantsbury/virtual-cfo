-- REVIEW PROPOSAL ONLY: exercise solely in a newly created disposable database.
-- No revision contract, row body, source ID, seal or dependency scope changes.
BEGIN;
CREATE INDEX history_orders_day_candidate ON finance_history_v2.orders(store_id,event_date);
CREATE INDEX history_refunds_day_candidate ON finance_history_v2.refunds(store_id,event_date);
CREATE INDEX history_refunds_order_candidate ON finance_history_v2.refunds(store_id,(body->>'order_id'),event_date);
CREATE INDEX history_lines_order_candidate ON finance_history_v2.lines(store_id,(body->>'order_id'));
CREATE INDEX history_returns_day_candidate ON finance_history_v2.returns(store_id,event_date);
CREATE INDEX history_returns_line_candidate ON finance_history_v2.returns(store_id,(body->>'line_id'),event_date);
COMMIT;
-- Rollback proposal (review separately; never run against a hosted service here):
-- BEGIN;
-- DROP INDEX finance_history_v2.history_orders_day_candidate;
-- DROP INDEX finance_history_v2.history_refunds_day_candidate;
-- DROP INDEX finance_history_v2.history_refunds_order_candidate;
-- DROP INDEX finance_history_v2.history_lines_order_candidate;
-- DROP INDEX finance_history_v2.history_returns_day_candidate;
-- DROP INDEX finance_history_v2.history_returns_line_candidate;
-- COMMIT;
-- Existing events day/order and primary-key indexes remain authoritative.
