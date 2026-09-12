import {inspectCandidateReview} from './review-candidate.mjs';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
/** LOCAL privileged service proposal, no HTTP endpoint or live auth integration.
 * authenticateReviewer is a trusted server dependency, NEVER a request field.
 * The review packet itself grants no permission. Separate DB authorisation is required.
 */
export async function restoreReviewedPeriod(db,request,{authenticateReviewer}){
 check(typeof authenticateReviewer==='function','Authenticated reviewer required');
 const reviewer=await authenticateReviewer();
 check(typeof reviewer?.id==='string','Authenticated reviewer required');
 const {scope,batchId,snapshotDigest,coverageConfirmed,evidenceRef,completenessStatement}=request;
 check(scope&&typeof batchId==='string'&&/^[a-f0-9]{64}$/.test(snapshotDigest),'Exact reviewed snapshot required');
 check(coverageConfirmed===true&&text(evidenceRef,2000)&&text(completenessStatement,10000),'Independent completeness attestation required');
 return db.transaction(async tx=>{
  await tx.exec('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
  await tx.exec("SET LOCAL lock_timeout='5s'");
  await tx.exec("SET LOCAL statement_timeout='30s'");
  // Conservative prototype: block writes to every dependency until commit.
  // Readers remain allowed. This also covers writers not using the intake helper.
  // Deadlocks/timeouts abort the whole operation; never retry an approval silently.
  await tx.exec('SELECT ingest_v1.lock_review_dependencies()');
  const {rows:allowed}=await tx.query('SELECT 1 FROM ingest_v1.review_authorizations a JOIN public.store_memberships m ON m.store_id=a.store_id AND m.user_id=a.reviewer_id WHERE a.store_id=$1 AND a.reviewer_id=$2',[scope.storeId,reviewer.id]);
  check(allowed.length===1,'Reviewer is not authorised for this store');
  const current=await inspectCandidateReview(tx,scope,{includeSnapshot:true});
  check(current.batchId===batchId&&current.snapshotDigest===snapshotDigest,'Review snapshot changed; prepare a new review');
  check(current.status==='awaiting_independent_coverage_review','Financial reconciliation has not passed');
  const {rows:audit}=await tx.query('INSERT INTO ingest_v1.review_audit(store_id,date_from,date_to,batch_id,snapshot_digest,reviewer_id,evidence_ref,completeness_statement,review_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id',[scope.storeId,scope.from,scope.to,batchId,snapshotDigest,reviewer.id,evidenceRef.trim(),completenessStatement.trim(),JSON.stringify(current.snapshot)]);
  const {rows:coverage}=await tx.query('UPDATE finance_v1.coverage_evidence SET sales_and_refunds_complete=true,evidence_ref=$4,verified_by=$5,verified_at=clock_timestamp() WHERE store_id=$1 AND date_from=$2 AND date_to=$3 RETURNING store_id',[scope.storeId,scope.from,scope.to,`review:${audit[0].id}`,reviewer.id]);
  check(coverage.length===1,'Exact coverage record required');
  await tx.query('UPDATE ingest_v1.heads SET needs_recheck=false WHERE store_id=$1 AND date_from=$2 AND date_to=$3 AND batch_id=$4',[scope.storeId,scope.from,scope.to,batchId]);
  return {status:'restored',scope,auditId:audit[0].id};
 });
}
