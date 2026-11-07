# Existing Demo reader reconnect package

Source preparation only. This additive package is separate from initial bootstrap. Apply the exact reviewed `db-migrations/proposals/xero-demo-reauthorization-2026-10-30.sql` only after its concrete database-change approval. It grants two narrow RPCs to the existing isolated Demo bootstrap service; no other role gains access. Do not reapply the original Demo schema, delete an existing connection, change the tenant pin, reset the Demo Company or copy another reader/writer credential.

## Before owner consent

1. Verify the current isolated reader preflight is a current-version `failed / connection / reconnect_required` observation. Inspect the reader app's actual provider connection management separately. A token refresh or browser accounting session does not establish app-to-tenant access.
2. Preserve the existing connection, account mapping, imported evidence and credential audit. Check the current envelope version and idle lease without retrieving its plaintext or ciphertext. Do not repeatedly retry a missing provider connection.
3. Review/apply the additive SQL once in the verified staging database. Both RPCs enforce the existing fixed Demo store, sole current owner membership, exact existing connection and tenant, current mapping, idle lease, current credential version, unambiguous failure from the last hour, and original fixed trial deadline.
4. Publish the tested consent source and confirm its isolated deployment. Set `NIGHT_SCOUT_DEMO_READER_REAUTHORIZE_ENABLED=true` only on the existing Demo consent host. Existing bootstrap enablement is still required. Keep writer generation off.

## Reconnect and verify

The owner signs in and verifies the existing authenticator on the Demo consent page, then selects **Reconnect existing Demo reader**. This starts a fresh full read-only consent using the dedicated existing Demo reader app. The OAuth state pins the existing connection/tenant/version/mapping for at most ten minutes. It cannot select another company or edit mappings.

Callback requires the exact pinned provider tenant to be accessible, actual `IsDemoCompany=true` and GBP, the unchanged read-only scope set, and every saved mapped account still active with the correct type. Only then is the new reader token encrypted with the existing connection's AAD and key version. The fenced RPC increments only the existing envelope version and appends a credential-rotation audit. It does not create a connection or replace mappings, financial evidence, previous failed health or schedules. A changed version/mapping, held lease, revoked owner, replay, expired state, ambiguous failure, different company or invalid source facts fails closed.

The clean return page is a consent receipt, **not** reader health. Run the isolated reader preflight once using actual time, then the full independent reader gate and metadata readiness. Confirm the expected version increment, idle lease, fresh current-version connected health, preserved saved accounting scope and unchanged mapping/evidence. Turn the reconnect opt-in off after acceptance. Initial bootstrap remains the default when this flag is absent or false.

No test transaction is created by reconnect. Final writer acceptance still requires actual scheduled provider action, durable confirmed action and subsequent matching-tenant automatic accounting import. The reader does not claim exact invoice linkage or receivables reporting from its aggregate fields. Do not extend the original trial or use manual/fake-time generation to replace a missed action.
