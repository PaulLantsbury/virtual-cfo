# Independent Xero/Google contract review — 26 November 2026

Reviewed follow-on source changes after frozen provider8472f21. No production edit was made by this reviewer. No live provider/database/hosted/feed/secret/log action occurred. Root owns final source identity and combined validation; these are source/disposable checks, not customer acceptance.

## Xero mapping instant boundary

No additional blocker found. The new pure mapping-instant.mjs predicate requires a complete explicit-zone instant, valid calendar date, bounded clock/offset fields and at most six fractional digits. It rejects date-only/local timestamp and rollover inputs before Date.parse can normalise them. The precise declaration matches its boolean string guard.

mapping-version-contract and mapping-api-contract change only their timestamp predicate/import. Version/store/tenant/member identifiers, mapping definitions, readiness, exact-key behaviour and output shapes remain unchanged; accepted confirmation strings are preserved exactly rather than converted. saved-mapping-view retains its existing additional UTC-only and maximum-three-fractional-digit regex, so the shared helper does not silently widen that wire. There is no credential/provider operation, financial calculation or scope broadening.

New boundary tests cover invalid calendar/leap dates,24:00, local/date-only values, excessive offsets, preserved valid leap dates, offsets/microseconds and the narrower saved-view rule. Root's reproduced predecessor failure is retained in its receipt; this reviewer did not rerun an unchanged predecessor.

Full required Xero domain freshly executed from this follow-on checkout:

```sh
node --experimental-strip-types --test --test-concurrency=1 --test-timeout=300000 experiments/xero/*.test.mjs
```

Result: **324/324 passed**, zero failed/skipped/cancelled;75.46 seconds. Node24.22.3. Local log `/tmp/night-scout-xero-followon-domain.log`. This includes mocks/disposable database fixtures and the new three boundary cases; it does not establish real OAuth/reconnect/mapping/tenant/period acceptance.

## Google report authority and provenance

No additional blocker found in the inspected route, repository, strict timestamp helper/declaration, read-SQL delta and new tests. The timestamp predicate is shared by route and repository so invalid source strings cannot be repaired into plausible provenance before serialization. Valid explicit-zone/fractional timestamps remain accepted; no amount conversion or new provider operation is introduced.

The SQL now chooses the newest selected account across the store before applying owner/status eligibility. Only a unique latest selection can expose evidence. Revoked/disconnected/wrong-owner or ambiguous latest authority yields the disconnected sentinel rather than falling back to older retained history. Reauthorization-required exact selection can retain history; connected selection requires active status. The existing membership check and exact account/connection/store/day joins remain intact.

The new disposable authority test loads the exact three Google proposals, calls the real report function as the report login and exercises disconnected/revoked latest selection, newer owner, tied selection, exact expired history, different period, denied other user and removed membership. It is meaningful SQL-path coverage rather than a duplicate mock of the filtering logic. Root is executing the broader Google/provider suite; this reviewer did not duplicate that run.

These fixes tighten malformed input and unsafe fallback. They do not certify live role grants, provider history availability, current API access or hosting telemetry. Separate exact hosted approvals and current-source/role evidence remain necessary.
