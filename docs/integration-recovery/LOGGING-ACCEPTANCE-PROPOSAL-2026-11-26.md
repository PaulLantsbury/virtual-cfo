# Engineering logging acceptance proposal

Prepared offline; no diagnostic host, endpoint, configuration or canary was deployed. This is the exact remaining evidence task for later separately approved hosted work, not an owner questionnaire.

| Layer | Required safe evidence | Synthetic check |
| --- | --- | --- |
| Ingress/platform HTTP request logs | Capture enabled/disabled, path/query treatment, retention/access/export policy without private values | Fictional query sentinel on a harmless controlled callback-shaped path; verify query absent/redacted at all enabled sinks |
| Application request/error logger | Projection/redaction source and executed regression | Query, Authorization and poisoned-error sentinel; retain method/path/status only |
| Injected HTTP/APM/proxy instrumentation | Safe inventory of agents/proxies and capture settings | Outbound GET URL query, POST body, Authorization, response/error payload sentinel sent only to a team-controlled dummy endpoint |
| Log forwarding/export | Safe enabled-destination inventory and redaction position | Check same synthetic correlation receipt downstream; no private log dump |

Use no real app secret, authorization code, state, provider token, database password, customer identifier or account binding. The controlled endpoint must not forward requests to Meta/Google. Obtain a concrete approval for the exact target/source, harmless requests, allowed safe configuration read and log-sink checks; do not revive any expired diagnostic. Fail closed if a sink cannot be observed or its treatment cannot be established. A successful application-only test cannot close other rows.

Acceptance receipt records source revision, UTC instant, sink classes, test-field classes, pass/fail and immediate cleanup/removal. Store no raw sentinel/request payload in public artifacts. Remove any temporary endpoint/configuration and verify ordinary disabled runtime after the approved observation. If this cannot be evidenced on the current platform, return a scoped alternative hosting/ingress proposal with costs and rollback for separate review. Provider OAuth remains off until resolved.
