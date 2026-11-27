# Compact shared reporting dates — 27 November 2026

Status: implemented/tested locally, release pending. Source `016beeea1e30d63cc87eda5512666533f63918d3`; proposed publication branch `codex/compact-date-controls-20261127`.

## Approved interaction
One quieter compact panel uses the existing Night Scout design. Period buttons: Last week, Last month, 3 months, 6 months, 12 months and Custom. Amounts, View and Compare sit in the smaller second row. The page/CFO headline has visual priority. All five pages share the same selections; changing them on any page updates the others.

Presets show their resolved dates without an Ending month picker. Resolve dates using Europe/London today, never the device timezone or newest available evidence. Last week is the last complete Monday–Sunday week; a Sunday in progress is not complete. Last month is the previous complete calendar month. Monthly 3/6/12 presets use those complete months ending before the current month; weekly view uses13/26/52 complete weeks ending at the last completed Sunday. Never silently substitute an older available report when the requested one is absent.

Custom reveals native From/To inputs and Apply dates. Choosing Custom starts from the current resolved range. Editing fields remains a draft until Apply. Require real calendar dates, start on/before end, and no future date. The exact inclusive range is shared. Saved legacy month choices become equivalent full-month Custom ranges; newly saved presets remain relative to the clock. Preferences are scoped by user and company and contain no financial records or evidence authority.

## Reporting limits
The current primary source adapters accept one complete calendar month. A Custom range matching that month exactly, with monthly view, uses its separately authenticated/current verified source. Partial Custom ranges, weekly reporting and multi-month totals remain unsupported and show dashes; source coverage is not inferred from date selection. Plan has its separately labelled three-month baseline and future horizon; it cannot read beyond a partial selected ending date. This UI release does not activate the prepared weekly cost allocator or create new data/permissions.

## Acceptance and release
35 focused checks and17 unique browser cases passed across full/targeted runs, including shared choices/reverse updates/reload, company/account separation, invalid dates, partial-range refusal, no stale monthly values, Plan pending/disabled behavior, financial reconciliation and1440/390px layout. Full constituent workspace typechecks/builds passed. These are local fixtures, not hosted acceptance.

Requested release: publish the exact source to the proposed branch, confirm staging still matches the recorded parent (or reconcile newer work), deploy to the existing staging website, verify signed in and restore the previous website if acceptance fails. No new settings, database writes/grants, provider actions, daily-feed changes, model calls, production change, new service or spending.
