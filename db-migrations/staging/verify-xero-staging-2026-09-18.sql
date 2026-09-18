-- READ ONLY post-install check for the staging-only Xero schema.
-- Run in the same visibly selected staging project.  It does not inspect
-- credential ciphertexts or business values.
SELECT n.nspname, c.relname, c.relrowsecurity
FROM pg_namespace n JOIN pg_class c ON c.relnamespace=n.oid
WHERE n.nspname='xero_v1' AND c.relkind='r' ORDER BY c.relname;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='xero_v1' ORDER BY table_name,grantee,privilege_type;

SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies WHERE schemaname='xero_v1' ORDER BY tablename,policyname;
