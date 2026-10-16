-- PROPOSAL ONLY. DO NOT APPLY WITHOUT A SEPARATE REVIEW AND APPROVAL.
-- Parallel summary P&L mapping foundation. This deliberately leaves the deployed
-- xero_v1.mapping_* five-category bootstrap and credential connection untouched.
-- It stores account classification metadata only: no credentials, reports,
-- balances, transactions, prompts or financial amounts.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, xero_v1, public;

CREATE TABLE xero_v1.pnl_mapping_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
 version integer NOT NULL CHECK (version > 0),
 effective_from date NOT NULL,
 state text NOT NULL CHECK (state IN ('draft','confirmed','superseded')),
 directory_retrieved_at timestamptz NOT NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 confirmed_by uuid REFERENCES auth.users(id),
 confirmed_at timestamptz,
 supersedes_id uuid REFERENCES xero_v1.pnl_mapping_versions(id),
 UNIQUE (connection_id, version),
 UNIQUE (connection_id, effective_from),
 UNIQUE (id, connection_id),
 UNIQUE (supersedes_id),
 CHECK ((state IN ('confirmed','superseded') AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
     OR (state='draft' AND confirmed_by IS NULL AND confirmed_at IS NULL)),
 CHECK ((version=1 AND supersedes_id IS NULL) OR (version>1 AND supersedes_id IS NOT NULL)),
 FOREIGN KEY (supersedes_id, connection_id)
   REFERENCES xero_v1.pnl_mapping_versions(id, connection_id)
);

CREATE TABLE xero_v1.pnl_line_dispositions (
 mapping_version_id uuid NOT NULL REFERENCES xero_v1.pnl_mapping_versions(id),
 line_code text NOT NULL CHECK (line_code IN (
  'total_revenue','cogs','fulfilment_costs','performance_marketing','salaries',
  'other_overheads','depreciation_amortisation','interest','tax'
 )),
 disposition text NOT NULL CHECK (disposition IN ('mapped','not_applicable')),
 PRIMARY KEY (mapping_version_id, line_code)
);

CREATE TABLE xero_v1.pnl_mapping_selections (
 mapping_version_id uuid NOT NULL REFERENCES xero_v1.pnl_mapping_versions(id),
 line_code text NOT NULL,
 account_id text NOT NULL CHECK (length(trim(account_id)) BETWEEN 1 AND 256),
 selection_source text NOT NULL CHECK (selection_source IN ('owner','legacy_seed','suggestion_accepted')),
 PRIMARY KEY (mapping_version_id, line_code, account_id),
 UNIQUE (mapping_version_id, account_id),
 FOREIGN KEY (mapping_version_id, line_code)
   REFERENCES xero_v1.pnl_line_dispositions(mapping_version_id, line_code)
);

CREATE TABLE xero_v1.pnl_suggestion_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES xero_v1.connections(id),
 directory_retrieved_at timestamptz NOT NULL,
 engine text NOT NULL CHECK (engine IN ('rules_v1','ai_v1')),
 engine_version text NOT NULL CHECK (length(trim(engine_version)) BETWEEN 1 AND 128),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE xero_v1.pnl_mapping_suggestions (
 suggestion_run_id uuid NOT NULL REFERENCES xero_v1.pnl_suggestion_runs(id),
 line_code text NOT NULL CHECK (line_code IN (
  'total_revenue','cogs','fulfilment_costs','performance_marketing','salaries',
  'other_overheads','depreciation_amortisation','interest','tax'
 )),
 account_id text NOT NULL CHECK (length(trim(account_id)) BETWEEN 1 AND 256),
 confidence text NOT NULL CHECK (confidence IN ('low','medium','high')),
 rationale jsonb NOT NULL CHECK (jsonb_typeof(rationale)='array' AND jsonb_array_length(rationale) BETWEEN 1 AND 8),
 review_state text NOT NULL DEFAULT 'review_required' CHECK (review_state IN ('review_required','accepted','rejected')),
 reviewed_by uuid REFERENCES auth.users(id),
 reviewed_at timestamptz,
 PRIMARY KEY (suggestion_run_id, line_code, account_id),
 CHECK ((review_state='review_required' AND reviewed_by IS NULL AND reviewed_at IS NULL)
     OR (review_state<>'review_required' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

-- Derived rows (CM1, CM2, CM3, EBITDA, PBT and PAT) are intentionally absent.
-- They are deterministic calculations, never selectable account destinations.
-- A later SECURITY DEFINER confirmation command must verify exactly nine line
-- dispositions, at least one selection for every `mapped` line, no selection
-- for `not_applicable`, active/type-compatible accounts from the pinned
-- directory, owner membership and immutable version succession atomically.

ALTER TABLE xero_v1.pnl_mapping_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.pnl_line_dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.pnl_mapping_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.pnl_suggestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.pnl_mapping_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON xero_v1.pnl_mapping_versions,xero_v1.pnl_line_dispositions,
 xero_v1.pnl_mapping_selections,xero_v1.pnl_suggestion_runs,
 xero_v1.pnl_mapping_suggestions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON xero_v1.pnl_mapping_versions,xero_v1.pnl_line_dispositions,
 xero_v1.pnl_mapping_selections,xero_v1.pnl_suggestion_runs,
 xero_v1.pnl_mapping_suggestions TO authenticated;

CREATE POLICY xero_pnl_version_member_read ON xero_v1.pnl_mapping_versions
 FOR SELECT TO authenticated USING (connection_id IN (SELECT id FROM xero_v1.connections));
CREATE POLICY xero_pnl_disposition_member_read ON xero_v1.pnl_line_dispositions
 FOR SELECT TO authenticated USING (mapping_version_id IN (SELECT id FROM xero_v1.pnl_mapping_versions));
CREATE POLICY xero_pnl_selection_member_read ON xero_v1.pnl_mapping_selections
 FOR SELECT TO authenticated USING (mapping_version_id IN (SELECT id FROM xero_v1.pnl_mapping_versions));
CREATE POLICY xero_pnl_suggestion_run_member_read ON xero_v1.pnl_suggestion_runs
 FOR SELECT TO authenticated USING (connection_id IN (SELECT id FROM xero_v1.connections));
CREATE POLICY xero_pnl_suggestion_member_read ON xero_v1.pnl_mapping_suggestions
 FOR SELECT TO authenticated USING (suggestion_run_id IN (SELECT id FROM xero_v1.pnl_suggestion_runs));

ROLLBACK;
