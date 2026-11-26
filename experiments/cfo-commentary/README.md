# Offline CFO evidence and commentary prototype

**Fictional data; deterministic rules; no ChatGPT service connected.** This isolated experiment imports the existing shared financial calculator. It is not mounted by the application or API and makes no model, provider or network calls. No keys, spending, actions or deployment are involved.

From the repository root:

```sh
node experiments/cfo-commentary/generate-examples.mjs
node --test experiments/cfo-commentary/evidence-packet.test.mjs
```

The generator writes reproducible `generated/examples.json` and `generated/sample-briefings.md`. The fixed review date is 26 November 2026; the current completed month is October, with September as comparator. All company, source and balance facts are explicitly fictional. The JSON includes 13 scenarios and four whitelisted questions each.

`createEvidencePacket(rawInput, request)` validates scope and provenance, delegates financial amounts to `calculateProfitEvidence`, snapshots and freezes the packet. `renderNarrative(packet, questionId)` accepts only a packet created in this process and a bounded question ID. `validateNarrative(packet, narrative)` compares the complete canonical rendering; invented statements, numbers or references fail. The declaration files expose readonly, opaque packet types; `contract.test.mts` contains strict compile-only misuse checks.

Each monetary claim identifies both its computed metric and exact content-addressed source input. JSON pointers inside narratives are relative to their containing packet; generated Markdown expands them to full `examples.json#/N/packet/...` references. Digests establish internal content coherence, **not** genuine source completeness, financial review or access authorization. The fixture `access` field simulates a trusted reader decision; it is not an authentication implementation. No arbitrary source memo is interpreted as a command or included in narrative prose.

Missing costs preserve independently supported earlier subtotals. Zero and negative values remain valid. Same-scope stale values retain their dates and warning, but no current comparison, cash claim or spending advice is generated. Denied, invalidated and mismatched scopes contain no old source snapshots or amounts. Unknown/mismatched comparison evidence cannot erase independently supported current results. Cash balances remain separate from profit; absent burn history withholds runway. No output asserts causality, upside, rankings or executable recommendations.

The precise product contract and unresolved future model decisions are in `docs/cfo-commentary-offline-2026-11-26.md`. A future model adapter requires its own data-processing, retention, budget, activation and evaluation decision; this prototype does not authorize one. Current Scout and all provider sources remain unchanged.
