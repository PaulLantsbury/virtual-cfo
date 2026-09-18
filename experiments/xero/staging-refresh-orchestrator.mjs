import {extractSelectedAccountTotals} from './selected-account-totals.mjs';
import {xeroAccountingView,validateXeroAccountMapping} from './account-mapping-contract.mjs';
import {readXeroAccountingPeriod} from './accounting-reader-contract.mjs';
import {xeroEvidenceSummary} from './evidence-summary.mjs';

/**
 * Staging-only composition root for a single read-only Xero refresh.
 *
 * This module deliberately has no environment access, database driver, OAuth flow,
 * scheduler, filesystem or HTTP route.  The caller supplies a one-shot snapshot
 * reader and a server-only persistence port.  Raw report payloads are consumed in
 * memory and are never handed to persistence.  It is therefore safe to exercise
 * with a test tenant or fixtures before a staging worker is wired.
 */
export async function runStagingXeroRefresh({connection,scope,mapping,readSnapshot,persist,now=()=>new Date().toISOString()}={}){
 if(!validConnection(connection)||!validScope(scope)||!validateXeroAccountMapping(mapping)||typeof readSnapshot!=='function'||!validPersistencePort(persist)||typeof now!=='function')throw Error('Xero staging refresh setup is invalid');
 const retrievedAt=timestamp(now());
 let snapshot;
 try { snapshot=await readSnapshot(Object.freeze({tenantId:connection.tenantId,date:scope.to})); }
 catch { return recordFailure({connection,scope,persist,retrievedAt,reason:'source_refresh_failed'}); }
 if(!validSnapshotIdentity(snapshot,connection.tenantId,scope.to))return recordFailure({connection,scope,persist,retrievedAt,reason:'source_review_required'});
 try {
  const accountTotals=extractSelectedAccountTotals({profitAndLoss:snapshot.profitAndLoss,balanceSheet:snapshot.balanceSheet,mapping});
  const view=xeroAccountingView({mapping,accountTotals});
  if(!view.available) return recordFailure({connection,scope,persist,retrievedAt,reason:'account_mapping_review_required'});
  const values=Object.freeze({revenue:view.revenue,processingFee:view.processingFee,advertising:view.advertising,software:view.software,includedCash:view.includedCash});
  const evidence=Object.freeze({state:'supported',scope:Object.freeze({...scope}),asOf:scope.to,values});
  const reader=readXeroAccountingPeriod({scope,mapping:readyMapping(mapping),source:evidence});
  if(!reader.available) return recordFailure({connection,scope,persist,retrievedAt,reason:'accounting_evidence_unavailable'});
  const summary=xeroEvidenceSummary(snapshot,{retrievedAt});
  // The only persisted input is this bounded accounting evidence: no raw reports,
  // OAuth data, Shopify data or transaction-level rows cross this boundary.
  await persist.writeSupported(Object.freeze({connectionId:connection.id,tenantId:connection.tenantId,scope,evidence,summary,reader}));
  return Object.freeze({state:'supported',connectionId:connection.id,scope,evidence,reader,summary});
 } catch { return recordFailure({connection,scope,persist,retrievedAt,reason:'accounting_evidence_unavailable'}); }
}

async function recordFailure({connection,scope,persist,retrievedAt,reason}){
 const failure=Object.freeze({state:'failed',scope:Object.freeze({...scope}),asOf:retrievedAt,reason});
 await persist.writeFailure(Object.freeze({connectionId:connection.id,tenantId:connection.tenantId,scope,failure}));
 return Object.freeze({state:'failed',connectionId:connection.id,scope,failure});
}
function readyMapping(mapping){return Object.freeze({ready:true,...mapping});}
function validConnection(value){return plain(value)&&typeof value.id==='string'&&value.id.trim()!==''&&typeof value.tenantId==='string'&&value.tenantId.trim()!=='';}
function validScope(value){return plain(value)&&date(value.from)&&date(value.to)&&value.from<=value.to&&typeof value.currency==='string'&&/^[A-Z]{3}$/.test(value.currency);}
function validPersistencePort(value){return plain(value)&&typeof value.writeSupported==='function'&&typeof value.writeFailure==='function';}
function validSnapshotIdentity(snapshot,tenantId,dateValue){return plain(snapshot)&&snapshot.tenantId===tenantId&&snapshot.date===dateValue&&plain(snapshot.organisation)&&plain(snapshot.profitAndLoss)&&plain(snapshot.balanceSheet)&&plain(snapshot.trialBalance)&&plain(snapshot.bankSummary);}
function plain(value){return value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;}
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(`${value}T00:00:00.000Z`);return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;}
function timestamp(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('Xero staging refresh setup is invalid');return value;}
