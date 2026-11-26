# Independent provider source review — 26 November 2026

Reviewed actual public-ancestry candidate based on `3187ce39fda8e3ec66710c58c2a70952efcf0d34`, including coordinator's subsequent parser/runtime hardening. No source edits by this reviewer; this document is the only review write. Final candidate identity and full suite/build belong to the coordinator and validation receipt.

## Ancestry and preservation

The integration commit has direct parent public cloud `6cc5c542929dadedaa3a7633a6937160d4b16880` and full tree `d4afaad987cf8b1db46d6b9c54eb96333951b885`, exactly equal to recovery documentation tip `fea71fcccdebe7e094d23f28fb57b51cb37ab673` before hardening. Cloud-tested `c8b04003` and live cleanup source `204226d` are ancestors. The new repository was dissociated after cloning; full Git integrity check passed, no object alternates or hardlinks remain. No public write occurred.

Original mixed v11 remains at `9c4c66f2`, with 17 modified tracked files and 94 untracked entries; all 65 original capsule hashes remain equal. Recovery remains clean at `fea71fc`. Review did not change either checkout.

Relative to the public cloud baseline, the only modified preexisting paths are `artifacts/api-server/src/app.ts` and `artifacts/api-server/src/index.ts`, limited to provider composition. No preexisting shared UI, navigation, hook, financial definition, synthetic-data or feed source changed. Recovered provider components/helpers are new, and the components remain unmounted. No design/data lane source was imported from the separate pages adapter.

## Hardening review

- Connection state now requires exact string enum values. An object coercible to `current` or `expired` is denied rather than accepted and forwarded.
- Timestamp validation checks the calendar day before parsing, constrains clock components to 00–23/00–59/00–59, and bounds offsets to 14:00. Invalid leap dates, 24:00 rollover and excessive offsets are denied. Valid UTC, bounded offsets and one-to-six fractional digits remain accepted.
- Records require plain own enumerable data properties; symbol/accessor/hidden property forms are denied without reading getters. Day arrays require their ordinary prototype, dense data indices and no extra named/symbol properties. Existing exact-key and chronology requirements remain intact.
- The runtime uses the same timestamp predicate for string observations/run starts and exact six-digit selection instants, preventing invalid strings from being normalized before the wire parser sees them. PostgreSQL Date objects remain supported with a finite-date check.
- The precise declaration adds only the new predicate export; no typecheck exemption, `any`, response-field widening or financial calculation change was introduced.
- Default-off startup remains unchanged: disabled constructors do not read private configuration, collectors are absent from web startup, and failures close opened runtimes with generic errors.

Reviewed hashes:

| File | SHA-256 |
| --- | --- |
| meta-spend-report-contract.mjs | d4105763bb861616e4c6836fc25bc61662e851572d7c6800f17af4905fcdee86 |
| meta-spend-report-contract.d.mts | e4b0b1d3bd46a27ede3195c753bda9bada2eaa92804eec2482691995bd18c08e |
| meta-ads-report-runtime.mjs | 41a33ac17806138c269a71d48ad0e2bb39d4008370e35c0dc7af0d8178fbb5b8 |

## Independent execution and pages compatibility

Executed six focused wire/startup tests successfully. Separately imported the real pages adapter and fixtures at its frozen `2a557ea` checkpoint read-only; four current/expired/disconnected/all-unknown fixtures agree with the hardened producer. Saved source days and unknowns remain intact, disconnected evidence remains withheld, and all-unknown history stays unavailable. Additional timestamp edge assertions passed for a valid leap date, microseconds and bounded offsets, and rejected invalid leap dates, 24:00, +14:01 and +15:00. These are bounded overlapping checks, not an additional full-suite count.

The pages adapter preserves exact lineage, currency/timezone and original days, requires trusted membership and explicit display context, and uses the same strict timestamp shape for accepted source rows. Its model remains unmounted. No live authorization or provider request was used in this agreement check.

## Disposition

No additional source blocker found. Hardening narrows malformed inputs without changing valid reviewed wire semantics. Source publication remains distinct from hosted activation. Hosted roles/signatures, telemetry, exact combined page mounting and real-provider acceptance are not certified by this review.
