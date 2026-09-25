-- NOT NULL is captured per column; PostgreSQL 18 also exposes it as a constraint.
-- Read-only public object capture. No business rows.
SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(jsonb_build_object(
  'name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
  'columns',(SELECT jsonb_agg(jsonb_build_object(
   'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
   'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),
   'generated',a.attgenerated,'identity',a.attidentity) ORDER BY a.attnum)
   FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)
 ) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('name',co.conname,'type',co.contype,'table',c.relname,'definition',pg_get_constraintdef(co.oid)) ORDER BY c.relname,co.conname)
 FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND co.contype<>'n'),
 'indexes',(SELECT jsonb_agg(jsonb_build_object('name',i.relname,'definition',pg_get_indexdef(i.oid)) ORDER BY i.relname)
 FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class t ON t.oid=x.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
 WHERE n.nspname='public' AND NOT EXISTS(SELECT 1 FROM pg_constraint co WHERE co.conindid=i.oid)),
 'views',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'options',c.reloptions,'definition',pg_get_viewdef(c.oid,true)) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid)) ORDER BY p.proname)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
) AS catalog;
