-- PROPOSAL ONLY — do not apply without separate approval and a fresh schema review.
-- Stores mapping provenance and chart-of-account metadata only. It stores no Xero
-- credentials, report responses, balances, transactions or calculated values.

BEGIN;
CREATE SCHEMA IF NOT EXISTS xero_v1;

CREATE TABLE xero_v1.connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 tenant_id text NOT NULL CHECK (length(trim(tenant_id)) BETWEEN 1 AND 256),
 created_at timestamptz NOT NULL DEFAULT now(),
 retired_at timestamptz,
 UNIQUE (store_id,tenant_id),
 CHECK (retired_at IS NULL OR retired_at>=created_at)
);
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
 version integer NOT NULL CHECK (version>0),
 effective_from date NOT NULL,
 confirmed_by uuid NOT NULL REFERENCES auth.users(id),
 confirmed_at timestamptz NOT NULL,
 directory_retrieved_at timestamptz NOT NULL,
 supersedes_id uuid REFERENCES xero_v1.mapping_versions(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(connection_id,version),
 CHECK ((version=1 AND supersedes_id IS NULL) OR (version>1 AND supersedes_id IS NOT NULL))
);
CREATE TABLE xero_v1.mapping_selections (
 mapping_version_id uuid NOT NULL REFERENCES xero_v1.mapping_versions(id),
 category text NOT NULL CHECK (category IN ('revenue','processingFee','advertising','software','includedCash')),
 account_id text NOT NULL CHECK (length(trim(account_id)) BETWEEN 1 AND 256),
 PRIMARY KEY(mapping_version_id,category,account_id),
 UNIQUE(mapping_version_id,account_id)
);
CREATE TABLE xero_v1.mapping_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
 mapping_version_id uuid REFERENCES xero_v1.mapping_versions(id),
 action text NOT NULL CHECK (action IN ('confirmed','superseded','review_required')),
 reason text CHECK (reason IS NULL OR reason IN ('account_missing','account_inactive','account_wrong_type','directory_changed','currency_or_cutoff_review_required')),
 actor_id uuid REFERENCES auth.users(id),
 occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE xero_v1.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.account_directories ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.mapping_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.mapping_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.mapping_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA xero_v1 FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA xero_v1 TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA xero_v1 TO authenticated;
CREATE POLICY xero_connection_member_read ON xero_v1.connections FOR SELECT TO authenticated USING (store_id IN (SELECT store_id FROM public.store_memberships WHERE user_id=(SELECT auth.uid())));
CREATE POLICY xero_directory_member_read ON xero_v1.account_directories FOR SELECT TO authenticated USING (connection_id IN (SELECT id FROM xero_v1.connections));
CREATE POLICY xero_mapping_member_read ON xero_v1.mapping_versions FOR SELECT TO authenticated USING (connection_id IN (SELECT id FROM xero_v1.connections));
CREATE POLICY xero_selection_member_read ON xero_v1.mapping_selections FOR SELECT TO authenticated USING (mapping_version_id IN (SELECT id FROM xero_v1.mapping_versions));
CREATE POLICY xero_audit_member_read ON xero_v1.mapping_audit FOR SELECT TO authenticated USING (connection_id IN (SELECT id FROM xero_v1.connections));
-- No browser INSERT/UPDATE/DELETE grants. A later reviewed server-side command
-- must validate membership, tenant, directory state and immutable versioning.
COMMIT;
