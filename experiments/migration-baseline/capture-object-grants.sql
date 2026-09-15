-- Read-only relation/function object privileges; excludes schema/default ACLs and role attributes.
WITH objects AS (
 SELECT 'relation'::text kind,c.relname::text name,''::text arguments,
        coalesce(c.relacl,acldefault('r',c.relowner)) acl
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','v')
 UNION ALL
 SELECT 'function',p.proname::text,pg_get_function_identity_arguments(p.oid),
        coalesce(p.proacl,acldefault('f',p.proowner))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
)
SELECT o.kind,o.name,o.arguments,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee,
 a.is_grantable grantable,array_agg(a.privilege_type ORDER BY a.privilege_type) privileges
FROM objects o CROSS JOIN LATERAL aclexplode(o.acl) a
GROUP BY o.kind,o.name,o.arguments,a.grantee,a.is_grantable
ORDER BY o.kind,o.name,o.arguments,grantee,grantable;
