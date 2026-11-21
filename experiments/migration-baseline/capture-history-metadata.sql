-- Read-only supplementary metadata. Run separately; never repairs the ledger.
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT column_name,data_type FROM information_schema.columns
 WHERE table_schema='supabase_migrations' AND table_name='schema_migrations' ORDER BY ordinal_position;
SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT c.relname AS table_name,t.tgname,pg_get_triggerdef(t.oid) AS definition
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;
