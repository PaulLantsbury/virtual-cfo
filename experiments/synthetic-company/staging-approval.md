# Synthetic company: bounded staging proposal and executable local rehearsal

Status: prepared and locally rehearsed only. Existing connected Supabase audit access is read-only. No live company, membership, rows, grants, migration, scheduler or provider transaction has been created. This package has no remote database driver, URL, secret or apply command.

## What is concrete

`staging-payload.mjs` maps the immutable approved **uk-gifts-v2** company (£750,000 annual turnover, four employees) to a new reserved fictional identity. `prepareStagingPayload` requires that exact identity and an explicit reviewer UUID and model-review flag. It checks the source fingerprint against a fresh deterministic generation, event company/currency/timezone, journal balance and date coverage. Opening-cohort refunds retain actual earlier generated original-order snapshots, including original gross, discounts and VAT; amounts are not reconstructed from refund totals.

Each fictional order has one or two **quantity-one gift items** with exact historical landed costs. The scenario's deterministic gift composition assigns a returnable item and, when needed, a retained item. Its net price/allocated discount and landed cost conserve the original order. In rare rounding cases the retained item is a complimentary low-cost gift with zero selling price. Composition follows the fixed profile/date rule; it is not provider-observed physical stock or an assertion about real merchant baskets. A recovery row is created only when the actual generated refund event occurs, and returns one whole item. No money amounts are used as physical quantities.

`staging-rehearsal.mjs` uses existing repository bootstrap and finance_v1 profit-evidence schemas in a newly created **in-memory PGlite database**. Branded handles prevent passing an external database to the executable writer. It verifies the existing reviewer and prior membership, refuses occupied identities, binds evidence to database snapshots, imports monthly cost sources, seals complete local synthetic months and invokes the existing canonical profit reader. Default mode rolls back. `commit-local` persists only inside the disposable instance for reader/replay tests. Exact replay inserts zero; changed payload/source state is refused. Whole-relation fingerprints verify unrelated stores remain unchanged. The local receipt table is test infrastructure, not a proposed live schema.

`staging-sql-proposal.mjs` exports explicit source/evidence rows from that validated database as a **rollback-only SQL review artifact**, bounded to one complete month. It requires an explicit reviewer UUID. The script guards the exact reserved identity, reviewer existence/prior membership and column/constraint/trigger contract; counts and SHA-256 fingerprints check every scoped relation and preserve unrelated-store state. SQL text serialization preserves original PostgreSQL numeric representation inside observed snapshots. It ends with `ROLLBACK`, contains no grant/policy/user/schema/provider creation, and refuses an occupied target. It intentionally refuses replay rather than duplicating live data. A separate append/replay protocol is still required for persistent daily operation.

## Local usage

Run with Node 22+ and the repository's existing locked dependencies:

```sh
node --test experiments/synthetic-company/staging-independent.test.mjs
```

Programmatic review entry points:

```js
const fixture = generate({ asOf: '2026-11-05' });
const local = await createStagingRehearsal();
const payload = prepareStagingPayload(fixture, {
  reviewerId: local.reviewerId,
  identity: RESERVED_SYNTHETIC_IDENTITY,
  from: '2025-01-01', to: '2025-01-31', reviewed: true,
});
await executeStagingRehearsal(local, payload); // rollback by default
await local.db.close();
```

Use the same month's fixture to build `prepareStagingSqlProposal(fixture,{reviewerId,from,to})`; inspect returned `readOnlyPreflightSql`, `rollbackSql`, `counts`, `payloadHash`, `schemaHash`, `sqlHash` and `approvalGates`. Do not send disposable reviewer IDs to staging. Output must be bound privately to the approved existing staging reviewer after the connection and access checks below. No generated SQL is committed as an instruction to execute.

## Local acceptance evidence

The January 2025 rehearsal contains 1,227 retained original orders, 1,311 quantity-one lines, 71 refund/recovery events and four monthly cost source entries. The canonical reader returns **complete**: £45,000 turnover, £21,600 gross profit, £1,976.02 operating profit and £2,176.02 EBITDA. Local test coverage also exercises rollback after source insertion and before commit, existing-identity rejection, exact replay, changed sources/payload refusal, denied member, unbranded handle rejection, explicit coverage and unrelated-store preservation. Independent tests and their exact run result remain the batch handover's authority.

These rows are explicitly fictional. `actual` in the existing cost source contract means booked fixture accruals, not real-world invoices or externally audited amounts. Monthly source consolidation retains the source journal fingerprint and scoped journal IDs. Other bank/payroll/stock activity remains in the underlying synthetic ledger; this sales/profit package does not validate cash, attribution, product ageing, monitoring delivery or provider API behaviour.

## Exact boundary before any live application

1. Independently verify the private staging connection/TLS/project identity and permitted operator role. The public package deliberately embeds no operational provider or account details. Session attestation is a manual assertion, not authentication or proof of server identity.
2. Confirm the reserved new synthetic identity is vacant; verify the existing approved reviewer UUID and intended new-company membership. Never reuse Store D, Historical Store, a provider store or a customer store. No auth user is to be created by this package.
3. Run the read-only schema/trigger/RLS/grant inspection using approved read-only access. Compare the live schema with the prepared contract. Catalog equality alone does not establish effective permissions. The current connector cannot execute this insert package; an explicitly approved operator path is needed. Do not broaden the audit connector or add broad grants automatically.
4. Approve the exact bounded initial month, company/membership addition, counts and script checksum after concrete private binding. Rebuild and rehearse the bound artifact, and compare canonical reader values with the independent ledger oracle. The rollback-only artifact does not authorize replacing `ROLLBACK` with `COMMIT`.
5. A commit-capable initial seed artifact, actual operator execution and authenticated browser acceptance must be reviewed separately at that point. No live success is claimed here. Retain transactional rollback for any failed pre/postflight; sealed append-only evidence cannot safely be deleted as an after-the-fact rollback.
6. Resolve the source metadata contract before live v11 page wiring. Version `created_at`/evidence `recorded_at` are authoring timestamps, not source-as-of. `sourceAsOf.businessDate` in this payload describes generated completed business days and is explicitly **not canonical verification**. The separate snapshot-contract proposal must carry verified business/as-of/version/coverage information; a fetch timestamp is insufficient.
7. Daily append, immutable closed-month source-revision strategy, durable run receipts, concurrency/idempotency and full 24-month seeding need subsequent bounded rehearsals. Existing profit revisions hash store-wide history: adding new sales can stale earlier sealed versions. Do not start a daily writer until that behaviour has a reviewed solution.

No provider write, retry, catch-up or test-flag change is part of this stream. Shopify/Xero acceptance remains independent.
