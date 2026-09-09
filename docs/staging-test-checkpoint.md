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

## Extended read and session checks

Eight further gateway checks passed with the real staging session: order_count, net_sales and average_order_value returned A's expected 1/123/123 and zero for B; a separate non-persistent anonymous client was denied orders and gross_revenue with HTTP 401 and database code 42501. No stored user session was exported. These fixtures do not certify AOV/refund financial definitions.

A fresh dashboard restored Store A and displayed August 2026 sales/AOV of GBP 123 with no previous-period comparison. Real sign-out removed merchant content, and a new dashboard page remained gated behind sign-in. The user must sign in again to continue. Diagnostic page removed. No additional database or permission changes. Second-user tests, token expiry, revocation, client-write denial and other financial functions remain pending.

## Re-login and read-only write check

The user signed back in successfully and the dashboard showed Store A. A same-value update probe against its verified synthetic order was refused with HTTP 403 / 42501. Read-back confirmed gross_sales remained 123. This verifies UPDATE denial on orders only; other write operations are not claimed tested. Diagnostic removed. Next: user-assisted second-account setup for independent-user isolation and account switching; expiry and revocation remain pending.

## Signup confirmation screen

Fixed the repeated-registration impression reported after signup: a successful confirmation-required response replaces the registration form and submit button with a Check your email message and sign-in link. Error responses retain the form. The local staging preview includes this change; Replit/main are not deployed. Type checking and all five mocked authentication browser groups pass, including assertions that the registration button and email field disappear after success. The user reports the second confirmed account reaches the expected no-store gate; its membership has not yet been assigned.

## Second-account Store B verification

Following the instruction to continue with Store B assignment, linked the second confirmed staging account to B only. A guarded transaction checked the confirmed account, synthetic store identity and absence of existing memberships. First-account membership was unchanged.

Thirteen real-session checks passed: unfiltered stores, orders and memberships returned only B; direct A orders returned none and four A RPCs (gross_revenue, net_sales, average_order_value, order_count) returned zero; direct B orders returned its 987 sample, the three monetary RPCs returned 987 and order_count returned one. The restored dashboard showed only Store B and GBP 987. Together with the earlier A-session checks this establishes the tested read paths in both directions. No user IDs or credentials are recorded here. Temporary diagnostic removed.

Still pending: other functions/views with distinct fixtures, membership revocation, token expiry, broader write tests and production readiness. Financial definitions remain a separate implementation task. Nothing was deployed to Replit or the original database.
