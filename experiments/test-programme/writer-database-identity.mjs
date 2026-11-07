// Side-effect-free capability verification, safe for hosted server imports.
export function validWriterDatabaseIdentity(roles,memberships) {
  if(!Array.isArray(roles) || roles.length!==2 || !Array.isArray(memberships) || memberships.length!==1 || memberships[0].role_name!=='night_scout_test_writer_service' || memberships[0].member_name!=='night_scout_test_writer' || memberships[0].admin_option!==false || memberships[0].inherit_option!==false || memberships[0].set_option!==true)return false;
  const login=roles.find(r=>r.rolname==='night_scout_test_writer'),service=roles.find(r=>r.rolname==='night_scout_test_writer_service');
  const restricted=r=>r && r.rolsuper===false && r.rolinherit===false && r.rolcreatedb===false && r.rolcreaterole===false && r.rolreplication===false && r.rolbypassrls===false;
  return restricted(login) && restricted(service) && login.session_login==='night_scout_test_writer' && login.rolcanlogin===true && login.rolconnlimit>=1 && login.rolconnlimit<=3 && service.rolcanlogin===false;
}

