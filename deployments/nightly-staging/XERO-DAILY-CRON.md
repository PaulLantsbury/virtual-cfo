# Proposed London daily Xero cron gate

Prepared code only: this file does not activate or alter any Render service.

Use command `node deployments/nightly-staging/run-xero-daily-cron.mjs` with the Render UTC cron expression `0 1,2 * * *` after the coordinator verifies and authorises the existing staging target and configuration.

Both UTC candidates are scheduled because London changes between GMT and BST. The wrapper dispatches only during **02:00–02:14:59 Europe/London**, using the actual process clock; the other candidate writes safe skip metadata before importing the existing refresh runner. On both the March and October clock-change dates only one of the two UTC candidates reaches that London window. No environment clock override exists.

The scheduled CLI additionally refuses any period mode other than `daily_completed_period` before importing the collector. Fixed-date modes remain available only through their separately authorised manual paths.

The existing manual `run-xero-refresh.mjs` command is unchanged. Once admitted, it retains its current enabled/configuration, month-boundary scope planning, empty-period behavior and durable job reservation checks. The gate itself is not a lock or proof of successful collection: duplicate launches inside the window still rely on those durable guards. It does not compensate for a missed trigger, retry failed scopes or change provider permissions.

Run the isolated tests with `node --test deployments/nightly-staging/xero-cron-window.test.mjs`. Do not execute the new CLI as a readiness probe inside the admitted window: it is a real collection entry point when enabled.
