-- Read-only, status-only verification. No identifiers or credential material.
SELECT
 (SELECT count(*)=1 FROM xero_v1.xero_second_reauthorization_authorizations) AS exactly_one_authorization,
 (SELECT count(*) FILTER(WHERE consumed_at IS NULL)=1 FROM xero_v1.xero_second_reauthorization_authorizations) AS authorization_unconsumed,
 (SELECT count(*) FILTER(WHERE replacement_version IS NULL)=1 FROM xero_v1.xero_second_reauthorization_authorizations) AS no_replacement_recorded,
 strpos(pg_get_functiondef('public.xero_merchant_readiness(uuid)'::regprocedure),'xero_second_reauthorization_authorizations')>0 AS readiness_uses_second_authorization,
 has_function_privilege('night_scout_xero_bootstrap_login','xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)','EXECUTE') AS bootstrap_lookup_execute,
 has_function_privilege('night_scout_xero_bootstrap_login','xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text)','EXECUTE') AS bootstrap_replace_execute,
 NOT has_function_privilege('authenticated','xero_v1.bootstrap_get_reauthorization_target(uuid,text,uuid)','EXECUTE') AS authenticated_lookup_denied,
 NOT has_function_privilege('night_scout_import_login','xero_v1.bootstrap_reauthorize_connection(uuid,uuid,text,uuid,integer,bytea,bytea,text,text)','EXECUTE') AS worker_replace_denied;
