# Comparison reset — separate bounded investigation

Status: source investigation and disposable controller experiment, not a confirmed diagnosis of the observed live reset. Receipt21e5112 records one broader multi-tab reset, a passing controlled page-tab change and uncertified cross-tab persistence. No shared selection/auth/storage implementation changes are made.

## Distinct lifetimes
- Marketing GrowthWorkspace owns priorHistory and current selections; acquisition/conversion/retention use setTab and preserve the parent workspace. Controlled page-subtab transitions should retain those parent choices.
- Chart child components can unmount when page subtabs change. Their own reference-view state can reset independently; do not mistake that for loss of the selected comparison month/version.
- useReviewedHistory temporarily withholds selection/figures while availability is rechecked. Record final settled select values to distinguish loading from actual local-choice loss.
- AuthProvider's visibilitychange-to-visible path clears access, then revalidates the same session. Auth state events also clear before accepting a session. sessionAccess resets cache and increments revision; StoreAccessGate removes non-ready children and keys ready children by revision. This can remount Marketing even for the same verified business. The manually chosen comparison has no cross-mount persistence contract; URL current context may revalidate while comparison remains blank.
- Actual user/company changes intentionally reset protected evidence. Returning to an old company must not replay stale URL selection; the existing ownership guard stays intact. Fresh browser tabs/reload also create a new local lifetime; no shared comparison persistence is currently certified.

## Disposable same-identity mechanism check
Ran the actual unchanged createSessionAccess with fictional identity, fixed clock and mocked verify/membership/cache ports, without a provider/browser session. Initial setSession reached ready/revision1. Explicit clear (the visibility recheck pattern) produced signed-out/revision2, then the identical session returned ready/revision3; same identity/business,3cache clears. Assertion passed. Combined with StoreAccessGate's revision key, this demonstrates a possible remount mechanism; it does not prove the specific historical event sequence or establish a new product persistence contract.

## Next bounded reproduction (separate work)
1. Select exact current/prior versions; cycle acquisition→conversion→retention→acquisition in one browser tab, wait for reads to settle, record parent selectors separately from child chart reference controls.
2. With the same choices, switch browser tabs/windows and return without navigation. In a disposable fixture record visibility events, auth event names, access status/revision and cache clears; compare settled selections after access becomes ready.
3. Trigger a same-identity auth recheck as a control. Correlate unmount/revision with actual comparison reset before naming the cause. Do not weaken access clearing or keep previously authorised figures visible while membership is unverified.
4. Change company A→B→A: expected safe reset/no stale replay remains required. Separately test reload/new browser tab; neither should be represented as previously certified persistence.

No decision about shared selection storage is requested by this investigation. Prepare a narrow proposal only after reproduction, preserving the existing member-bound selection/read contracts and source-version invalidation. No live settings, provider, DB, feed or deployment operations occurred.
