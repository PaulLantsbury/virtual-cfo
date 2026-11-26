/** Offline fictional evidence only. No authentication, model, network or storage adapter. */
import { createHash } from 'node:crypto';
import { calculateProfitEvidence, PROFIT_EVIDENCE_VERSION } from '../financial-v1/profit-evidence.mjs';
import { cashPosition } from '../financial-v1/calculations.mjs';
import { FICTIONAL_SCOPE, REVIEW_DATE } from './fixtures.mjs';
export { FICTIONAL_SCOPE, REVIEW_DATE };
export const QUESTION_IDS=Object.freeze(['briefing','profit-change','marketing-spend','cash']);
const packets=new WeakSet();
const LABEL='Offline deterministic prototype — fictional company; no ChatGPT service connected.';
const keys=['netProductSales','netShipping','cogs','variableCosts','advertising','overheads','da','grossProfit','contributionBeforeMarketing','contribution','operatingProfit','ebitda'];
function ensure(ok){if(!ok)throw new Error('Invalid offline evidence contract');}
function plain(value,seen=new Set()){
 if(value===null||typeof value==='boolean'||typeof value==='string')return;
 if(typeof value==='number'){ensure(Number.isSafeInteger(value));return;}
 ensure(typeof value==='object'&&!seen.has(value));seen.add(value);
 ensure(Array.isArray(value)?Object.getPrototypeOf(value)===Array.prototype:Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
 ensure(Object.getOwnPropertySymbols(value).length===0);
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Array.isArray(value))ensure(Object.keys(value).length===value.length);
 for(const [key,descriptor] of Object.entries(descriptors)){if(key==='length'&&Array.isArray(value))continue;ensure('value'in descriptor&&descriptor.enumerable);plain(descriptor.value,seen);}
 seen.delete(value);
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function monthEnd(from){return new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),0)).toISOString().slice(0,10);}
function fullMonth(p){return p&&validDate(p.from)&&p.from.endsWith('-01')&&p.to===monthEnd(p.from);}
function id(value){return typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);}
function instant(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value.replace('Z','.000Z');}
function scopeMatches(a,b){return Object.keys(FICTIONAL_SCOPE).every(key=>a?.[key]===b?.[key]);}
function previousMonth(from){return new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7))-2,1)).toISOString().slice(0,10);}
function finalise(packet){freeze(packet);packets.add(packet);return packet;}
function withheld(reason){return finalise({version:'cfo-offline-v1',label:LABEL,status:'withheld',reason,current:null,prior:null,change:null,cash:null,sources:{}});}
function periodPacket(input,p,name,digest,request){
 ensure(fullMonth(p)&&p.to<request.asOf&&p.dataThrough===p.to&&instant(p.observedAt)&&p.observedAt.slice(0,10)<=request.asOf&&p.observedAt.slice(0,10)>p.to);
 ensure(['current','stale','invalidated'].includes(p.freshness)&&id(p.reportVersion)&&id(p.sourceVersion)&&id(p.formulaVersion));
 ensure(p.profitInput?.version===p.formulaVersion&&p.formulaVersion===PROFIT_EVIDENCE_VERSION);
 ensure(p.profitInput?.snapshotId===p.reportVersion&&p.profitInput?.costEvidence?.revision===p.sourceVersion);
 ensure(p.profitInput?.scope?.storeId===input.storeId&&p.profitInput?.scope?.currency===input.currency&&p.profitInput?.scope?.from===p.from&&p.profitInput?.scope?.to===p.to);
 const result=calculateProfitEvidence(p.profitInput);
 const root=`#/sources/${digest}/${name}/profitInput`;
 const metrics={};
 for(const key of keys){
  const r=key==='netProductSales'||key==='netShipping'?{value:result.sales?.[key]??null}:result[key];
  const value=r?.value??null;ensure(value===null||Number.isSafeInteger(value));
  metrics[key]={value,state:value===null?'unavailable':'supported',evidenceRef:root};
 }
 return {provenance:{...FICTIONAL_SCOPE,from:p.from,to:p.to,reportVersion:p.reportVersion,sourceVersion:p.sourceVersion,formulaVersion:p.formulaVersion,observedAt:p.observedAt,dataThrough:p.dataThrough},freshness:p.freshness,metrics};
}
export function createEvidencePacket(input,request){
 plain(input);plain(request);
 ensure(input&&request&&input.fictional===true&&['allowed','denied'].includes(input.access));
 ensure(Object.keys(input).every(k=>[...Object.keys(FICTIONAL_SCOPE),'fictional','access','current','prior','cash'].includes(k)));
 ensure(Object.keys(request).every(k=>[...Object.keys(FICTIONAL_SCOPE),'from','to','asOf'].includes(k)));
 ensure(validDate(request.asOf)&&fullMonth(request));
 if(input.access==='denied')return withheld('access-denied');
 if(!scopeMatches(input,FICTIONAL_SCOPE)||!scopeMatches(input,request)||input.current?.from!==request.from||input.current?.to!==request.to)return withheld('scope-mismatch');
 if(input.current?.freshness==='invalidated')return withheld('source-invalidated');
 if(input.current?.formulaVersion!==PROFIT_EVIDENCE_VERSION)return withheld('formula-unavailable');
 // The bounded fixture is the latest complete month at the declared review date.
 const latest=previousMonth(`${request.asOf.slice(0,7)}-01`);
 if(request.from!==latest)return withheld('period-unavailable');
 const snapshot=JSON.parse(JSON.stringify(input));
 const digest=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 const current=periodPacket(snapshot,snapshot.current,'current',digest,request);
 let prior=null;
 if(snapshot.prior&&snapshot.prior.from===previousMonth(current.provenance.from)&&snapshot.prior.formulaVersion===PROFIT_EVIDENCE_VERSION&&snapshot.prior.freshness==='current'){
  try{prior=periodPacket(snapshot,snapshot.prior,'prior',digest,request);}catch{/* Invalid comparison cannot erase independent current evidence. */}
 }
 const changeValue=current.freshness==='current'&&prior&&current.metrics.operatingProfit.value!==null&&prior.metrics.operatingProfit.value!==null?current.metrics.operatingProfit.value-prior.metrics.operatingProfit.value:null;
 ensure(changeValue===null||Number.isSafeInteger(changeValue));
 const change={value:changeValue,metricRefs:['#/current/metrics/operatingProfit','#/prior/metrics/operatingProfit'],reason:changeValue===null?'Comparable current supported operating profit is unavailable.':null};
 let cash=null;
 if(current.freshness==='current'&&snapshot.cash&&scopeMatches(snapshot.cash,snapshot)&&snapshot.cash.asOf===current.provenance.to&&id(snapshot.cash.sourceVersion)){
  try{cash={...cashPosition(snapshot.cash),sourceVersion:snapshot.cash.sourceVersion,evidenceRef:`#/sources/${digest}/cash`};}catch{/* Incomplete cash does not suppress trading. */}
 }
 return finalise({version:'cfo-offline-v1',label:LABEL,status:current.freshness==='stale'?'stale':'ready',reason:null,companyName:'Fictional Northbridge Home Ltd',reviewDate:request.asOf,current,prior,change,cash,sources:{[digest]:snapshot}});
}
function money(pence){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(pence/100);}
function metricClaim(packet,metric,period='current'){
 const value=packet[period]?.metrics[metric]?.value;
 if(value===null||value===undefined)return null;
 return {metricRef:`#/${period}/metrics/${metric}`,value,evidenceRef:packet[period].metrics[metric].evidenceRef};
}
export function renderNarrative(packet,questionId='briefing'){
 ensure(packets.has(packet)&&QUESTION_IDS.includes(questionId));
 const claims=[];const statements=[];
 const emit=(metric,label)=>{const claim=metricClaim(packet,metric);if(claim){claims.push(claim);statements.push(`${label}: ${money(claim.value)}.`);}else statements.push(`${label}: unavailable because required evidence is missing or incompatible.`);};
 if(packet.status==='withheld')statements.push('This scope is unavailable. No previous company figures or advice are shown.');
 else{
  const p=packet.current.provenance;
  statements.push(`Fictional Northbridge Home Ltd | ${p.companyId} | ${p.storeId} | ${p.currency} | ${p.timeZone} | ${p.from} to ${p.to} | report ${p.reportVersion} | source ${p.sourceVersion} | formula ${p.formulaVersion}.`);
  statements.push(`Evidence observed ${p.observedAt}; data through ${p.dataThrough}.`);
  if(packet.status==='stale')statements.push('Stale: last available same-scope figures may be out of date. No new comparison or spending advice is generated.');
  if(questionId==='briefing'||questionId==='profit-change'){
   emit('netProductSales','Net product sales excluding VAT and shipping');emit('grossProfit','Gross profit');emit('contribution','Contribution after marketing');emit('overheads','Operating overheads including depreciation and amortisation');emit('operatingProfit','Operating profit');
   if(packet.change.value!==null){const before=metricClaim(packet,'operatingProfit','prior');claims.push(before,{metricRef:'#/change',value:packet.change.value,evidenceRef:packet.change.metricRefs});statements.push(`Prior period ${packet.prior.provenance.from} to ${packet.prior.provenance.to} (report ${packet.prior.provenance.reportVersion}, source ${packet.prior.provenance.sourceVersion}, formula ${packet.prior.provenance.formulaVersion}; observed ${packet.prior.provenance.observedAt}, data through ${packet.prior.provenance.dataThrough}) operating profit: ${money(before.value)}. Arithmetic change: ${money(packet.change.value)}. This describes a difference, not its business cause.`);}else statements.push('Profit comparison withheld: comparable current supported periods are unavailable.');
  }
  if(questionId==='briefing'||questionId==='marketing-spend'){
   emit('advertising','Advertising deducted once in contribution');
   if(questionId==='marketing-spend')emit('contribution','Contribution after marketing');
   statements.push('A marketing-spend increase is not supported by this packet. It has no validated response assumptions or approved spending headroom; profit is not bank cash. No channel switch, uplift, ranking or action is prescribed.');
  }
  if(questionId==='briefing'||questionId==='cash'){
   if(packet.cash){claims.push({metricRef:'#/cash/availableCash',value:packet.cash.availableCash,evidenceRef:packet.cash.evidenceRef});statements.push(`Dated unrestricted cash at ${packet.cash.asOf}: ${money(packet.cash.availableCash)}. Unsettled balances are excluded. This is a balance, not spending headroom.`);}else statements.push('Cash position unavailable: dated eligible bank/payment balances are missing, stale or incompatible. Profit is not a substitute for cash.');
   statements.push('Runway withheld: three complete reviewed months of actual net cash burn are not supplied.');
  }
 }
 return freeze({label:LABEL,questionId,status:packet.status,statements,claims});
}
/** Exact canonical contract, not keyword filtering: invented claims or edits fail. */
export function validateNarrative(packet,narrative){
 try{plain(narrative);return packets.has(packet)&&QUESTION_IDS.includes(narrative.questionId)&&JSON.stringify(renderNarrative(packet,narrative.questionId))===JSON.stringify(narrative);}catch{return false;}
}
