import {extractSelectedAccountTotals} from './selected-account-totals.mjs';
import {xeroAccountingView,validateXeroAccountMapping} from './account-mapping-contract.mjs';
import {readXeroAccountingPeriod} from './accounting-reader-contract.mjs';
import {xeroEvidenceSummary} from './evidence-summary.mjs';
import {createHash} from 'node:crypto';

/**
 * Staging-only composition root for a single read-only Xero refresh.
 *
 * This module deliberately has no environment access, database driver, OAuth flow,
 * scheduler, filesystem or HTTP route.  The caller supplies a one-shot snapshot
 * reader and a server-only persistence port.  Raw report payloads are consumed in
 * memory and are never handed to persistence.  It is therefore safe to exercise
 * with a test tenant or fixtures before a staging worker is wired.
 */
export async function runStagingXeroRefresh({connection,scope,mapping,readSnapshot,persist,now=()=>new Date().toISOString(),maxAttempts=2}={}){
 if(!validConnection(connection)||!validScope(scope)||!validateXeroAccountMapping(mapping)||typeof readSnapshot!=='function'||!validPersistencePort(persist)||typeof now!=='function'||!validAttempts(maxAttempts))throw Error('Xero staging refresh setup is invalid');
 const retrievedAt=timestamp(now());
 let snapshot,attempts=0;
 while(attempts<maxAttempts){
  attempts+=1;
  try { snapshot=await readSnapshot(Object.freeze({tenantId:connection.tenantId,date:scope.to}));break; }
  catch { /* bounded retry: the persisted failure records the final outcome only. */ }
 }
 if(!snapshot)return recordFailure({connection,scope,persist,retrievedAt,reason:'source_refresh_failed',attempts});
 if(!validSnapshotIdentity(snapshot,connection.tenantId,scope.to))return recordFailure({connection,scope,persist,retrievedAt,reason:'source_review_required'});
 let evidence,reader,summary,sourceFingerprint;
 try {
  const accountTotals=extractSelectedAccountTotals({profitAndLoss:snapshot.profitAndLoss,balanceSheet:snapshot.balanceSheet,mapping});
  const view=xeroAccountingView({mapping,accountTotals});
  if(!view.available) return recordFailure({connection,scope,persist,retrievedAt,reason:'account_mapping_review_required'});
  const values=Object.freeze({revenue:view.revenue,processingFee:view.processingFee,advertising:view.advertising,software:view.software,includedCash:view.includedCash});
  sourceFingerprint=fingerprint(values);
  evidence=Object.freeze({state:'supported',scope:Object.freeze({...scope}),asOf:scope.to,values});
  reader=readXeroAccountingPeriod({scope,mapping:readyMapping(mapping),source:evidence});
  if(!reader.available) return recordFailure({connection,scope,persist,retrievedAt,reason:'accounting_evidence_unavailable'});
  summary=xeroEvidenceSummary(snapshot,{retrievedAt});
 } catch { return recordFailure({connection,scope,persist,retrievedAt,reason:'accounting_evidence_unavailable',attempts}); }
 if(scope.closedPeriod===true&&typeof persist.readLatestSupported==='function'){
  const prior=await persist.readLatestSupported(Object.freeze({connectionId:connection.id,tenantId:connection.tenantId,scope}));
  if(validPriorForScope(prior,connection,scope)&&prior.sourceFingerprint!==sourceFingerprint)return recordFailure({connection,scope,persist,retrievedAt,reason:'later_posting_review_required',attempts});
 }
 // The only persisted input is this bounded accounting evidence: no raw reports,
 // OAuth data, Shopify data or transaction-level rows cross this boundary.
 await persist.writeSupported(Object.freeze({connectionId:connection.id,tenantId:connection.tenantId,scope,evidence,summary,reader,sourceFingerprint}));
 return Object.freeze({state:'supported',connectionId:connection.id,scope,evidence,reader,summary});
}

async function recordFailure({connection,scope,persist,retrievedAt,reason,attempts=1}){
 const prior=typeof persist.readLatestSupported==='function'?await persist.readLatestSupported(Object.freeze({connectionId:connection.id,tenantId:connection.tenantId,scope})):null;
 const retained=reason==='source_refresh_failed'&&validPriorForScope(prior,connection,scope)?prior:null;
 const failure=Object.freeze({state:'failed',scope:Object.freeze({...scope}),asOf:retrievedAt,reason,attempts,retained:!!retained});
 await persist.writeFailure(Object.freeze({connectionId:connection.id,tenantId:connection.tenantId,scope,failure,retainedEvidence:retained?.evidence??null}));
 return retained?Object.freeze({state:'stale',connectionId:connection.id,scope,evidence:retained.evidence,failure}):Object.freeze({state:'failed',connectionId:connection.id,scope,failure});
}
function readyMapping(mapping){return Object.freeze({ready:true,...mapping});}
function validConnection(value){return plain(value)&&typeof value.id==='string'&&value.id.trim()!==''&&typeof value.tenantId==='string'&&value.tenantId.trim()!=='';}
function validScope(value){return plain(value)&&exactKeys(value,value.closedPeriod===undefined?['from','to','currency']:['from','to','currency','closedPeriod'])&&date(value.from)&&date(value.to)&&value.from<=value.to&&typeof value.currency==='string'&&/^[A-Z]{3}$/.test(value.currency)&&(value.closedPeriod===undefined||typeof value.closedPeriod==='boolean');}
function validPersistencePort(value){return plain(value)&&typeof value.writeSupported==='function'&&typeof value.writeFailure==='function';}
function validSnapshotIdentity(snapshot,tenantId,dateValue){return plain(snapshot)&&snapshot.tenantId===tenantId&&snapshot.date===dateValue&&plain(snapshot.organisation)&&plain(snapshot.profitAndLoss)&&plain(snapshot.balanceSheet)&&plain(snapshot.trialBalance)&&plain(snapshot.bankSummary);}
function plain(value){return value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;}
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(`${value}T00:00:00.000Z`);return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;}
function timestamp(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('Xero staging refresh setup is invalid');return value;}
function validAttempts(value){return Number.isInteger(value)&&value>=1&&value<=3;}
function exactKeys(value,keys){return Object.keys(value).sort().join(',')===keys.slice().sort().join(',');}
function sameScope(a,b){return validScope(a)&&validScope(b)&&a.from===b.from&&a.to===b.to&&a.currency===b.currency&&!!a.closedPeriod===!!b.closedPeriod;}
function validPriorForScope(value,connection,scope){return plain(value)&&value.connectionId===connection.id&&value.tenantId===connection.tenantId&&sameScope(value.scope,scope)&&typeof value.sourceFingerprint==='string'&&/^[a-f0-9]{64}$/.test(value.sourceFingerprint)&&plain(value.evidence)&&value.evidence.state==='supported'&&sameScope(value.evidence.scope,scope)&&date(value.evidence.asOf)&&plain(value.evidence.values);}
function fingerprint(values){return createHash('sha256').update(JSON.stringify(['xero-v1',values.revenue,values.processingFee,values.advertising,values.software,values.includedCash])).digest('hex');}
