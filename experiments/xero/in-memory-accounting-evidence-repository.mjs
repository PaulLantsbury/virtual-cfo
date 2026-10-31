const states=new Set(['supported','failed','review_required','invalidated']);
const reasons=new Set(['source_refresh_failed','source_review_required','account_mapping_review_required','later_posting_review_required','accounting_evidence_unavailable','connection_disconnected']);

/** A value-bounded, append-only server-side persistence port for staging orchestration. */
export function createInMemoryAccountingEvidenceRepository({connections=[],mappings=[]}={}){
 const connectionById=new Map(), mappingById=new Map(), evidence=[];
 for(const connection of connections){if(!validConnection(connection)||connectionById.has(connection.id)||[...connectionById.values()].some(x=>x.tenantId===connection.tenantId&&x.storeId!==connection.storeId&&x.active!==false&&connection.active!==false))throw Error('Xero evidence repository connection is invalid');connectionById.set(connection.id,Object.freeze({...connection}));}
 for(const mapping of mappings){if(!validMapping(mapping)||mappingById.has(mapping.id)||!connectionById.has(mapping.connectionId))throw Error('Xero evidence repository mapping is invalid');mappingById.set(mapping.id,Object.freeze({...mapping}));}
 let sequence=0;
 const append=(input,kind)=>{
  if(!plain(input)||!connectionById.has(input.connectionId))throw Error('Xero evidence repository write is invalid');
  const connection=connectionById.get(input.connectionId);
  if(connection.tenantId!==input.tenantId||!sameScope(input.scope,input.evidence?.scope??input.failure?.scope))throw Error('Xero evidence repository isolation is invalid');
  const event=kind==='supported'?supported(input,connection):failure(input,connection);
  const row=Object.freeze({id:`xero-evidence-${++sequence}`,connectionId:connection.id,tenantId:connection.tenantId,storeId:connection.storeId,...event,createdAt:new Date(0).toISOString()});
  evidence.push(row);return row;
 };
 return Object.freeze({
  writeSupported:async input=>append(input,'supported'),
  writeFailure:async input=>append(input,'failure'),
  readLatestSupported:async query=>latest(query),
  readForMember:async ({memberId,connectionId,scope})=>{const c=connectionById.get(connectionId);if(!c||!Array.isArray(c.memberIds)||!c.memberIds.includes(memberId))return null;return latest({connectionId,tenantId:c.tenantId,scope});},
  rows:()=>Object.freeze(evidence.slice())
 });
 function latest(query){if(!plain(query)||!connectionById.has(query.connectionId))return null;const c=connectionById.get(query.connectionId);if(c.tenantId!==query.tenantId||!validScope(query.scope))return null;return evidence.filter(row=>row.connectionId===query.connectionId&&row.state==='supported'&&sameScope(row.scope,query.scope)).at(-1)??null;}
 function supported(input,connection){const {mappingVersionId,evidence:source,sourceFingerprint}=input;if(!validFingerprint(sourceFingerprint)||!plain(source)||source.state!=='supported'||!validScope(source.scope)||!date(source.asOf)||!validValues(source.values)||!mappingMatches(mappingVersionId,connection.id))throw Error('Xero evidence repository supported evidence is invalid');return {mappingVersionId,scope:freezeScope(source.scope),state:'supported',reason:null,asOf:source.asOf,sourceFingerprint,values:freezeValues(source.values),retainedEvidence:null};}
 function failure(input,connection){const {failure,retainedEvidence=null}=input;if(!plain(failure)||failure.state!=='failed'||!validScope(failure.scope)||!reasons.has(failure.reason)||!timestamp(failure.asOf)||!Number.isInteger(failure.attempts)||failure.attempts<1||failure.attempts>3||!mappingMatches(input.mappingVersionId,connection.id))throw Error('Xero evidence repository failure is invalid');if(retainedEvidence!==null&&!validRetained(retainedEvidence,connection,input.scope))throw Error('Xero evidence repository retained evidence is invalid');return {mappingVersionId:input.mappingVersionId,scope:freezeScope(failure.scope),state:failure.reason==='later_posting_review_required'?'review_required':'failed',reason:failure.reason,asOf:failure.asOf,sourceFingerprint:null,values:null,retainedEvidence:retainedEvidence?Object.freeze({...retainedEvidence}):null};}
 function mappingMatches(id,connectionId){return typeof id==='string'&&mappingById.get(id)?.connectionId===connectionId;}
}
function validConnection(x){return plain(x)&&str(x.id)&&str(x.tenantId)&&str(x.storeId)&&(x.active===undefined||typeof x.active==='boolean')&&(x.memberIds===undefined||Array.isArray(x.memberIds)&&x.memberIds.every(str));}
function validMapping(x){return plain(x)&&str(x.id)&&str(x.connectionId)&&Number.isInteger(x.version)&&x.version>0;}
function validScope(x){return plain(x)&&date(x.from)&&date(x.to)&&x.from<=x.to&&typeof x.currency==='string'&&/^[A-Z]{3}$/.test(x.currency)&&(x.closedPeriod===undefined||typeof x.closedPeriod==='boolean');}
function sameScope(a,b){return validScope(a)&&validScope(b)&&a.from===b.from&&a.to===b.to&&a.currency===b.currency&&!!a.closedPeriod===!!b.closedPeriod;}
function validValues(x){return plain(x)&&['revenue','processingFee','advertising','software','includedCash'].every(key=>Number.isSafeInteger(x[key]))&&Object.keys(x).length===5;}
function validRetained(x,c,scope){return plain(x)&&x.connectionId===c.id&&x.tenantId===c.tenantId&&x.state==='supported'&&sameScope(x.scope,scope)&&validValues(x.evidence?.values??x.values);}
function validFingerprint(x){return typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);}
function plain(x){return x!==null&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype;}
function str(x){return typeof x==='string'&&x.trim()!=='';}
function date(x){return typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(`${x}T00:00:00Z`).toISOString().slice(0,10)===x;}
function timestamp(x){return typeof x==='string'&&Number.isFinite(Date.parse(x));}
const freezeScope=x=>Object.freeze({...x});const freezeValues=x=>Object.freeze({...x});
