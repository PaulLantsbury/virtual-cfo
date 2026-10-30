# Separate GBP Demo reader consent — 30 October 2026

Prepared source with synthetic verification only. No new host, app, credentials, grants, migration, consent or schedule has been created/applied. The working customer reader remains separate. The new demo-reader proposal is bounded from30October until **6November2026 03:00UTC**, allowing the final actual6November02:00 reader to collect the final5November invoice. The consent runtime rejects enabled startup, new consent, authentication and callbacks at/after that exact stop before provider/database work; SQL and the separate worker must enforce the same durable stop. No automatic renewal or existing-reader cutoff is implied. This package connects an independently verified GBP Demo Company to the dedicated proposed demo store `f59e3a44-7106-4df8-9c08-52da30c9de30`; it does not attach demo accounting to the existing Shopify store/dashboard.

## Fixed two-phase journey

1. Configure an approved **new separate Demo Reader Xero app** and a separate consent web host. Do not reuse the customer-reader or test-writer app, callback, host, database role or encryption key. These resources and their costs/terms/access are still unapproved proposals.
2. On that host, the existing configured owner signs in directly with Supabase and verifies enrolled TOTP. If none exists, the prepared explicit **Set up authenticator** action is owner-operated credential creation: the owner must personally choose it and submit the code in their own browser. The agent does not perform enrollment or read/copy its real QR/key/code. See [owner sign-in](../test-programme/OPERATOR-OWNER-SIGNIN.md).
3. **Discover Demo Company accounts** requests only `openid profile email accounting.settings.read`; no offline access or refresh credential is retained. The fresh callback reads at most five actual Xero connections, checks each Organisation, and includes only actual `IsDemoCompany=true`, GBP tenants. It reads each included tenant's bounded Accounts directory. Names alone never establish demo status. No reports, contacts or ledger data are fetched here.
4. The callback consumes its one-use state and returns an empty-body302 to the owner page with a short-lived opaque owner-bound handle. No provider code or token enters HTML. The owner signs in/verifies TOTP again to consume that handle and view safe account metadata. Handles and source metadata are memory-only, size/time bounded and lost on restart. They cannot authenticate a user.
5. Explicitly choose the verified Demo Company and five **distinct existing active accounts**: revenue, processing fee, advertising, software and included cash. The owner page displays the exact London reader period. The mapping effective date initially shows its first day and must be confirmed/edited to cover that period. On the first London day of a month, this means the previous complete month, matching the existing reader planner. Mapping date is distinct from test-generation dates and creates no backfill approval.
6. **Save choices and authorise Demo reader** opens a fresh consent with settings, the four existing granular report-read scopes and offline access. The callback checks the exact selected tenant is still connected, re-reads actual GBP Demo status and the Accounts directory, and rejects changed/missing/inactive/wrong-type mappings. No guessed tenant/account flags or cached discovery token can seed a reader.
7. Only then, encrypt the refresh credential with the new demo-only AAD codec and dedicated key. On a fresh restricted transaction, verify the dedicated login/service role flags and sole SET-only membership, set local role, set the API-derived source receipt, and call only `xero_demo_v1.bootstrap_create_initial_connection` with the fixed store and existing twelve-argument contract. Membership/source guards and atomic persistence are enforced again by the separate SQL proposal. The callback returns no credential/ciphertext/raw provider body and leaves generation off.

The init-only SQL does not rotate/repoint an existing reader. Unknown or uncertain callbacks are not replayed automatically; source OAuth state is consumed before provider requests. A later callback-return notice is deliberately not treated as reader health. Verify the recorded new connection, mapping and restricted real preflight before scheduled-run acceptance. The future writer must select a revenue account actually included in this new reader mapping; merely connecting the same tenant is insufficient.

## Isolated package

From repository root:

```sh
node experiments/xero-demo/prepare-reader-consent-deployment.mjs experiments/xero-demo/.reader-consent-runtime
pnpm --dir experiments/xero-demo/.reader-consent-runtime install --config.auto-install-peers=false --frozen-lockfile --ignore-workspace --prod --ignore-scripts
```

Start:

```sh
node experiments/xero-demo/.reader-consent-runtime/reader-consent-server.mjs
```

Node24, `/health`, platform `PORT`, one consent process. The package copies exactly **six local modules**: its server/runtime, the fixed-mode owner MFA page/origin validator, and the built-in-only demo crypto/database-identity modules. Fixed import relocation does not import a worker/customer application or writer composition. Reusing the fixed owner page does not enable writer endpoints: this server exposes only `/api/xero-demo/reader/*`, always renders the demo-reader mode, and uses only read scopes and the dedicated bootstrap capability.

The independent installed package has exact Express5.2.1, pg8.20.0 and SupabaseJS2.100.1, using the existing integrity-pinned92-snapshot consent lock. The builder checks manifest dependencies, source/root lock hashes and provenance; no version resolution is performed. Dirty/unrelated outputs and symlinked entries are refused. No environment/config files, test fixtures, reader scheduler, provider write runner or customer app are copied. The public member-status RPC must already be installed by the separately reviewed SQL proposal before live authentication can start consent; the bootstrap DB role is not given broader membership/table access.

**Actual independent frozen installation passed**, scripts disabled and the ordinary supply-chain policy checks passed for all92 snapshots. The initial offline attempt failed safely because Supabase Auth package mirror metadata was absent; the normal frozen install then obtained metadata/packages without any bypass/version change. Actual installed-dependency smoke: disabled `/health`200 and owner page503; synthetic configured canonical-host page200 with MFA/intent controls; zero provider/database calls. These are local source/dependency/render checks, not hosted TLS, actual credentials, account enrollment, consent or execution proof.

## Explicit configuration only on the separate consent host

- `NIGHT_SCOUT_DEMO_READER_BOOTSTRAP_ENABLED` defaults off; enabling requires the approved isolated setup.
- `NIGHT_SCOUT_RUNTIME_ENV=staging`, `NIGHT_SCOUT_DEMO_PROJECT_REF=bioalckltvkhlczusdvl`, `NIGHT_SCOUT_DEMO_STORE_ID=f59e3a44-7106-4df8-9c08-52da30c9de30`.
- `NIGHT_SCOUT_DEMO_READER_OPERATOR_ORIGIN`: actual separately verified HTTPS origin. Register exactly that origin plus `/api/xero-demo/reader/callback` in the **new separate** reader app; set the exact same full callback in `NIGHT_SCOUT_DEMO_READER_REDIRECT_URI`. No guessed hostname is presented as a live endpoint.
- `NIGHT_SCOUT_REVIEW_AUTH_URL` fixed staging Supabase URL; `NIGHT_SCOUT_REVIEW_PUBLIC_KEY` verified public anon/publishable key only; `NIGHT_SCOUT_DEMO_READER_OWNER_ID` actual already approved owner.
- `NIGHT_SCOUT_DEMO_READER_CLIENT_ID`/`CLIENT_SECRET`: the new reader app's actual private configuration, installed by a secure owner step. Existing customer/writer secrets must not be copied here to satisfy comparisons or defaults.
- `NIGHT_SCOUT_DEMO_BOOTSTRAP_DATABASE_URL`: verified TLS session-pooler URL for **only** `night_scout_demo_bootstrap_login`; never administrator/import/writer credentials. Port5432, fixed project pooler, no query parameters. `NIGHT_SCOUT_DEMO_STAGING_CA_PEM` is the trusted public CA PEM, not a secret/private key.
- `NIGHT_SCOUT_DEMO_READER_ENVELOPE_MASTER_KEY`/`ENVELOPE_KEY_VERSION`: a new independent demo-reader encryption key/version. The separate future demo worker will use that same demo key, not any original-reader/writer key. Secret creation/entry remains owner-operated. The AAD includes the new fixed demo store, connection, tenant and key version and rejects the original/writer envelope context.

Do not link shared Render environment groups, expose the private demo schema or add broad table privileges. The bootstrap login has only the proposed fixed RPC capability through its SET-only service role. The transaction-local receipt records a fresh actual API observation; SQL cannot independently prove that an operator forged no API observation, so the trusted scoped runtime and source verification are necessary together.

The separate worker/schedule, exact SQL application, real app consent and current trial budget/activation remain root-owned approval gates. No generation flag exists in this consent server. Local tests do not certify Xero-wide security compliance, provider permission, merchant onboarding or the working production/customer feed.

## Checks

```sh
node --test experiments/xero-demo/*.test.mjs experiments/test-programme/operator-owner-page.test.mjs
```

Tests cover real inline owner-page behavior, source/identity separation, fresh member-only gates before all authenticated phases and final SQL refusal after revocation, two fresh consents, safe discovery/mapping, first-day/DST scope, source changes, state expiry/replay/owner binding, low/forged assurance refusal, role broadening rollback, fixed request/schema boundaries, empty redirects, dependency graph/lock tamper and output protection. Database proposal tests are owned by its separate SQL package; actual database application/roles and real provider calls are not claimed by these tests.
