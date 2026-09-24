# Staging Xero connection-bound bootstrap follow-up

Status: prepared and executable-database tested; staging-only application requires the migration owner.

The applied bootstrap RPC generated its connection UUID after the host had to encrypt the retained refresh credential. Because the credential envelope authenticates `connection ID + tenant ID + key version`, that order cannot produce an envelope the scheduled worker can later decrypt.

`20260924_bind_xero_bootstrap_connection_id.sql` replaces only the bootstrap RPC signature. The trusted staging host must generate a random UUID first, encrypt using that exact UUID and canonical tenant/key version, then pass the UUID and envelope into the same atomic bootstrap transaction. The old signature is removed so it cannot create unbound envelopes.

The same follow-up adds two read-only, worker-only RPCs. `worker_get_refresh_context` returns one exact active connection, encrypted envelope and its persisted mapping selections. `worker_get_latest_supported_evidence` returns only the latest supported row for an exact connection, mapping, scope, currency and closed-period tuple. The lease RPC atomically acquires a 30–300 second refresh lease and returns its exact expiry as a fencing token. The token is truncated to milliseconds so it round-trips exactly through node-postgres `Date` values. Release requires the same connection, credential version and expiry token, so an expired runner cannot clear a newer runner's lease. A new leased rotation RPC likewise requires the exact unexpired fencing token and current version, advances exactly one version and clears the lease atomically. Worker execution of the older unfenced rotation RPC is revoked.

None of the new RPCs grants table access or accepts a caller-selected relation. The worker now derives the operative mapping from persisted state and requires the configured mapping to match it exactly, rather than trusting configuration alone. It can retain stale evidence only from the exact persisted scope.

Apply only in Night Scout Staging (`bioalckltvkhlczusdvl`), then run `verify-xero-connection-bound-bootstrap-2026-09-24.sql`. Expected: old bootstrap signature absent; new signature present; bootstrap has exactly one Xero routine grant; worker has the bounded evidence/failure RPCs, two readers, two fenced lease RPCs and leased rotation; the older unfenced rotation grant is absent; neither login has Xero table grants; memberships are unchanged.
