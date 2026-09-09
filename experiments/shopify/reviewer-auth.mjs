import {restoreReviewedPeriod} from './restore-reviewed-period.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Trusted server-owned client for the SAME Supabase project as the database.
 * Always verify the supplied token with Auth; never trust decoded JWT claims,
 * browser session metadata, request reviewer IDs or a cached previous user.
 */
export function reviewerAuthenticator(supabase,authorization){
 return async()=>{
  if(typeof authorization!=='string'||authorization.length>8192||!/^Bearer [^\s,]+$/i.test(authorization))throw new Error('Reviewer sign-in required');
  const token=authorization.slice(7);
  try{
   const result=await supabase.auth.getUser(token);
   const user=result?.data?.user;
   if(result?.error||!uuid.test(user?.id??'')||user?.is_anonymous!==false)throw new Error('Invalid reviewer');
   return {id:user.id};
  }catch{
   // Upstream errors may contain private details or tokens. Never forward them.
   throw new Error('Reviewer sign-in could not be verified');
  }
 };
}
/** Local service composition, NOT a registered HTTP route. Client provisioning,
 * environment matching, request limits and public error handling remain required.
 */
export async function restoreWithReviewerToken(db,body,{supabase,authorization}){
 // Only the review fields are forwarded. Identity/authentication dependencies
 // always come from the trusted service context, never the request body.
 const {scope,batchId,snapshotDigest,coverageConfirmed,evidenceRef,completenessStatement}=body??{};
 return restoreReviewedPeriod(db,{scope,batchId,snapshotDigest,coverageConfirmed,evidenceRef,completenessStatement},{authenticateReviewer:reviewerAuthenticator(supabase,authorization)});
}
