# Synthetic company staging deployment proposal — 5 November 2026

Status: prepared only. No hosted configuration, deployment, database, membership, provider transaction or scheduler change has been made by this proposal.

Use the existing staging web service after local package acceptance. Publish the reviewed package to the isolated synthetic-company branch, then record and approve one immutable commit SHA; never deploy the moving restart baseline merely because it is configured on the service. Keep provider cron/helper sources unchanged. The web service's currently observed automatic deployment is off. Do not change it as part of the package.

The live web deployment observed read-only on 5 November remains commit `1796511d4f2545917be21d1f70f9adffe7514c17` from 15 October. This is the candidate application rollback revision, subject to retained artifact availability and database compatibility at execution time. A deployment rollback restores application code only; it does not undo seeded records, grants, provider effects or changed configuration.

Before approval, attach the candidate commit, local test receipts, exact isolated-store package manifest and hashes, inspected schema preflight, allowed/denied authenticated read results, unrelated-store fingerprints and scoped rollback plan. Retain private target/reviewer and connector-sensitive operational details outside public repository documents. A local database rehearsal is not a hosted preflight result.

The concrete user approval should cover only: applying the reviewed synthetic-company data package once to staging, its exact existing reviewer binding if needed, and manually deploying the named web commit to the existing staging service. Database application, membership/access and web deployment are distinct actions; list each one explicitly. No provider writes, catch-up, scheduler activation, new infrastructure, production release or merge is included.

After approval, verify exact target and package digest immediately before application. Inspect commit outcome before any replay. Observe the manually selected deployment until terminal live status, then verify health, signed-in store access, canonical scoped metrics, freshness/period metadata, charts and Explore the Numbers links in the actual hosted UI. Confirm non-member denial and unchanged unrelated companies. Withhold unsupported pages and periods honestly. If application fails or is uncertain, inspect receipts; never retry blindly.

Execution remains blocked until an executable writer package passes independent disposable-database rehearsal, live schema compatibility is demonstrated and the immutable candidate is identified. This document supplies no approval or automatic execution instruction.
