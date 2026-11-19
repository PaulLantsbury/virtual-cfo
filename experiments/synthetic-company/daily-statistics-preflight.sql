-- READ-ONLY CANDIDATE. $1::text[] is the already reviewed runtime/owner/invoker principal list.
-- prepareStatisticsCatalogQuery combines this with ordinary preflight in ONE statement/snapshot.
-- Use the reviewed pg_catalog search path, including the final pre-dispatch check.
-- Catalog metadata only: never reads statistics rows, query text, financial rows or credentials.
WITH ext AS (
 SELECT e.oid,e.extname,e.extversion,e.extrelocatable,e.extowner,n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_stat_statements'
), principals AS (SELECT oid,rolname FROM pg_roles WHERE rolname=ANY($1::text[])), views AS (
 SELECT c.*,n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='extensions' AND c.relname IN('pg_stat_statements','pg_stat_statements_info')
), functions AS (
 SELECT p.*,n.nspname,l.lanname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='extensions' AND p.proname IN('pg_stat_statements','pg_stat_statements_info','pg_stat_statements_reset')
), owners AS (
 SELECT extowner oid FROM ext UNION SELECT relowner FROM views UNION SELECT proowner FROM functions
), platform_acl_roles AS (
 SELECT DISTINCT a.grantee oid FROM views c CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee<>0 AND a.grantee<>c.relowner
 UNION SELECT DISTINCT a.grantee FROM functions p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>0 AND a.grantee<>p.proowner
)
SELECT jsonb_build_object(
 'extension',(SELECT jsonb_build_object('name',extname,'version',extversion,'schema',nspname,'relocatable',extrelocatable,'owner',pg_get_userbyid(extowner)) FROM ext),
 'ownerRoles',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',r.rolname,'login',r.rolcanlogin,'superuser',r.rolsuper,'bypassRls',r.rolbypassrls,'replication',r.rolreplication,'createRole',r.rolcreaterole,'createDb',r.rolcreatedb,'inherit',r.rolinherit) ORDER BY r.rolname) FROM pg_roles r WHERE r.oid IN(SELECT oid FROM owners)),'[]'::jsonb),
 'platformAclRoles',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',r.rolname,'login',r.rolcanlogin,'superuser',r.rolsuper,'bypassRls',r.rolbypassrls,'replication',r.rolreplication,'createRole',r.rolcreaterole,'createDb',r.rolcreatedb,'inherit',r.rolinherit) ORDER BY r.rolname) FROM pg_roles r WHERE r.oid IN(SELECT oid FROM platform_acl_roles)),'[]'::jsonb),
 'views',COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'schema',c.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
  'extensionMember',EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_extension'::regclass AND d.refobjid=(SELECT oid FROM ext) AND d.deptype='e'),
  'definition',CASE WHEN c.relkind='v' THEN pg_get_viewdef(c.oid,true) ELSE NULL END,
  'options',COALESCE(c.reloptions,ARRAY[]::text[]),
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  'acl',(SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=c.relowner THEN '@OWNER' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantOption',a.is_grantable) ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=c.relowner THEN '@OWNER' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable) FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a)
 ) ORDER BY c.relname) FROM views c),'[]'::jsonb),
 'functions',COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'schema',p.nspname,'name',p.proname,'arguments',oidvectortypes(p.proargtypes),'owner',pg_get_userbyid(p.proowner),
  'extensionMember',EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_extension'::regclass AND d.refobjid=(SELECT oid FROM ext) AND d.deptype='e'),
  'language',p.lanname,'securityDefiner',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'parallel',p.proparallel,'settings',COALESCE(p.proconfig,ARRAY[]::text[]),'definition',pg_get_functiondef(p.oid),'library',p.probin,'symbol',p.prosrc,
  'acl',(SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=p.proowner THEN '@OWNER' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantOption',a.is_grantable) ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=p.proowner THEN '@OWNER' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a)
 ) ORDER BY p.proname,oidvectortypes(p.proargtypes)) FROM functions p),'[]'::jsonb),
 'principals',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',x.rolname,
  'readAllStatsUsage',pg_has_role(x.oid,'pg_read_all_stats','USAGE'),'readAllStatsSet',pg_has_role(x.oid,'pg_read_all_stats','SET'),
  'superuserSet',EXISTS(SELECT 1 FROM pg_roles s WHERE s.rolsuper AND pg_has_role(x.oid,s.oid,'SET')),
  'controlPlaneSet',EXISTS(SELECT 1 FROM pg_roles s WHERE s.oid IN(SELECT oid FROM owners UNION SELECT oid FROM platform_acl_roles) AND pg_has_role(x.oid,s.oid,'SET')),
  'resetExecute',EXISTS(SELECT 1 FROM pg_proc p WHERE p.probin='$libdir/pg_stat_statements' AND p.prosrc LIKE 'pg_stat_statements_reset%' AND has_function_privilege(x.oid,p.oid,'EXECUTE')),
  'views',(SELECT jsonb_agg(jsonb_build_object('schema',c.nspname,'name',c.relname,'select',has_table_privilege(x.oid,c.oid,'SELECT'),'selectGrantOption',has_table_privilege(x.oid,c.oid,'SELECT WITH GRANT OPTION') OR has_any_column_privilege(x.oid,c.oid,'SELECT WITH GRANT OPTION'),'change',has_table_privilege(x.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(x.oid,c.oid,'INSERT,UPDATE,REFERENCES')) ORDER BY c.relname) FROM views c)
 ) ORDER BY x.rolname) FROM principals x),'[]'::jsonb)
) AS statistics_preflight;
