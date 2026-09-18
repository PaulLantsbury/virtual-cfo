# Xero mapping store proposal — 18 September 2026

This is an unapplied schema proposal for the next Xero setup milestone. It is not a deployment, migration approval or authority to retain credentials or accounting values.

It introduces a tenant-pinned connection reference, value-free account-directory snapshots, immutable mapping versions, account selections and audit events. Every record is scoped through the existing store-membership model. Browser roles receive read access only; no browser write privilege is granted.

The proposal intentionally excludes OAuth tokens, refresh tokens, report responses, balances, transactions, calculated accounting values and Shopify fields. A later authenticated server command must derive the user and store from verified identity, validate the current directory against the pinned tenant, append a new version and audit record, and reject cross-store or cross-tenant requests.

Before application, test: two users/two stores; forged and revoked membership; tenant mismatch; duplicate account IDs across tenants; archived/missing/wrong-type accounts; concurrent version confirmation; historical/future effective dates; no direct browser write; and absence of raw Xero financial payloads in tables, logs and API responses. Final accounting and cash results remain blocked pending the policy decisions already listed in the mapping design.
