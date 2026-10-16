-- PROPOSAL ONLY — reviewed disposable schema for local/staging use. Do not apply
-- to production without a fresh security review and configured envelope key service.
-- Requires xero_v1.connections. It stores encrypted refresh material only; never
-- access tokens, client secrets, reports, values, transactions or Shopify IDs.
BEGIN;
CREATE TABLE xero_v1.credential_envelopes (
 connection_id uuid PRIMARY KEY REFERENCES xero_v1.connections(id) ON DELETE CASCADE,
 ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) BETWEEN 1 AND 16384),
 encrypted_dek bytea NOT NULL CHECK (octet_length(encrypted_dek) BETWEEN 1 AND 16384),
 key_version text NOT NULL CHECK (length(trim(key_version)) BETWEEN 1 AND 128),
 algorithm text NOT NULL CHECK (algorithm IN ('AES-256-GCM')),
 version integer NOT NULL CHECK (version > 0),
 created_at timestamptz NOT NULL DEFAULT now(), rotated_at timestamptz, lease_expires_at timestamptz,
 CHECK (rotated_at IS NULL OR rotated_at >= created_at)
);
CREATE TABLE xero_v1.credential_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), connection_id uuid REFERENCES xero_v1.connections(id) ON DELETE SET NULL,
 actor_id uuid REFERENCES auth.users(id),
 action text NOT NULL CHECK (action IN ('credential_stored','credential_rotated','credential_refresh_failed','credential_deleted')),
 safe_reason text CHECK (safe_reason IS NULL OR safe_reason IN ('invalid_grant','provider_unavailable','refresh_failed','scope_changed','tenant_unavailable')),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE xero_v1.credential_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_v1.credential_audit ENABLE ROW LEVEL SECURITY;
-- No browser policies/grants. A later narrowly scoped server worker gets direct
-- access only after staging environment and key-service review.
REVOKE ALL ON xero_v1.credential_envelopes,xero_v1.credential_audit FROM PUBLIC,anon,authenticated;
COMMIT;
