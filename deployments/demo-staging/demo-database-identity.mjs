// Fixed demo capability pairs only. No role/schema names are accepted from env.
function valid(roles,memberships,loginName,serviceName){
 if(!Array.isArray(roles)||roles.length!==2||!Array.isArray(memberships)||memberships.length!==1)return false;
 const restricted=r=>r&&r.rolsuper===false&&r.rolinherit===false&&r.rolcreatedb===false&&r.rolcreaterole===false&&r.rolreplication===false&&r.rolbypassrls===false&&r.session_login===loginName;
 const login=roles.find(r=>r.rolname===loginName),service=roles.find(r=>r.rolname===serviceName),m=memberships[0];
 return !!(restricted(login)&&restricted(service)&&login.rolcanlogin===true&&Number.isInteger(login.rolconnlimit)&&login.rolconnlimit>=1&&login.rolconnlimit<=3&&service.rolcanlogin===false&&m.role_name===serviceName&&m.member_name===loginName&&m.admin_option===false&&m.inherit_option===false&&m.set_option===true);
}
export const validDemoReaderIdentity=(roles,memberships)=>valid(roles,memberships,'night_scout_demo_import_login','night_scout_demo_import_service');
export const validDemoBootstrapIdentity=(roles,memberships)=>valid(roles,memberships,'night_scout_demo_bootstrap_login','night_scout_demo_bootstrap_service');
