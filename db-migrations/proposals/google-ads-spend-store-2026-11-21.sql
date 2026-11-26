-- PROPOSAL ONLY. Do not apply until reviewed with the current staging schema,
-- worker identity, RPC boundaries, key management and Google app configuration.
-- Stores only the Google Ads OAuth grant and daily account-level spend coverage.
BEGIN;

CREATE SCHEMA IF NOT EXISTS google_ads_v1;
REVOKE ALL ON SCHEMA google_ads_v1 FROM PUBLIC, anon, authenticated;

CREATE TABLE google_ads_v1.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL CHECK (status IN ('pending','connected','reauthorization_required','disconnected','revoked')),
  granted_scope text[] NOT NULL DEFAULT '{}',
  oauth_app_publishing_status text CHECK (oauth_app_publishing_status IS NULL OR oauth_app_publishing_status IN ('testing','production')),
  reauthorize_by timestamptz,
  credential_expires_at timestamptz,
  pending_selection_digest bytea CHECK (pending_selection_digest IS NULL OR octet_length(pending_selection_digest)=32),
  pending_selection_expires_at timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (granted_scope <@ ARRAY['https://www.googleapis.com/auth/adwords']::text[]),
  CHECK ((oauth_app_publishing_status='testing' AND reauthorize_by IS NOT NULL)
      OR (oauth_app_publishing_status='production' AND reauthorize_by IS NULL)
      OR oauth_app_publishing_status IS NULL),
  CHECK (status<>'connected' OR (connected_at IS NOT NULL AND disconnected_at IS NULL)),
  CHECK ((pending_selection_digest IS NULL) = (pending_selection_expires_at IS NULL)),
  CHECK (status='pending' OR pending_selection_digest IS NULL),
  CHECK (status<>'pending' OR pending_selection_digest IS NOT NULL),
  UNIQUE (id, store_id)
);
CREATE INDEX google_ads_connections_store_idx ON google_ads_v1.connections(store_id, status);

-- Only a cryptographic digest of the high-entropy state is retained. State values and authorization codes are
-- never persisted in plaintext; consume_state must be single-use and session-bound.
CREATE TABLE google_ads_v1.oauth_states (
  state_digest bytea PRIMARY KEY CHECK (octet_length(state_digest)=32),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX google_ads_oauth_state_expiry_idx ON google_ads_v1.oauth_states(expires_at) WHERE consumed_at IS NULL;

-- Envelope-encrypted OAuth refresh token. Google does not normally return a
-- fixed refresh-token expiry, so credential_expires_at is nullable. Never
-- persist access tokens, Google client secrets, OAuth codes or PKCE verifiers.
CREATE TABLE google_ads_v1.credential_envelopes (
  connection_id uuid PRIMARY KEY REFERENCES google_ads_v1.connections(id) ON DELETE CASCADE,
  ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) BETWEEN 1 AND 16384),
  encrypted_dek bytea NOT NULL CHECK (octet_length(encrypted_dek) BETWEEN 1 AND 16384),
  key_version text NOT NULL CHECK (key_version ~ '^[A-Za-z0-9._-]{1,128}$'),
  algorithm text NOT NULL CHECK (algorithm='AES-256-GCM'),
  version integer NOT NULL CHECK (version > 0),
  credential_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  lease_expires_at timestamptz,
  CHECK (rotated_at IS NULL OR rotated_at >= created_at)
);

CREATE TABLE google_ads_v1.ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES google_ads_v1.connections(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id text NOT NULL CHECK (customer_id ~ '^[0-9]{10}$'),
  login_customer_id text CHECK (login_customer_id IS NULL OR login_customer_id ~ '^[0-9]{10}$'),
  currency char(3) CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  timezone_name text CHECK (timezone_name IS NULL OR length(timezone_name) BETWEEN 1 AND 128),
  selected_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  UNIQUE (id, connection_id, store_id),
  FOREIGN KEY (connection_id, store_id) REFERENCES google_ads_v1.connections(id, store_id) ON DELETE CASCADE,
  CHECK (NOT active OR (selected_at IS NOT NULL AND currency IS NOT NULL AND timezone_name IS NOT NULL))
);
-- The advertiser customer ID identifies the spend account. login_customer_id
-- is optional manager context for authorization and is not the report account.
CREATE UNIQUE INDEX google_ads_account_connection_identity_idx
  ON google_ads_v1.ad_accounts(connection_id,customer_id,COALESCE(login_customer_id,''));
CREATE UNIQUE INDEX google_ads_one_active_account_per_connection
  ON google_ads_v1.ad_accounts(connection_id) WHERE active;
CREATE UNIQUE INDEX google_ads_one_active_store_account
  ON google_ads_v1.ad_accounts(store_id) WHERE active;

CREATE TABLE google_ads_v1.collection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  store_id uuid NOT NULL,
  requested_from date NOT NULL,
  requested_to date NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{16,200}$'),
  api_version text NOT NULL CHECK (api_version ~ '^v[0-9]+$'),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','partial','failed')),
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  lease_expires_at timestamptz,
  pages_read integer NOT NULL DEFAULT 0 CHECK (pages_read BETWEEN 0 AND 100),
  safe_failure text CHECK (safe_failure IS NULL OR safe_failure IN ('token_expired','access_revoked','provider_unavailable','invalid_response','scope_missing')),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requested_from <= requested_to AND requested_to-requested_from <= 92),
  CHECK (finished_at IS NULL OR finished_at >= started_at),
  CHECK ((status='running') = (finished_at IS NULL)),
  CHECK ((status='running') = (lease_expires_at IS NOT NULL)),
  CHECK ((status='failed') = (safe_failure IS NOT NULL)),
  FOREIGN KEY (account_id, connection_id, store_id) REFERENCES google_ads_v1.ad_accounts(id, connection_id, store_id) ON DELETE CASCADE,
  UNIQUE (id, account_id),
  UNIQUE (account_id, idempotency_key)
);

-- Each run preserves the provider's account/day observation and its coverage.
-- A provider no-row is NULL with state=no_row; it is never materialized as zero.
CREATE TABLE google_ads_v1.daily_spend_observations (
  run_id uuid NOT NULL,
  account_id uuid NOT NULL,
  spend_date date NOT NULL,
  coverage_state text NOT NULL CHECK (coverage_state IN ('provider_row','no_row','partial','failed')),
  spend_micros numeric(19,0),
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, spend_date),
  FOREIGN KEY (run_id, account_id) REFERENCES google_ads_v1.collection_runs(id, account_id) ON DELETE CASCADE,
  CHECK ((coverage_state='provider_row' AND spend_micros IS NOT NULL AND spend_micros BETWEEN 0 AND 9223372036854775807)
      OR (coverage_state<>'provider_row' AND spend_micros IS NULL))
);
CREATE INDEX google_ads_spend_account_day_idx ON google_ads_v1.daily_spend_observations(account_id, spend_date DESC);

CREATE TABLE google_ads_v1.credential_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES google_ads_v1.connections(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('credential_stored','credential_rotated','credential_refresh_failed','credential_deleted','connection_disconnected','connection_reauthorization_required')),
  safe_reason text CHECK (safe_reason IS NULL OR safe_reason IN ('token_expired','access_revoked','provider_unavailable','scope_missing','reauthorization_required')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_ads_v1.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_v1.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_v1.credential_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_v1.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_v1.collection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_v1.daily_spend_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_v1.credential_audit ENABLE ROW LEVEL SECURITY;

-- Merchant reads go through the bounded, store-membership-checked report RPC.
-- Do not expose raw Google connections, account rows, runs or daily observations
-- to browser roles. RLS remains enabled and there are no browser policies.
REVOKE ALL ON ALL TABLES IN SCHEMA google_ads_v1 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA google_ads_v1 FROM authenticated;
-- No browser read/write grants. Server roles use fixed, store-bound RPCs only;
-- do not grant worker logins direct table privileges or object ownership.
COMMIT;
