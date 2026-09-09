# Staging test checkpoint — 9 September 2026

The local preview is connected to Night Scout Staging. The user completed account confirmation and sign-in. Before assignment, the app correctly showed no store access.

With approval, created empty Test Store A and Test Store B and assigned the test account to A only. The preview restored the session and displayed Store A only. The empty briefing showed No trading data found.

Direct API isolation and further account/session tests remain pending. This is a staging checkpoint, not production readiness. The original database and Replit application remain unchanged.

## Direct staging requests

Using the existing signed-in session and the application's Supabase SDK, four read-only gateway checks passed: Store A by ID returned one row; Store B by ID returned none; an unfiltered store request returned A only; memberships returned A only. All returned HTTP 200 with the expected filtered results. No session tokens or credentials were exported.

The gross-revenue RPC returned zero for both empty stores. That is inconclusive for financial-row isolation; distinct synthetic transactions are needed before claiming that check passes. No business records or permissions were changed during these checks. The temporary local diagnostic page was removed afterward.

## Distinct synthetic transactions

With approval, inserted one clearly labelled TEST-ISOLATION order into each staging store, dated 15 August 2026: A GBP 123 and B GBP 987. Both have zero tax, shipping, discounts and refunds. These are access-test fixtures, not a comprehensive financial acceptance dataset. Administrator read-back confirmed both records. They remain in staging; the original database is unchanged.

Five real-session gateway checks passed: A direct orders returned one row totalling 123; A gross_revenue returned 123; B direct orders returned no rows; B gross_revenue returned zero despite its stored 987; an unfiltered orders query returned only A. HTTP status was 200 throughout, consistent with filtered results. This replaces the earlier inconclusive empty-store RPC check for gross_revenue only. Other functions, second-user tests, writes, expiry, revocation and logout remain pending. No credentials were exported, and the temporary diagnostic page was removed.
