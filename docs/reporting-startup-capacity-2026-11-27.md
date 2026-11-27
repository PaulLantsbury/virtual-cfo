# Reporting startup capacity — 27 November2026

## Confirmed cause and current status

The replacement website was refused new reporting-database connections at the exact startup-failure times. This is confirmed by correlated database/pooler logs, rather than inferred from a generic application error. The existing website remained available because its existing connections continued working.

Startup code, dependency lock, TLS and connection settings were identical between the working and failed releases; the weekly calculations had not started at the failing stage. A restrictive reporting-login connection ceiling did not accommodate the old and replacement website pools overlapping during deployment. Operational identities, exact database settings and application SQL remain in the private reviewed package.

The working compact-controls website remains live at016beeea1e30d63cc87eda5512666533f63918d3. The weekly amendment9131d38356caee652e9b7a68df3a0f97fde6aafe is published but its failed startup did not establish hosted weekly acceptance. No live setting, credential, grant or service has been changed by this investigation.

## Minimal proposed remedy

Allow bounded connection capacity for one existing website process and one replacement, preserving each application's existing pool maximum. Change only the identified reporting login's connection limit after exact expected-state checks; verify other role attributes are unchanged before committing. Keep the modest overlap allowance for future rolling deployments. Do not change global connection settings, grant data access, rotate credentials, weaken TLS, change timeouts, terminate sessions or upgrade plans.

Recognize PostgreSQL's connection-limit error in the existing safe diagnostic allowlists. Unknown errors remain masked; no raw messages, account settings or credentials are logged. No automatic reconnect/retry behavior is added. This source amendment leaves reporting calculations unchanged.

## Independent verification

Eleven startup/runtime checks pass, including the installed connection-pool driver's propagation of the fixed connection-limit code and masking of private lookalike messages. Four disposable database cases validate the guarded capacity adjustment: correct expected state succeeds; changed limit, inheritance or expiry refuses without applying it. Full workspace typechecks and all constituent builds pass; existing build warnings remain.

The earlier weekly amendment's focused financial/browser checks are preserved. They are not a substitute for the real hosted startup and weekly gates.

## Required approval and release gate

Review the exact private capacity adjustment and exact new source before applying either. The current website stays untouched until approved. Apply only the expected restricted-login capacity change; stop on drift or insufficient existing administrator authority, without adding permissions. Publish/deploy only the approved source, one release at a time.

First require hosted startup and health. Then verify28September–4October2026 inWeekly view through the authorized synthetic-company session, followed by cash/timing, five-page navigation, multi-month and partial Custom checks. If the website fails, retain or restore the prior confirmed website and stop. The separately approved overlap allowance remains bounded and does not imply authority for further settings or deployment retries.

The earlier weekly request failure and this later startup refusal are distinct observations. The startup cause is now established; weekly reporting still needs successful live acceptance.

## Stopping point

The investigation and independent review are complete. No further workstream or unattended batch is scheduled. Next session begins with this precise approval, then hosted verification and the owner's five-page design review. ChatGPT wording and provider acceptance remain later, separately scoped milestones. Keep the operational package private and routine product status in the shared roadmap/handover.
