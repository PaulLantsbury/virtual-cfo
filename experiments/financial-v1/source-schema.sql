-- DISPOSABLE TEST SCHEMA ONLY. Not a migration for the connected Supabase.
-- Source decimals are pounds; the adapter converts them to integer pence.
CREATE TABLE source_orders (
  store_id text NOT NULL, id text NOT NULL, event_date date NOT NULL,
  date_evidence text, currency text, eligible boolean, tax_basis text,
  gross numeric, gross_vat numeric, discount numeric, discount_vat numeric,
  shipping numeric, shipping_vat numeric,
  quantity integer NOT NULL CHECK (quantity > 0), historic_unit_cost numeric,
  cost_evidence text,
  PRIMARY KEY (store_id,id)
);
CREATE TABLE source_refunds (
  store_id text NOT NULL, id text NOT NULL, order_id text NOT NULL,
  event_date date NOT NULL, date_evidence text, currency text,
  product_cash numeric, product_vat numeric, shipping_cash numeric, shipping_vat numeric,
  saleable_quantity integer CHECK (saleable_quantity >= 0), returned_date date,
  recovery_evidence text,
  PRIMARY KEY (store_id,id),
  FOREIGN KEY (store_id,order_id) REFERENCES source_orders(store_id,id)
);
CREATE TABLE source_coverage (
  store_id text NOT NULL, date_from date NOT NULL, date_to date NOT NULL,
  currency text NOT NULL, trading_complete boolean NOT NULL,
  costs_complete boolean NOT NULL, evidence text NOT NULL,
  PRIMARY KEY(store_id,date_from,date_to), CHECK(date_from <= date_to)
);
CREATE TABLE source_costs (
  store_id text NOT NULL, source_id text NOT NULL, event_date date NOT NULL,
  currency text NOT NULL, amount numeric NOT NULL,
  category text NOT NULL CHECK(category IN ('variable','advertising','overhead','depreciation_amortisation')),
  provenance text NOT NULL CHECK(provenance IN ('actual','estimated')),
  PRIMARY KEY(store_id,source_id)
);
