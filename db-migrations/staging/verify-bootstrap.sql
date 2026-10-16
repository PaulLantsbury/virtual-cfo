-- Read only. Expected: 23 tables, 23 RLS tables/policies, 5 invoker views,
-- 24 functions, zero security definers/anonymous executable functions,
-- zero users/memberships/stores immediately after bootstrap.
SELECT
 (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS tables,
 (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relrowsecurity) AS rls_tables,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS policies,
 (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='v' AND reloptions @> ARRAY['security_invoker=true']) AS invoker_views,
 (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace) AS functions,
 (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef) AS security_definers,
 (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND has_function_privilege('anon',oid,'EXECUTE')) AS anon_executable_functions,
 (SELECT count(*) FROM auth.users) AS auth_users,
 (SELECT count(*) FROM public.store_memberships) AS memberships,
 (SELECT count(*) FROM public.stores) AS stores;
