# Xero mapping store proposal — 18 September 2026

This is an unapplied schema proposal for the next Xero setup milestone. The 18 September prototype approval permits application only to a verified development/staging environment; it is not a production deployment or authority to use real merchant credentials or expose real accounting values. See [agreed Xero prototype policies](consolidated-decision-pack-2026-09-18.md).

It introduces a tenant-pinned connection reference, value-free account-directory snapshots, immutable mapping versions, account selections and audit events. Every record is scoped through the existing store-membership model. Browser roles receive read access only; no browser write privilege is granted.

The proposal intentionally excludes OAuth tokens, refresh tokens, report responses, balances, transactions, calculated accounting values and Shopify fields. A later authenticated server command must derive the user and store from verified identity, validate the current directory against the pinned tenant, append a new version and audit record, and reject cross-store or cross-tenant requests.

Before a staging-only application, test: two users/two stores; forged and revoked membership; tenant mismatch; duplicate account IDs across tenants; archived/missing/wrong-type accounts; concurrent version confirmation; historical/future effective dates; no direct browser write; and absence of raw Xero financial payloads in tables, logs and API responses. Accounting and cash reader work may proceed only with the agreed accrual, tax, freshness and cash methodology, and without Shopify/Xero comparison.
