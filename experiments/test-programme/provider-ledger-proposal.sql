-- PROPOSAL ONLY: no runner imports this file, no grants or activation.
-- Atomic claim adapter must lock the programme row, enforce stop/cap, then insert.
-- A submitted action has no lease expiry and can only be reconciled, never reclaimed.
CREATE SCHEMA IF NOT EXISTS staging_test_programme;
CREATE TABLE staging_test_programme.programmes (
 programme_key text PRIMARY KEY,
 provider text NOT NULL CHECK (provider IN ('shopify','xero')),
 project_ref text NOT NULL CHECK (project_ref = 'bioalckltvkhlczusdvl'),
 target text NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '14 days'),
 action_cap integer NOT NULL CHECK (action_cap BETWEEN 1 AND 14),
 enabled boolean NOT NULL DEFAULT false,
 stopped boolean NOT NULL DEFAULT false
);
CREATE TABLE staging_test_programme.actions (
 programme_key text NOT NULL REFERENCES staging_test_programme.programmes(programme_key),
 action_key text NOT NULL,
 payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK (state IN ('claimed','submitted','confirmed','uncertain','skipped')),
 source_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 submitted_at timestamptz,
 confirmed_at timestamptz,
 PRIMARY KEY(programme_key, action_key),
 CHECK ((state = 'confirmed') = (source_id IS NOT NULL AND confirmed_at IS NOT NULL))
);
REVOKE ALL ON SCHEMA staging_test_programme FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA staging_test_programme FROM PUBLIC;
-- No credential columns, raw response/error columns, automatic cleanup or retry.
-- Before application: reviewed least-privilege RPC/role, RLS, cap locking,
-- immutable submitted records, target-bound reconciliation and stop semantics.
