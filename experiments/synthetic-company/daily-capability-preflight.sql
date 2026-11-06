-- READ-ONLY PROPOSAL INSPECTION. Parameters are generic caller and owner role names.
-- Required caller context for stable catalog pretty-printing/protection hashes:
-- BEGIN READ ONLY; SET LOCAL search_path=pg_catalog; execute this single parameterized SELECT; COMMIT.
-- Keep transaction/context commands outside this file (one prepared SELECT only).
-- Capture the result privately; no source rows, credentials or operational bindings are read.
WITH RECURSIVE connected_role(oid) AS (
 SELECT oid FROM pg_roles WHERE rolname IN($1,$2) OR oid=(SELECT nspowner FROM pg_namespace WHERE nspname='finance_daily_v1')
 UNION
 SELECT CASE WHEN a.roleid=c.oid THEN a.member ELSE a.roleid END FROM connected_role c JOIN pg_auth_members a ON a.roleid=c.oid OR a.member=c.oid
), audited_principal AS (SELECT oid,rolname,rolcanlogin FROM pg_roles WHERE rolname IN($1,$2) OR (oid IN(SELECT oid FROM connected_role) AND rolcanlogin))
SELECT jsonb_build_object(
 'auditedPrincipals',COALESCE((SELECT jsonb_agg(rolname ORDER BY rolname) FROM audited_principal),'[]'::jsonb),
 'boundLoginPrivileges',COALESCE((SELECT jsonb_agg(jsonb_build_object('principal',x.rolname,'schema',n.nspname,'name',c.relname,'kind',c.relkind)) FROM audited_principal x CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE x.rolcanlogin AND c.relkind IN('r','p','v','m','f') AND n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast' AND (has_table_privilege(x.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(x.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))),'[]'::jsonb),
 'unsafeSchemaCreate',COALESCE((SELECT jsonb_agg(g) FROM (SELECT jsonb_build_object('principal',x.rolname,'schema',n.nspname) g FROM audited_principal x CROSS JOIN pg_namespace n WHERE has_schema_privilege(x.oid,n.oid,'CREATE') UNION ALL SELECT jsonb_build_object('principal',x.rolname,'database',current_database(),'privilege','CREATE') FROM audited_principal x WHERE has_database_privilege(x.oid,current_database(),'CREATE')) grants),'[]'::jsonb),
 'unsafeSequencePrivileges',COALESCE((SELECT jsonb_agg(jsonb_build_object('principal',x.rolname,'schema',n.nspname,'name',c.relname)) FROM audited_principal x CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='S' AND has_sequence_privilege(x.oid,c.oid,'USAGE,SELECT,UPDATE')),'[]'::jsonb),
 'unsafeSecurityDefinerExecute',COALESCE((SELECT jsonb_agg(jsonb_build_object('principal',x.rolname,'schema',n.nspname,'name',p.proname,'arguments',oidvectortypes(p.proargtypes))) FROM audited_principal x CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND has_function_privilege(x.oid,p.oid,'EXECUTE') AND NOT(n.nspname='finance_daily_v1' AND ((p.proname='append_completed_day' AND oidvectortypes(p.proargtypes)='date, date') OR (p.proname='inspect_daily_receipt' AND oidvectortypes(p.proargtypes)='date') OR (p.proname='validate_reviewed_day' AND oidvectortypes(p.proargtypes)='date, jsonb')))),'[]'::jsonb),
 'schemaPresent', to_regnamespace('finance_daily_v1') IS NOT NULL,
 'schemaOwner',(SELECT r.rolname FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='finance_daily_v1'),
 'schemaPrivileges',COALESCE((SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE r.rolname END,'privilege',a.privilege_type)) FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE n.nspname='finance_daily_v1'),'[]'::jsonb),
 'roles', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypassRls',rolbypassrls,'replication',rolreplication,'createRole',rolcreaterole,'createDb',rolcreatedb,'inherit',rolinherit)) FROM pg_roles WHERE oid IN(SELECT oid FROM connected_role)), '[]'::jsonb),
 'memberships', COALESCE((SELECT jsonb_agg(jsonb_build_object('role',p.rolname,'member',m.rolname,'adminOption',a.admin_option,'inheritOption',a.inherit_option,'setOption',a.set_option)) FROM pg_auth_members a JOIN pg_roles p ON p.oid=a.roleid JOIN pg_roles m ON m.oid=a.member WHERE a.roleid IN(SELECT oid FROM connected_role) OR a.member IN(SELECT oid FROM connected_role)), '[]'::jsonb),
 'functions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'name',p.proname,'arguments',oidvectortypes(p.proargtypes),'owner',r.rolname,'securityDefiner',p.prosecdef,
   'settings',p.proconfig,'definition',pg_get_functiondef(p.oid),
   'executeGrantees',(SELECT jsonb_agg(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles gr ON gr.oid=a.grantee WHERE a.privilege_type='EXECUTE')
 )) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='finance_daily_v1' AND p.proname IN('append_completed_day','inspect_daily_receipt','validate_reviewed_day')), '[]'::jsonb),
 'unsafeOtherFunctions',COALESCE((SELECT jsonb_agg(p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='finance_daily_v1' AND p.proname NOT IN('append_completed_day','inspect_daily_receipt','validate_reviewed_day') AND EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.privilege_type='EXECUTE' AND (a.grantee=0 OR a.grantee IN(SELECT oid FROM pg_roles WHERE rolname=$1)))),'[]'::jsonb),
 'tables', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',r.rolname,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
   'unexpectedControlPrivileges',EXISTS(SELECT 1 FROM audited_principal x WHERE has_table_privilege(x.oid,c.oid,'REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(x.oid,c.oid,'REFERENCES')),
   'callerColumnSelect',EXISTS(SELECT 1 FROM pg_roles x WHERE x.rolname=$1 AND has_any_column_privilege(x.oid,c.oid,'SELECT')),
   'ownerColumnSelect',EXISTS(SELECT 1 FROM pg_roles x WHERE x.rolname=$2 AND has_any_column_privilege(x.oid,c.oid,'SELECT')),
   'callerSelect',EXISTS(SELECT 1 FROM pg_roles x WHERE x.rolname=$1 AND has_table_privilege(x.oid,c.oid,'SELECT')),
   'callerDml',EXISTS(SELECT 1 FROM pg_roles x WHERE x.rolname=$1 AND has_table_privilege(x.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')),
   'callerColumnUpdate',EXISTS(SELECT 1 FROM pg_roles x WHERE x.rolname=$1 AND has_any_column_privilege(x.oid,c.oid,'INSERT,UPDATE')),
   'ownerSelect',EXISTS(SELECT 1 FROM pg_roles x WHERE x.rolname=$2 AND has_table_privilege(x.oid,c.oid,'SELECT')),
   'ownerColumnInsert',EXISTS(SELECT 1 FROM pg_roles x WHERE x.rolname=$2 AND has_any_column_privilege(x.oid,c.oid,'INSERT')),
   'ownerInsert',EXISTS(SELECT 1 FROM pg_roles x WHERE x.rolname=$2 AND has_table_privilege(x.oid,c.oid,'INSERT')),
   'ownerDeleteTruncate',EXISTS(SELECT 1 FROM pg_roles x WHERE x.rolname=$2 AND has_table_privilege(x.oid,c.oid,'DELETE,TRUNCATE')),
   'ownerUpdateColumns',(SELECT COALESCE(jsonb_agg(a.attname ORDER BY a.attname),'[]'::jsonb) FROM pg_attribute a JOIN pg_roles x ON x.rolname=$2 WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped AND has_column_privilege(x.oid,c.oid,a.attnum,'UPDATE')),
   'columns',(SELECT COALESCE(jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull) ORDER BY a.attnum),'[]'::jsonb) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
   'constraints',(SELECT COALESCE(jsonb_agg(pg_get_constraintdef(x.oid) ORDER BY x.conname),'[]'::jsonb) FROM pg_constraint x WHERE x.conrelid=c.oid),
   'policies',(SELECT COALESCE(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'roles',p.polroles,'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid=c.oid),
   'triggers',(SELECT COALESCE(jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'functionDefinition',pg_get_functiondef(t.tgfoid)) ORDER BY t.tgname),'[]'::jsonb) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)
 )) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE c.relkind IN('r','p','v','m','f') AND n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast'), '[]'::jsonb)
) AS preflight;
