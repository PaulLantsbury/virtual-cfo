/** Offline additive customer activity proposal. No SQL, reader, permission or publication effects. */
import { historySourceAsOf } from './history-context.mjs';
import { ACQUISITION_POLICY } from './acquisition-source.mjs';
import { supplementalDigest } from './supplemental-reader.mjs';
import { RESERVED_SYNTHETIC_IDENTITY as identity } from './staging-payload.mjs';
const fail=(ok,message)=>{if(!ok)throw new Error(message);};
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const count=v=>Number.isSafeInteger(v)&&v>=0;
const same=(a,b)=>supplementalDigest(a)===supplementalDigest(b);
function baseRecord(row){
 fail(exact(row,'body,bodyHash')&&sha(row.bodyHash)&&supplementalDigest(row.body)===row.bodyHash,'Invalid base digest');
 const b=row.body,s=b.scope;
 fail(exact(b,'contract,kind,scope,financialVersionId,salesRevision,costRevision,sourceBasis,observedAt,payload')&&b.contract==='reviewed-supplement-v1'&&['cash','acquisition'].includes(b.kind)&&b.sourceBasis==='synthetic-local','Invalid base envelope');
 fail(exact(s,'storeId,currency,timezone,from,to')&&s.storeId===identity.storeId&&s.currency==='GBP'&&s.timezone==='Europe/London'&&/^\d{4}-(0[1-9]|1[0-2])-01$/.test(s.from),'Invalid base scope');
 const end=new Date(Date.UTC(Number(s.from.slice(0,4)),Number(s.from.slice(5,7)),0)).toISOString().slice(0,10);
 fail(s.to===end&&uuid(b.financialVersionId)&&sha(b.salesRevision)&&sha(b.costRevision)&&typeof b.observedAt==='string'&&Number.isFinite(Date.parse(b.observedAt))&&Date.parse(b.observedAt)>=Date.parse(historySourceAsOf(s.to)),'Invalid base financial binding');
 fail(b.payload&&Object.getPrototypeOf(b.payload)===Object.prototype,'Invalid base payload');
 return b;
}
function activityRecord(a,b){
 fail(exact(a,'contract,policy,scope,identifiedCustomers,uniqueReturningCustomers,identifiedOrders,sourceHash,basis'),'Invalid activity shape');
 const c=b.payload.coverage,source=b.payload.source;
 fail(c&&source&&count(c.identifiedFirstOrders)&&count(c.identifiedRepeatOrders)&&sha(source.ordersHash),'Base lacks classified source proof');
 fail(a.contract==='synthetic-customer-activity-v1'&&a.policy===ACQUISITION_POLICY&&a.policy===b.payload.policy&&exact(a.scope,'from,to')&&a.scope.from===b.scope.from&&a.scope.to===b.scope.to,'Activity scope/policy mismatch');
 fail(['identifiedCustomers','uniqueReturningCustomers','identifiedOrders'].every(k=>count(a[k]))&&a.sourceHash===source.ordersHash&&sha(a.sourceHash)&&typeof a.basis==='string'&&a.basis.startsWith('Distinct synthetic customer identifiers')&&a.basis.length<=500,'Invalid activity proof');
 const first=BigInt(c.identifiedFirstOrders),repeat=BigInt(c.identifiedRepeatOrders),customers=BigInt(a.identifiedCustomers),returners=BigInt(a.uniqueReturningCustomers),orders=BigInt(a.identifiedOrders);
 fail(orders===first+repeat&&customers>=first&&customers<=first+returners&&customers<=orders&&returners<=customers&&returners<=repeat&&(returners===0n)===(repeat===0n)&&(customers===0n)===(orders===0n),'Impossible customer population');
}
/** Bases are inspected immutable envelopes; this planner verifies bindings, not underlying ledger completeness. */
export function prepareCustomerSummaryVersions(input){
 supplementalDigest(input);
 fail(exact(input,'baseRows,candidates')||exact(input,'baseRows,candidates,existingSidecars'),'Invalid proposal inputs');
 const {baseRows,candidates,existingSidecars=[]}=input;
 fail(Array.isArray(baseRows)&&baseRows.length===48&&Array.isArray(candidates)&&candidates.length>0&&Array.isArray(existingSidecars),'Exact base inventory and candidates required');
 const bases=new Map(),keys=new Set();
 for(const row of baseRows){const b=baseRecord(row),key=b.scope.from+':'+b.kind;fail(!keys.has(key),'Duplicate base key');keys.add(key);bases.set(row.bodyHash,row);}
 for(let i=0;i<24;i++){const from=new Date(Date.UTC(2024,10+i,1)).toISOString().slice(0,10);for(const kind of ['cash','acquisition'])fail(keys.has(from+':'+kind),'Protected 48-row inventory differs');}
 const validateSidecar=v=>{
  fail(exact(v,'versionId,body')&&sha(v.versionId)&&supplementalDigest(v.body)===v.versionId,'Invalid sidecar digest');
  const x=v.body;fail(exact(x,'contract,baseBodyHash,scope,financialVersionId,salesRevision,costRevision,activity')&&x.contract==='synthetic-customer-summary-sidecar-v1','Invalid sidecar contract');
  const row=bases.get(x.baseBodyHash);fail(row&&row.body.kind==='acquisition','Unknown acquisition base');const b=row.body;
  fail(same(x.scope,b.scope)&&x.financialVersionId===b.financialVersionId&&x.salesRevision===b.salesRevision&&x.costRevision===b.costRevision,'Sidecar financial scope mismatch');activityRecord(x.activity,b);return x.baseBodyHash;
 };
 const existing=new Map();for(const v of existingSidecars){const key=validateSidecar(v);fail(!existing.has(key),'Ambiguous existing sidecars');existing.set(key,v);}
 const seen=new Set(),operations=[];
 for(const c of candidates){
  fail(exact(c,'baseBodyHash,financial,activity')&&sha(c.baseBodyHash),'Invalid candidate');
  const row=bases.get(c.baseBodyHash);fail(row&&row.body.kind==='acquisition','Unknown acquisition base');const b=row.body;
  fail(exact(c.financial,'scope,financialVersionId,salesRevision,costRevision')&&same(c.financial.scope,b.scope)&&c.financial.financialVersionId===b.financialVersionId&&c.financial.salesRevision===b.salesRevision&&c.financial.costRevision===b.costRevision,'Candidate financial scope mismatch');
  fail(!seen.has(c.baseBodyHash),'Duplicate candidate base');seen.add(c.baseBodyHash);activityRecord(c.activity,b);
  const body=structuredClone({contract:'synthetic-customer-summary-sidecar-v1',baseBodyHash:c.baseBodyHash,...c.financial,activity:c.activity}),versionId=supplementalDigest(body),previous=existing.get(c.baseBodyHash);
  fail(!previous||previous.versionId===versionId,'Changed sidecar replay refused');
  operations.push({action:previous?'unchanged':'propose-add',versionId,body});
 }
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
 return freeze({contract:'synthetic-customer-summary-version-proposal-v1',state:'proposal-only',remoteApplied:false,baseInventoryHash:supplementalDigest([...baseRows].sort((a,b)=>a.bodyHash.localeCompare(b.bodyHash))),protectedRows:48,updateAllowed:false,operations});
}
