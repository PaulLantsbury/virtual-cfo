# Fixed private provider host amendment — 26 November 2026

Prepared on Month/Growth candidate `4265efb2a66ce161b7e79bae5890cc5871f5c4f6`.

Integration/PM reported the approved private staging service `srv-dc46b5l9el5s73abpnc0` live on provider source `d73a2776ff1abf766edb905c8ed3ae2c96a40ed4`, with internal address `night-scout-provider-api-staging:10000`, Frankfurt, manual deployment and provider controls off. This amendment uses that reported identity; it does not independently attest service reachability or current settings.

The only permitted provider origin is now `http://night-scout-provider-api-staging:10000`. HTTP matches the private service's plain HTTP entry point. The startup constant, declaration and shared allowlist use this exact origin. Environment variables cannot substitute another target. Existing request, response, credential, path, timeout and size restrictions remain unchanged.

Binding an address does not activate the proxy. Explicit runtime enablement remains required, and no live setting is changed by this source amendment. Owner mode and finite fictional canary mode remain mutually exclusive. The canary requires a valid short expiry; report-only website startup continues rejecting private-provider credentials. Report routes remain outside owner forwarding.

Month selection, Growth history, provider Settings, customer boundaries and all frontend files remain byte-identical to the parent candidate. No customer activity feature or CFO engine is added here. The earlier unbound-host documentation describes historical source snapshots and is superseded only for the fixed target by this amendment.

Validation uses fictional inputs, mocked forwarding and local application composition. It makes no request to the private service and supplies no production credentials. Publication, website deployment and proxy activation are separate actions owned by integration and are not performed by this amendment.
