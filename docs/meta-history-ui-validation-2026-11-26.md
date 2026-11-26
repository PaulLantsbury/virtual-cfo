# Unmounted Meta saved-history consumer validation — 26 November 2026

The follow-on is separate from frozen website package 28853bb. Inputs are static fictional records. No route mounts the component, no fetch/storage/provider runtime was added, and no deployment or provider action occurred. The offline composition proposal was read directly from the integration checkout and pinned at SHA-256 `43427425b25705d7bcad87fb8c3b595c3f9fe1d35437150715592171904b2a09`. The follow-on subsequently added the requested pure adapter for the actual additive producer envelope. Its source is `experiments/marketing/meta-spend-report-contract.mjs`, pinned at SHA-256 `251d65fd8f6aeabeb339399e289ecae430cb043d3677b249abb862402eff0fb9`. The runtime wire permits observationFreshness=unknown only; composition examples can also represent independently supplied stale/current evidence. No mounted route or request path is added.

## Independent checks

Twenty composition-consumer Node tests pass: current and expired access preserve original dates, integer-minor-unit amounts, run identifiers and observation instants; freshness is independent of access; revoked membership and each of store/account/connection/from/to/version mismatch withhold all rows. Disconnected, superseded and unknown/revoked connection states withhold. Missing or mismatched currency/timezone context withholds. Unknown days remain null and all-unknown evidence has no subtotal. Reported zero remains distinct from unknown; a large amount above Number's safe integer range remains exact. Missing/duplicate/out-of-window days, invalid timestamps and amounts, accessors and enum coercion objects fail closed. No getters or coercion hooks execute.

Five isolated headless browser cases use 390px and 1440px viewports. They verify expiry changes the access label while daily rows remain identical, missing values display Unknown, partial totals are labelled incomplete, denied selections expose no table or amount, and all-unknown periods never become zero totals. Every remote/API request is blocked and final runs assert none was attempted. Keyboard focus and actual ArrowRight narrow-table scrolling are checked. The fifth browser case renders the unmounted exact-wire wrapper through current/expired, not_connected, revoked membership, wrong account and all-unknown inputs. The fixture has its own local-only styles and is not a mounted product route.

The initial fixture imported the application's shared stylesheet, which attempted an external font request; the request was blocked and the test correctly failed. The fixture now imports local test styles, with no external fonts. Initial visual inspection exposed compressed mobile table columns; the component's existing scroll region was corrected with a minimum table width and normal wrapping. Refreshed desktop/mobile screenshots are inspected after the correction.

Receipts and fictional screenshots are under `work/meta-history-ui-20261126-evidence/`: unit-tests.log, browser-tests.log, meta-history-390.png, meta-history-1440.png. These prove offline consumer behavior only, not hosted membership, runtime API coherence, token renewal, Meta dated totals, freshness policy or an installed history reader.

Commands from repository root use Node 24.22.3:

```sh
node --test artifacts/virtual-cfo/tests/meta-history-consumer.test.ts artifacts/virtual-cfo/tests/meta-history-wire.test.ts
NIGHT_SCOUT_TEST_URL=http://127.0.0.1:5191 NIGHT_SCOUT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' NIGHT_SCOUT_PLAYWRIGHT_MODULE='<bundled-playwright>/index.mjs' node --test artifacts/virtual-cfo/tests/meta-history-browser.mjs
```

The separate Vite preview serves loopback only with fictional configuration. No existing website checkout or old dirty checkout was modified by this test lane.

## Actual wire adapter and producer agreement

Eight additional adapter tests pass (28 Node tests total). They check authoritative account currency/timezone, exact lineage matching, current/expired continuity with unknown freshness, unavailable evidence, each original coverage type, rejection of invented freshness and malformed account/connection/digest/run metadata. `sourceDays` preserves exact coverageState, spendMinor, observedAt, runId, runStatus and runStartedAt. No provider-row absence is converted to zero.

The separate `meta-history-producer-agreement.mjs` invocation requires an explicit local module path and SHA-256; it checks the hash before importing the pure producer parser. Four fixtures pass through both actual producer parser and adapter: current, expired, not_connected and all-unknown. Receipt: producer-agreement.log (4 passed, zero failed/skipped). This validates shared shape/semantics at the recorded producer revision, not API/database deployment or cryptographic authority. The digest is matched, not recalculated as evidence of authorization.

Final totals are separate scopes: 28 consumer/adapter units; 5 browser cases; 4 producer/consumer agreement cases, all passed without skips. Browser screenshots show the composition fixture; the exact-wire wrapper also passed browser checks. The local preview was stopped after testing.

## Final application source hashes

- `artifacts/virtual-cfo/src/lib/metaHistoryPresentation.ts`: SHA-256 `1f0697cf06b39cde0d01d282b259536b49b7d499f76b5d847720a474b2d19405`
- `artifacts/virtual-cfo/src/lib/metaHistoryWire.ts`: SHA-256 `9ad80194a991f24353dc152cc9501e466c89fc1bae57c06e2ecbec8372ef7702`
- `artifacts/virtual-cfo/src/components/MetaSavedHistory.tsx`: SHA-256 `53156e21490befa4b23b46dd38b6f766c7ff577e3f73e5dfaf0c4fa29a72a616`
