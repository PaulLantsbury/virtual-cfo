-- PROPOSAL ONLY — local/staging Xero accounting evidence. Do not apply to production
-- without a fresh security and retention review. Requires the reviewed mapping schema.
-- This schema deliberately stores bounded calculated minor-unit evidence only. It never
-- stores OAuth grants/tokens, raw Xero report payloads, transactions, or Shopify data.
BEGIN;
CREATE SCHEMA IF NOT EXISTS xero_v1;

-- A test tenant may have one active Night Scout store attachment. Retired historical
-- attachments remain available for audit, but cannot be revived by an ordinary update.
CREATE UNIQUE INDEX xero_one_active_tenant_across_stores
 ON xero_v1.connections(tenant_id) WHERE retired_at IS NULL;

CREATE TABLE xero_v1.accounting_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
 mapping_version_id uuid NOT NULL,
 scope_from date NOT NULL,
 scope_to date NOT NULL,
 currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
 closed_period boolean NOT NULL DEFAULT false,
 state text NOT NULL CHECK (state IN ('supported','failed','review_required','invalidated')),
 reason text CHECK (reason IS NULL OR reason IN ('source_refresh_failed','source_review_required','account_mapping_review_required','later_posting_review_required','accounting_evidence_unavailable','connection_disconnected')),
 report_as_of date,
 retrieved_at timestamptz NOT NULL,
 source_fingerprint text CHECK (source_fingerprint IS NULL OR source_fingerprint ~ '^[a-f0-9]{64}$'),
 booked_revenue_minor bigint,
 processing_fee_minor bigint,
 advertising_minor bigint,
 software_minor bigint,
 included_cash_minor bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (scope_from <= scope_to),
 CHECK ((state='supported' AND reason IS NULL AND report_as_of IS NOT NULL AND source_fingerprint IS NOT NULL
   AND booked_revenue_minor IS NOT NULL AND processing_fee_minor IS NOT NULL AND advertising_minor IS NOT NULL
   AND software_minor IS NOT NULL AND included_cash_minor IS NOT NULL)
  OR (state<>'supported' AND report_as_of IS NULL AND source_fingerprint IS NULL AND booked_revenue_minor IS NULL
   AND processing_fee_minor IS NULL AND advertising_minor IS NULL AND software_minor IS NULL AND included_cash_minor IS NULL)),
 FOREIGN KEY(mapping_version_id,connection_id) REFERENCES xero_v1.mapping_versions(id,connection_id)
);
CREATE INDEX xero_accounting_evidence_lookup
 ON xero_v1.accounting_evidence(connection_id,scope_from,scope_to,currency,closed_period,created_at DESC);

CREATE FUNCTION xero_v1.reject_accounting_evidence_mutation() RETURNS trigger
 LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'xero accounting evidence is append-only'; END $$;
CREATE TRIGGER xero_accounting_evidence_append_only
 BEFORE UPDATE OR DELETE ON xero_v1.accounting_evidence
 FOR EACH ROW EXECUTE FUNCTION xero_v1.reject_accounting_evidence_mutation();

-- Evidence is append-only. An old supported snapshot is retained only for exact-scope
-- fallback by the server reader; a later failed/review row does not overwrite values.
CREATE TABLE xero_v1.accounting_evidence_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 evidence_id uuid NOT NULL REFERENCES xero_v1.accounting_evidence(id),
 action text NOT NULL CHECK (action IN ('recorded','served_stale','review_required')),
 actor_kind text NOT NULL CHECK (actor_kind IN ('worker','server')),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(evidence_id,action)
);

ALTER TABLE xero_v1.accounting_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.accounting_evidence_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON xero_v1.accounting_evidence,xero_v1.accounting_evidence_audit FROM PUBLIC,anon,authenticated;
-- Browser access is deliberately absent. A reviewed server reader may expose only
-- scoped result DTOs after membership checks; workers write through a service role.
COMMIT;
