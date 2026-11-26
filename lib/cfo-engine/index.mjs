import { calculateProfitEvidence, PROFIT_EVIDENCE_VERSION } from '../../experiments/financial-v1/profit-evidence.mjs';
const contexts = new WeakSet();
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
// Inspect descriptors before reading values: caller accessors are never executed.
function json(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  if (Object.getPrototypeOf(value) !== (Array.isArray(value) ? Array.prototype : Object.prototype)) return false;
  seen.add(value);
  const keys = Reflect.ownKeys(value);
  if (Array.isArray(value) && keys.length !== value.length + 1) return false;
  return keys.every(key => { const d = Object.getOwnPropertyDescriptor(value, key); return typeof key === 'string' && 'value' in d && (d.enumerable || (Array.isArray(value) && key === 'length')) && json(d.value, seen); });
}
const clone = value => JSON.parse(JSON.stringify(value));
const nonempty = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const identifier = value => nonempty(value) && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const scopeKeys = ['companyId','storeId','currency','timeZone','selectionVersion','from','to'];
const sameScope = (a,b) => scopeKeys.every(key => a?.[key] === b?.[key]);
function month(from,to) { return date(from) && date(to) && from.endsWith('-01') && new Date(Date.UTC(+from.slice(0,4),+from.slice(5,7),0)).toISOString().slice(0,10) === to; }
function previous(scope) { const d = new Date(`${scope.from}T00:00:00Z`); return { ...scope, from: new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)).toISOString().slice(0,10), to: new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),0)).toISOString().slice(0,10) }; }
export const POLICY_VERSION = freeze({version:'cfo-guardrails-core-v1',document:'docs/cfo-guardrails-core-v1-2026-11-26.md',commit:'b675ede2e6028e5891ef7e179ee391447f5133d0',blob:'b3affd81ca7b353e112e9d70272494942af81c72',sha256:'683b348dff7e03ae7befac60dbccb0fdfca9d3edcbeeff345a76c6255dfce768'});
export const RULES = freeze([
 {id:'context',title:'Selected company, store, period and version must match',section:'1, 10',coverage:'automated-gate',limitation:'Authorization and source truth require a trusted adapter.'},
 {id:'calculation',title:'Facts use the shared approved financial definitions',section:'1, 4',coverage:'automated-gate',limitation:'Monthly profit and two approved margins only; no inferred missing costs.'},
 {id:'comparison',title:'Comparable periods before arithmetic change',section:'2, 4',coverage:'automated-gate',limitation:'Previous complete calendar month only; arithmetic is not causality.'},
 {id:'freshness',title:'Stale evidence supports dated facts only',section:'2, 10',coverage:'automated-gate',limitation:'Freshness classification remains adapter-owned; invalidated evidence clears context.'},
 {id:'ladder',title:'Separate fact, arithmetic, investigation, test and human judgment',section:'2',coverage:'automated-gate',limitation:'No causal claims or executable commercial recommendations.'},
 {id:'commercial-review',title:'Economics, downside, owner and review before action',section:'2, 5, 6, 9',coverage:'adapter-required',limitation:'Reference strings alone cannot prove the evidence or authorize a test.'},
 {id:'source-authority',title:'Authorized complete source evidence',section:'1, 10',coverage:'adapter-required',limitation:'Offline validation cannot authenticate caller records or establish actual provider completeness.'},
 {id:'customer',title:'Customer and cohort interpretations need their evidence',section:'7',coverage:'unsupported',limitation:'Attribution, cohort and customer rules are not implemented; unresolved definitions stay unresolved.'},
 {id:'cash',title:'Cash and runway require separate dated evidence',section:'8',coverage:'unsupported',limitation:'No cash advice, runway or burn edge-case defaults in this slice.'},
 {id:'forecast',title:'Scenarios and opportunities remain conditional',section:'3, 9, 11, 12',coverage:'unsupported',limitation:'No forecast, benchmarks, targets, numeric policy defaults or model-generated prose.'}
]);
export const COVERAGE = freeze({policyVersion:POLICY_VERSION.version,rules:RULES,families:RULES.map(r=>({family:r.title,coverage:r.coverage,ruleIds:[r.id]}))});
const labels = {netProductSales:'Net product sales',netShipping:'Net shipping',revenue:'Revenue denominator',cogs:'Cost of goods sold',variableCosts:'Variable costs',advertising:'Advertising',overheads:'Overheads',da:'Depreciation and amortisation',grossProfit:'Gross profit',contributionBeforeMarketing:'Contribution before marketing',contribution:'Contribution',operatingProfit:'Operating profit',ebitda:'EBITDA',orders:'Original orders',contributionMargin:'Contribution margin',operatingMargin:'Operating margin'};
const ratios = {contributionMargin:'contribution',operatingMargin:'operatingProfit'};
function calculatedValue(result,key) { if (key === 'orders') return result.sales?.originalOrders ?? null; if (key === 'netProductSales' || key === 'netShipping') return result.sales?.[key] ?? null; return result[key === 'revenue' ? 'revenueDenominator' : key]?.value ?? null; }
function finish(context) { freeze(context); contexts.add(context); return context; }
function withheld(reason) { return finish({status:'withheld',reason,scope:null,mode:null,sources:[],metrics:[],testPlan:null}); }
export function createEvidenceContext(raw, expected) {
 try {
  if (!json(raw) || !json(expected)) return withheld('Malformed evidence or request.');
  if (expected.access !== 'allowed') return withheld('Access denied.');
  const input = clone(raw);
  if (input.schemaVersion !== 'cfo-evidence-v1' || !['fictional','reviewed'].includes(input.mode) || !['current','stale','invalidated'].includes(input.freshness)) return withheld('Unknown evidence contract.');
  if (input.freshness === 'invalidated') return withheld('Evidence invalidated.');
  if (!sameScope(input.scope,expected) || !scopeKeys.every(k=>nonempty(expected[k])) || !month(expected.from,expected.to) || !date(expected.asOf) || expected.to >= expected.asOf || expected.formulaVersion !== PROFIT_EVIDENCE_VERSION) return withheld('Selected context does not match supported evidence.');
  new Intl.DateTimeFormat('en',{timeZone:expected.timeZone});
  if (!Array.isArray(input.sources) || !Array.isArray(input.metrics) || !Object.hasOwn(input,'testPlan')) return withheld('Missing evidence lists.');
  const sources = new Map(), computed = new Map();
  for (const s of input.sources) {
   if (!identifier(s.id) || sources.has(s.id)) return withheld('Missing or duplicate source ID.');
   sources.set(s.id,s);
   const scope = s.from === expected.from ? input.scope : previous(input.scope);
   if (!sameScope(s.scope,scope) || s.from !== scope.from || s.to !== scope.to || !identifier(s.ref) || !identifier(s.reportVersion) || !identifier(s.sourceVersion) || s.formulaVersion !== expected.formulaVersion || s.dataThrough !== s.to || !Number.isFinite(Date.parse(s.observedAt)) || s.observedAt.slice(0,10) > expected.asOf || s.observedAt.slice(0,10) < s.to) continue;
   const p = s.profitInput;
   if (!p || p.version !== s.formulaVersion || p.snapshotId !== s.reportVersion || p.costEvidence?.revision !== s.sourceVersion || !['storeId','currency','from','to'].every(k=>p.scope?.[k]===scope[k])) continue;
   if ([...computed.keys()].some(id=>sources.get(id).from===s.from)) return withheld('Multiple source snapshots for one period are not supported.');
   computed.set(s.id,calculateProfitEvidence(p));
  }
  const ids = new Set(), pairs = new Set();
  for (const m of input.metrics) {
   const pair = `${m.period}:${m.key}`;
   if (!identifier(m.id) || ids.has(m.id) || pairs.has(pair) || !['current','prior'].includes(m.period)) return withheld('Duplicate or malformed metric identity.');
   ids.add(m.id); pairs.add(pair);
   const s=sources.get(m.sourceId), r=computed.get(m.sourceId), unit = m.key === 'orders' ? 'count' : Object.hasOwn(ratios,m.key) ? 'ratio' : 'pence';
   const valid = Object.hasOwn(labels,m.key) && r && s.from === (m.period === 'current' ? expected.from : previous(expected).from) && m.unit === unit;
   const derived = valid ? calculatedValue(r,m.key) : null;
   if (!valid || derived === null || !Number.isFinite(derived) || m.value !== derived || (unit !== 'ratio' && !Number.isSafeInteger(derived))) m.value=null;
  }
  // Ratios require explicit matching denominator evidence, not just a caller number.
  for (const m of input.metrics.filter(m=>Object.hasOwn(ratios,m.key))) {
   const n=input.metrics.find(x=>x.id===m.numeratorId), d=input.metrics.find(x=>x.id===m.denominatorId);
   if (!n || !d || n.key!==ratios[m.key] || d.key!=='revenue' || [n,d].some(x=>x.sourceId!==m.sourceId || x.period!==m.period || x.value===null) || d.value<=0 || m.value!==n.value/d.value) m.value=null;
  }
  return finish({status:input.freshness==='stale'?'stale':'ready',reason:null,scope:input.scope,mode:input.mode,sources:[...sources.values()].filter(s=>computed.has(s.id)),metrics:input.metrics,testPlan:input.testPlan});
 } catch { return withheld('Evidence validation failed.'); }
}
function result(level,status,text=[],claims=[],ruleIds=[],reason=null) { return freeze({status,level,text,claims,ruleIds,reason,canExecute:false}); }
export function evaluateClaim(context,intent) {
 const level = json(intent) && ['fact','arithmetic','investigation','conditional-test','human-review'].includes(intent?.kind) ? intent.kind : 'fact';
 const block = reason => result(level,'withheld',[],[],['context','ladder'],reason);
 if (!contexts.has(context) || context.status==='withheld') return block('A valid authorized evidence context is required.');
 if (!json(intent) || !['fact','arithmetic','investigation','conditional-test','human-review'].includes(intent?.kind)) return block('Malformed intent.');
 const fields={fact:['kind','metricId'],arithmetic:['kind','currentId','priorId'],investigation:['kind','topic','metricIds'],'conditional-test':['kind','topic','metricIds'],'human-review':['kind','topic','metricIds']}[intent.kind];
 if (!fields || Object.keys(intent).length!==fields.length || !fields.every(k=>Object.hasOwn(intent,k))) return block('Unsupported intent.');
 const get = id=>context.metrics.find(m=>m.id===id && m.value!==null);
 const evidence = ms=>[...new Set(ms.map(m=>context.sources.find(s=>s.id===m.sourceId)?.ref))];
 const prefix=context.mode==='fictional'?'Fictional example. ':'';
 if (level==='fact') {
  const m=get(intent.metricId); if (!m) return block('This measure lacks validated calculation evidence.');
  const s=context.sources.find(s=>s.id===m.sourceId);
  return result(level,'supported',[`${prefix}${labels[m.key]} for ${s.from} to ${s.to}: ${m.value} ${m.unit}.${context.status==='stale'?' Historical evidence is stale; refresh before making decisions.':''}`],[{metricIds:[m.id],value:m.value,unit:m.unit,evidenceRefs:evidence([m])}],['context','calculation','freshness']);
 }
 if (context.status!=='ready') return block('Refresh stale evidence before comparisons or advice.');
 if (level==='arithmetic') {
  const a=get(intent.currentId),b=get(intent.priorId);
  if (!a || !b || a.period!=='current' || b.period!=='prior' || a.key!==b.key || a.unit!==b.unit) return block('Comparable current and prior measures are required.');
  const value=(a.value-b.value)*(a.unit==='ratio'?100:1), unit=a.unit==='ratio'?'percentage-points':a.unit;
  if (!Number.isFinite(value) || (unit!=='percentage-points' && !Number.isSafeInteger(value))) return block('Arithmetic exceeds supported precision.');
  return result(level,'supported',[`${prefix}${labels[a.key]} changed by ${value} ${unit} from the previous calendar month. This arithmetic does not establish a cause.`],[{metricIds:[a.id,b.id],value,unit,evidenceRefs:evidence([a,b])}],['calculation','comparison','ladder']);
 }
 if (!Array.isArray(intent.metricIds) || !intent.metricIds.length || new Set(intent.metricIds).size!==intent.metricIds.length) return block('Evidence measures are required.');
 const ms=intent.metricIds.map(get);
 if (ms.some(m=>!m || m.period!=='current')) return block('Current validated measures are required.');
 const topicKeys={'profit-change':['grossProfit','contribution','operatingProfit','ebitda'],'marketing-economics':['advertising','contribution']};
 if (typeof intent.topic !== 'string' || !Object.hasOwn(topicKeys,intent.topic) || !topicKeys[intent.topic].every(k=>ms.some(m=>m.key===k))) return block('Topic evidence is incomplete or unsupported.');
 if (level==='investigation') return result(level,'supported',[`${prefix}Check the underlying sales and classified costs before attributing a cause. These figures alone do not establish which action will improve results.`],[],['calculation','ladder']);
 return result(level,'requires-human-review',[`${prefix}No commercial action is approved. A human must review the underlying economics, assumptions, downside, measurement, stop rule, owner and review date before a test or decision.`],[],['ladder','commercial-review'],'Substantive plan evidence and approval are not validated by this offline engine.');
}
export function validateClaimResult(context,intent,candidate) {
 try { if (!json(candidate) || !contexts.has(context)) return false; const canonical=evaluateClaim(context,intent); const equal=(a,b)=>{ if (a===b) return true; if (!a || !b || typeof a!=='object' || typeof b!=='object' || Array.isArray(a)!==Array.isArray(b)) return false; const keys=Object.keys(a); return keys.length===Object.keys(b).length && keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k])); }; return equal(canonical,candidate); } catch { return false; }
}
