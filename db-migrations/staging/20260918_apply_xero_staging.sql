-- STAGING-ONLY, ONE-SHOT XERO SCHEMA INSTALLER.
--
-- Run manually only in the Supabase SQL editor after visibly selecting Night
-- Scout Staging (project ref bioalckltvkhlczusdvl), and only after the read-only
-- preflight-xero-staging-2026-09-18.sql reports every required condition.
--
-- This package deliberately fails when xero_v1 already exists.  It is not a
-- retry-by-merge migration: an existing namespace can mean either a prior
-- successful install or an interrupted/manual change and must be inspected.
-- PostgreSQL executes the whole file as one transaction, so a failure rolls
-- back every object and ACL change made by this file.  It creates no roles,
-- changes no existing role membership, and grants nothing to the restricted
-- worker login.  In particular, do not substitute a worker role into this file.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF to_regclass('public.stores') IS NULL
    OR to_regclass('public.store_memberships') IS NULL
    OR to_regclass('auth.users') IS NULL
    OR to_regprocedure('gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'Xero staging prerequisites are missing; run the read-only preflight and stop';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_namespace n
    JOIN pg_class c ON c.relnamespace = n.oid
    WHERE n.nspname = 'xero_v1' AND c.relkind IN ('r','p','v','m','S','f')
  ) OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'xero_v1') THEN
    RAISE EXCEPTION 'xero_v1 already exists; do not reapply this one-shot package';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Supabase browser roles are missing';
  END IF;
END
$$;

CREATE SCHEMA xero_v1;

CREATE TABLE xero_v1.connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 tenant_id text NOT NULL CHECK (length(trim(tenant_id)) BETWEEN 1 AND 256),
 created_at timestamptz NOT NULL DEFAULT now(),
 retired_at timestamptz,
 UNIQUE (store_id,tenant_id),
 CHECK (retired_at IS NULL OR retired_at>=created_at)
);
-- A tenant may be connected to only one active Night Scout store.  Retiring a
-- connection frees that tenant for an explicitly new staging connection while
-- preserving the old mapping/audit provenance.
CREATE UNIQUE INDEX xero_connections_active_tenant_unique
 ON xero_v1.connections (tenant_id) WHERE retired_at IS NULL;
CREATE TABLE xero_v1.account_directories (
 connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
 retrieved_at timestamptz NOT NULL,
 account_id text NOT NULL CHECK (length(trim(account_id)) BETWEEN 1 AND 256),
 account_name text NOT NULL CHECK (length(trim(account_name)) BETWEEN 1 AND 256),
 account_type text NOT NULL CHECK (length(trim(account_type)) BETWEEN 1 AND 64),
 account_status text NOT NULL CHECK (length(trim(account_status)) BETWEEN 1 AND 64),
 PRIMARY KEY (connection_id,retrieved_at,account_id)
);
CREATE TABLE xero_v1.mapping_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
 version integer NOT NULL CHECK (version>0), effective_from date NOT NULL,
 confirmed_by uuid NOT NULL REFERENCES auth.users(id), confirmed_at timestamptz NOT NULL,
 directory_retrieved_at timestamptz NOT NULL,
 supersedes_id uuid REFERENCES xero_v1.mapping_versions(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(connection_id,version), UNIQUE(id,connection_id), UNIQUE(supersedes_id),
 CHECK ((version=1 AND supersedes_id IS NULL) OR (version>1 AND supersedes_id IS NOT NULL)),
 FOREIGN KEY(supersedes_id,connection_id) REFERENCES xero_v1.mapping_versions(id,connection_id)
);
CREATE TABLE xero_v1.mapping_selections (
 mapping_version_id uuid NOT NULL REFERENCES xero_v1.mapping_versions(id),
 category text NOT NULL CHECK (category IN ('revenue','processingFee','advertising','software','includedCash')),
 account_id text NOT NULL CHECK (length(trim(account_id)) BETWEEN 1 AND 256),
 PRIMARY KEY(mapping_version_id,category,account_id), UNIQUE(mapping_version_id,account_id)
);
CREATE TABLE xero_v1.mapping_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
 mapping_version_id uuid REFERENCES xero_v1.mapping_versions(id),
 action text NOT NULL CHECK (action IN ('confirmed','superseded','review_required')),
 reason text CHECK (reason IS NULL OR reason IN ('account_missing','account_inactive','account_wrong_type','directory_changed','currency_or_cutoff_review_required')),
 actor_id uuid REFERENCES auth.users(id), occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE xero_v1.credential_envelopes (
 connection_id uuid PRIMARY KEY REFERENCES xero_v1.connections(id) ON DELETE CASCADE,
 ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) BETWEEN 1 AND 16384),
 encrypted_dek bytea NOT NULL CHECK (octet_length(encrypted_dek) BETWEEN 1 AND 16384),
 key_version text NOT NULL CHECK (length(trim(key_version)) BETWEEN 1 AND 128),
 algorithm text NOT NULL CHECK (algorithm IN ('AES-256-GCM')),
 version integer NOT NULL CHECK (version > 0), created_at timestamptz NOT NULL DEFAULT now(),
 rotated_at timestamptz, lease_expires_at timestamptz,
 CHECK (rotated_at IS NULL OR rotated_at >= created_at)
);
CREATE TABLE xero_v1.credential_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), connection_id uuid REFERENCES xero_v1.connections(id) ON DELETE SET NULL,
 actor_id uuid REFERENCES auth.users(id),
 action text NOT NULL CHECK (action IN ('credential_stored','credential_rotated','credential_refresh_failed','credential_deleted')),
 safe_reason text CHECK (safe_reason IS NULL OR safe_reason IN ('invalid_grant','provider_unavailable','refresh_failed','scope_changed','tenant_unavailable')),
 occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Bounded, append-only calculated evidence. Raw Xero reports, OAuth material,
-- transactions and Shopify values never enter these relations.
CREATE TABLE xero_v1.accounting_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
 mapping_version_id uuid NOT NULL,
 scope_from date NOT NULL, scope_to date NOT NULL,
 currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'), closed_period boolean NOT NULL DEFAULT false,
 state text NOT NULL CHECK (state IN ('supported','failed','review_required','invalidated')),
 reason text CHECK (reason IS NULL OR reason IN ('source_refresh_failed','source_review_required','account_mapping_review_required','later_posting_review_required','accounting_evidence_unavailable','connection_disconnected')),
 report_as_of date, retrieved_at timestamptz NOT NULL,
 source_fingerprint text CHECK (source_fingerprint IS NULL OR source_fingerprint ~ '^[a-f0-9]{64}$'),
 booked_revenue_minor bigint, processing_fee_minor bigint, advertising_minor bigint, software_minor bigint, included_cash_minor bigint,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK (scope_from <= scope_to),
 CHECK ((state='supported' AND reason IS NULL AND report_as_of IS NOT NULL AND source_fingerprint IS NOT NULL
  AND booked_revenue_minor IS NOT NULL AND processing_fee_minor IS NOT NULL AND advertising_minor IS NOT NULL AND software_minor IS NOT NULL AND included_cash_minor IS NOT NULL)
  OR (state<>'supported' AND report_as_of IS NULL AND source_fingerprint IS NULL AND booked_revenue_minor IS NULL AND processing_fee_minor IS NULL AND advertising_minor IS NULL AND software_minor IS NULL AND included_cash_minor IS NULL)),
 FOREIGN KEY(mapping_version_id,connection_id) REFERENCES xero_v1.mapping_versions(id,connection_id)
);
CREATE INDEX xero_accounting_evidence_lookup ON xero_v1.accounting_evidence(connection_id,scope_from,scope_to,currency,closed_period,created_at DESC);
CREATE FUNCTION xero_v1.reject_accounting_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'xero accounting evidence is append-only'; END $$;
CREATE TRIGGER xero_accounting_evidence_append_only BEFORE UPDATE OR DELETE ON xero_v1.accounting_evidence FOR EACH ROW EXECUTE FUNCTION xero_v1.reject_accounting_evidence_mutation();
CREATE TABLE xero_v1.accounting_evidence_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), evidence_id uuid NOT NULL REFERENCES xero_v1.accounting_evidence(id),
 action text NOT NULL CHECK (action IN ('recorded','served_stale','review_required')),
 actor_kind text NOT NULL CHECK (actor_kind IN ('worker','server')), occurred_at timestamptz NOT NULL DEFAULT now(), UNIQUE(evidence_id,action)
);

ALTER TABLE xero_v1.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.account_directories ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.mapping_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.mapping_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.mapping_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.credential_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.credential_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.accounting_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.accounting_evidence_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA xero_v1 FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA xero_v1 TO authenticated;
GRANT SELECT ON xero_v1.connections,xero_v1.account_directories,xero_v1.mapping_versions,xero_v1.mapping_selections,xero_v1.mapping_audit TO authenticated;
CREATE POLICY xero_connection_member_read ON xero_v1.connections FOR SELECT TO authenticated USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id=(SELECT auth.uid())));
CREATE POLICY xero_directory_member_read ON xero_v1.account_directories FOR SELECT TO authenticated USING (connection_id IN (SELECT id FROM xero_v1.connections));
CREATE POLICY xero_mapping_member_read ON xero_v1.mapping_versions FOR SELECT TO authenticated USING (connection_id IN (SELECT id FROM xero_v1.connections));
CREATE POLICY xero_selection_member_read ON xero_v1.mapping_selections FOR SELECT TO authenticated USING (mapping_version_id IN (SELECT id FROM xero_v1.mapping_versions));
CREATE POLICY xero_audit_member_read ON xero_v1.mapping_audit FOR SELECT TO authenticated USING (connection_id IN (SELECT id FROM xero_v1.connections));

COMMIT;
