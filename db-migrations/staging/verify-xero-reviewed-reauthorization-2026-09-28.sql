-- Read-only, status-only verification. No identifiers or credential material.
SELECT
 (SELECT count(*)=1 FROM xero_v1.xero_reauthorization_authorizations) AS exactly_one_reauthorization,
 (SELECT count(*) FILTER(WHERE consumed_at IS NULL)=1 FROM xero_v1.xero_reauthorization_authorizations) AS reauthorization_unconsumed,
 (SELECT count(*) FILTER(WHERE replacement_version IS NULL)=1 FROM xero_v1.xero_reauthorization_authorizations) AS no_replacement_recorded,
 strpos(pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure),'xero_reauthorization_authorizations')>0 AS readiness_uses_reauthorization,
 strpos(pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure),'''scopeVersion''')>0
  AND strpos(pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure),'''read-only-v1''')>0 AS readiness_contract_preserved,
 has_function_privilege('authenticated','public.xero_merchant_readiness(uuid)','EXECUTE') AS readiness_authenticated_execute,
 NOT has_function_privilege('anon','public.xero_merchant_readiness(uuid)','EXECUTE') AS readiness_anon_denied;
