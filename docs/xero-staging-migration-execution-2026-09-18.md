# Xero staging migration execution package

Status: reviewed, **not applied**. This is the exact one-shot installer for the non-production Night Scout Supabase project `bioalckltvkhlczusdvl`. It must never be used for production.

## Operator sequence

1. In the Supabase SQL editor, visibly select `bioalckltvkhlczusdvl`, then run [the read-only preflight](../db-migrations/staging/preflight-xero-staging-2026-09-18.sql). Confirm its prerequisites are true and it reports no `xero_v1` relations.
2. Run [the one-shot atomic installer](../db-migrations/staging/20260918_apply_xero_staging.sql) as the staging migration owner. It creates the mapping and credential-envelope tables in a single transaction. It creates no data, users, roles, worker credentials, scheduled jobs, OAuth credentials, or browser write access.
3. Run [the read-only verification](../db-migrations/staging/verify-xero-staging-2026-09-18.sql). Confirm seven RLS-enabled tables, member-read policies on mapping data, no browser policies/grants on credentials, and no unexpected grantee.
4. Record the execution timestamp, operator, SHA-256 of the installer, preflight output, and verification output in the staging change record. Do not place secrets, tokens, ciphertext, financial values, or raw Xero API responses in that record.

## Safe repeat and recovery

The installer refuses any pre-existing `xero_v1` schema, including an empty one. A failed transaction leaves no partial package and may be rerun only after re-running the preflight. A successful run must **not** be reapplied: inspect the verification record and catalog instead. There is deliberately no automatic rollback script, since dropping a schema after credentials/evidence have been written could destroy staging records. Recovery after a successful installation requires a separately reviewed, explicit staging-only change.

The package never names, grants to, revokes from, alters, or assumes the identity of the restricted worker database login. That account therefore remains restricted. A later worker-access package must be separately reviewed and granted only the minimal tables it needs; it must not grant browser roles access to encrypted credential envelopes.

The SQL file cannot prove the Supabase project ref from a database connection. Visible dashboard project selection is an operator control, and the transactional SQL only defends the in-database schema boundary.

## Accounting-evidence persistence assessment

This installer intentionally does **not** create the accounting/cash evidence store required for real end-to-end collection. The current `xero_v1` tables are sufficient only for connection identity, account-directory snapshots, immutable mapping provenance and encrypted refresh envelopes. They do not have a bounded, member-safe place for a period result, dated cash result, source report date, mapping-version reference, refresh state, invalidation reason, or immutable evidence provenance.

That omission is deliberate: the existing reader contract says the eventual store must preserve scoped provenance and freshness without retaining raw Xero reports or browser-readable credentials. The staging refresh harness currently demonstrates this boundary in memory. Before it can persist and display a real staging Xero result, a separate reviewed evidence migration is required. It should be append-only or snapshot-versioned; pin store, tenant, currency, period/report date and mapping version; retain only the agreed calculated fields and safe freshness/review metadata; deny browser access to credential/raw-payload data; and give the restricted worker only the narrowly required write/read privileges. It must not repurpose Shopify `finance_v1` evidence or create a cross-source reconciliation path.
