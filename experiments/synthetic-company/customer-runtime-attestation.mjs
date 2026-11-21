/** Server composition only. Not a route, authentication boundary or new connection.
 * Call only after existing runtime target validation and operator authorisation.
 * Trusted composition supplies its built revision; request fields must never do so.
 * This helper cannot prove those prerequisites from a boolean or current_database(). */
const exactRevision=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export function createCustomerRuntimeAttestation(reviewDatabase,{trustedRevision}={}){
 if(typeof reviewDatabase?.transaction!=='function'||!exactRevision(trustedRevision))throw Error('Trusted runtime composition required');
 return Object.freeze({async inspect(){
  try{return await reviewDatabase.transaction(async tx=>{
   await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
   const result=await tx.query(`SELECT session_user::text session_login,current_user::text effective_role,current_database()::text database_name,
 current_setting('transaction_read_only') read_only,current_setting('transaction_isolation') isolation,
 (SELECT rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication FROM pg_catalog.pg_roles WHERE rolname=session_user) unsafe_login,
 (SELECT rolsuper OR rolbypassrls OR rolinherit OR rolcanlogin OR rolcreatedb OR rolcreaterole OR rolreplication FROM pg_catalog.pg_roles WHERE rolname=current_user) unsafe_service`);
   const r=result.rows?.length===1?result.rows[0]:null;
   return Object.freeze({contract:'customer-runtime-attestation-v1',state:r?'observed':'unavailable',revision:trustedRevision,
    loginMatches:r?.session_login==='night_scout_review_login',serviceMatches:r?.effective_role==='night_scout_review_service',databaseMatches:r?.database_name==='postgres',
    loginRestricted:r?.unsafe_login===false,serviceRestricted:r?.unsafe_service===false,
    transactionReadOnly:r?.read_only==='on',transactionRepeatableRead:r?.isolation==='repeatable read',
    targetProjectAttested:false});
  });}catch{return Object.freeze({contract:'customer-runtime-attestation-v1',state:'unavailable',revision:trustedRevision,loginMatches:false,serviceMatches:false,databaseMatches:false,loginRestricted:false,serviceRestricted:false,transactionReadOnly:false,transactionRepeatableRead:false,targetProjectAttested:false});}
 }});
}
