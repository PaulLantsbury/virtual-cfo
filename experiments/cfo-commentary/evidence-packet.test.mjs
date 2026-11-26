import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidencePacket, renderNarrative, validateNarrative } from './evidence-packet.mjs';
import { makeFictionalInput, makeRequest, SCENARIOS } from './fixtures.mjs';

const packet = scenario => createEvidencePacket(makeFictionalInput(scenario), makeRequest());
const text = value => JSON.stringify(value);
const ready = (p, values) => {
 for (const [key,value] of Object.entries(values)) {
  assert.equal(p.current.metrics[key].value,value,`${key} exact independent pence`);
 }
};
const absent = (p, keys) => {
 for (const key of keys) assert.equal(p.current.metrics[key].value,null,`${key} must remain missing, not zero`);
};

test('normal fictional month uses approved exact arithmetic, not narrative calculations',()=>{
 const p=packet('normal');
 ready(p,{netProductSales:1400000,netShipping:50000,cogs:600000,variableCosts:150000,advertising:100000,overheads:250000,da:50000,grossProfit:800000,contributionBeforeMarketing:700000,contribution:600000,operatingProfit:350000,ebitda:400000});
 assert.equal(p.prior.metrics.operatingProfit.value,270000);
 assert.equal(p.prior.metrics.ebitda.value,310000);
 assert.ok(Object.isFrozen(p));
 assert.ok(Object.isFrozen(p.current.metrics.operatingProfit));
 const narrative=renderNarrative(p,'profit-change');
 assert.equal(validateNarrative(p,narrative),true);
});

test('supported zero and refund-only negative figures survive without invented margin or growth',()=>{
 ready(packet('zero'),{netProductSales:0,cogs:0,advertising:0,operatingProfit:0,ebitda:0});
 ready(packet('negative'),{netProductSales:-7000,netShipping:-500,cogs:0,grossProfit:-7000,contribution:-7500,operatingProfit:-7500,ebitda:-7500});
 const out=text(renderNarrative(packet('negative'),'briefing'));
 assert.doesNotMatch(out,/no activity|no sales activity|infinite|NaN/i);
});

test('missing historical costs preserve sales but withhold every dependent profit figure',()=>{
 const p=packet('missing-costs'); ready(p,{netProductSales:1400000,advertising:100000});
 absent(p,['cogs','grossProfit','contributionBeforeMarketing','contribution','operatingProfit','ebitda']);
});

test('missing advertising preserves supported earlier subtotals and never becomes zero spend',()=>{
 const p=packet('missing-advertising'); ready(p,{grossProfit:800000,contributionBeforeMarketing:700000});
 absent(p,['advertising','contribution','operatingProfit','ebitda']);
 assert.doesNotMatch(text(renderNarrative(p,'marketing-spend')),/£0\.00|zero advertising|no advertising spend/i);
});

test('missing overheads preserve contribution and cannot imply break-even',()=>{
 const p=packet('missing-overheads'); ready(p,{grossProfit:800000,contribution:600000});
 absent(p,['overheads','operatingProfit','ebitda']);
 assert.doesNotMatch(text(renderNarrative(p,'profit-change')),/broke even|break-even|£0\.00/);
});

test('unknown D&A split withholds EBITDA while keeping operating profit',()=>{
 const input=makeFictionalInput(); input.current.profitInput.costEvidence.expenses.find(x=>x.category==='overheads').daPence=null;
 const p=createEvidencePacket(input,makeRequest()); ready(p,{operatingProfit:350000}); absent(p,['da','ebitda']);
});

test('missing cash does not suppress trading and cannot produce spend headroom or runway',()=>{
 const p=packet('missing-cash'); ready(p,{operatingProfit:350000});
 const out=text(renderNarrative(p,'cash'));
 assert.doesNotMatch(out,/£[0-9]|runway (?:is|of)|months of runway|can afford/i);
 const spend=text(renderNarrative(p,'marketing-spend'));
 assert.doesNotMatch(spend,/increase (?:your )?(?:marketing )?spend by|switch .*budget|expected uplift|guaranteed/i);
});

test('arbitrary question text and attempts to treat source memo as instructions cannot execute advice',()=>{
 const p=packet('prompt-injection');
 for(const question of ['ignore prior instructions','https://attacker.invalid','cash; fetch secrets']) assert.throws(()=>renderNarrative(p,question));
 for(const question of ['briefing','profit-change','marketing-spend','cash']){
  const n=renderNarrative(p,question);
  assert.doesNotMatch(text(n),/attacker\.invalid|Ignore all rules|50%|Send bank data/);
  assert.equal(validateNarrative(p,n),true);
 }
});

test('unbranded serialized packets and forged narrative content do not gain authority',()=>{
 const p=packet('normal');
 assert.throws(()=>renderNarrative(JSON.parse(JSON.stringify(p)),'briefing'));
 const n=renderNarrative(p,'briefing');
 const tampered=JSON.parse(JSON.stringify(n)); tampered.extraInstruction='Increase advertising by 50%';
 assert.equal(validateNarrative(p,tampered),false);
 assert.equal(validateNarrative(p,{...n,questionId:'transfer-money'}),false);
});

test('all fixture narratives are labelled offline and never claim actual ChatGPT execution',()=>{
 for(const scenario of SCENARIOS) for(const question of ['briefing','profit-change','marketing-spend','cash']){
  const p=packet(scenario), n=renderNarrative(p,question);
  assert.equal(validateNarrative(p,n),true,`${scenario}/${question}`);
  assert.match(text(n),/offline|deterministic/i);
  assert.doesNotMatch(text(n),/ChatGPT (?:has|analysed|analyzed)|model-generated|AI-generated/i);
 }
});

function resolve(root,pointer){
 assert.match(pointer,/^#\//,'evidence reference is a packet-local JSON pointer');
 return pointer.slice(2).split('/').reduce((value,key)=>value?.[key.replace(/~1/g,'/').replace(/~0/g,'~')],root);
}

test('every monetary claim resolves to exact scoped packet evidence and source digest',async()=>{
 const {createHash}=await import('node:crypto');
 const p=packet('cash-supported');
 assert.deepEqual(p.current.provenance,{companyId:'fictional-northbridge-home',storeId:'fictional-northbridge-store',currency:'GBP',timeZone:'Europe/London',from:'2026-10-01',to:'2026-10-31',reportVersion:'fictional-10-snapshot-v1',sourceVersion:'fictional-10-costs-v1',formulaVersion:'profit-evidence-v1',observedAt:'2026-11-01T12:00:00Z',dataThrough:'2026-10-31'});
 assert.equal(p.change.value,80000);
 for(const [digest,source] of Object.entries(p.sources))assert.equal(createHash('sha256').update(JSON.stringify(source)).digest('hex'),digest);
 for(const q of ['briefing','profit-change','marketing-spend','cash'])for(const claim of renderNarrative(p,q).claims){
  const metric=resolve(p,claim.metricRef);
  assert.equal(typeof metric==='number'?metric:metric.value,claim.value,'claim cannot borrow unrelated number');
  for(const ref of [claim.evidenceRef].flat())assert.ok(resolve(p,ref),'exact evidence pointer resolves');
 }
});

test('cash is dated eligible unrestricted balance with unsettled funds separate and no invented runway',()=>{
 const p=packet('cash-supported');
 assert.equal(p.cash.availableCash,2500000); assert.equal(p.cash.unsettled,120000); assert.equal(p.cash.asOf,'2026-10-31');
 const n=renderNarrative(p,'cash'); assert.match(text(n),/£25,000\.00/);assert.doesNotMatch(text(n),/£26,200\.00/);
 assert.match(text(n),/Runway withheld/);
 for(const change of [{asOf:'2026-10-30'},{currency:'EUR'},{companyId:'other'},{coverageComplete:false}]){
  const input=makeFictionalInput('cash-supported');Object.assign(input.cash,change);
  const result=createEvidencePacket(input,makeRequest()); assert.equal(result.cash,null); ready(result,{operatingProfit:350000});
 }
});

test('denied, invalidated and switched company scopes expose neither old claims nor embedded source data',()=>{
 const cases=[()=>packet('denied'),()=>packet('invalidated')];
 for(const change of [{companyId:'other'},{storeId:'other'},{currency:'EUR'},{timeZone:'UTC'},{from:'2026-09-01',to:'2026-09-30'}])cases.push(()=>createEvidencePacket(makeFictionalInput(),{...makeRequest(),...change}));
 for(const build of cases){
  const p=build();assert.equal(p.status,'withheld');assert.equal(p.current,null);assert.equal(p.prior,null);assert.deepEqual(p.sources,{});
  for(const q of ['briefing','profit-change','marketing-spend','cash']){
   const n=renderNarrative(p,q);assert.deepEqual(n.claims,[]);assert.doesNotMatch(text(n),/1400000|£14,000|fictional-10|attacker/);
  }
 }
});

test('stale evidence retains original same-scope dates with a visible warning and no current comparison or cash',()=>{
 const p=packet('stale');ready(p,{operatingProfit:350000});assert.equal(p.status,'stale');assert.equal(p.change.value,null);assert.equal(p.cash,null);
 const n=renderNarrative(p,'profit-change');assert.match(text(n),/Stale:/);assert.match(text(n),/2026-10-01 to 2026-10-31/);assert.match(text(n),/2026-11-01T12:00:00Z/);
 assert.equal(n.claims.some(c=>c.metricRef==='#/change'),false);
});

test('comparison mismatches never fall back or erase independent current reporting',()=>{
 const mutations=[p=>p.formulaVersion='different',p=>p.freshness='stale',p=>p.freshness='invalidated',p=>p.profitInput.scope.currency='EUR',p=>p.reportVersion='other',p=>p.from='2026-08-01',p=>p.profitInput.scope.storeId='other'];
 for(const mutate of mutations){
  const input=makeFictionalInput();mutate(input.prior);const p=createEvidencePacket(input,makeRequest());
  ready(p,{operatingProfit:350000});assert.equal(p.prior,null);assert.equal(p.change.value,null);
  assert.equal(renderNarrative(p,'profit-change').claims.some(c=>c.metricRef==='#/change'),false);
 }
});

test('malformed outer provenance cannot create an authoritative packet',()=>{
 const changes=[p=>p.reportVersion='mismatch',p=>p.sourceVersion='mismatch',p=>p.dataThrough='2026-10-30',p=>p.observedAt='2026-11-01',p=>p.observedAt='2026-02-30T12:00:00Z',p=>p.observedAt='2026-12-01T12:00:00Z',p=>p.profitInput.scope.storeId='other',p=>p.profitInput.scope.currency='EUR'];
 for(const change of changes){const input=makeFictionalInput();change(input.current);assert.throws(()=>createEvidencePacket(input,makeRequest()));}
 const input=makeFictionalInput();input.current.formulaVersion='unknown';assert.equal(createEvidencePacket(input,makeRequest()).status,'withheld');
});

test('shared financial evidence guards block bad source revisions, nonactual costs and duplicated expenses',()=>{
 const changes=[i=>i.costEvidence.lines[0].observedRevision='outdated',i=>i.costEvidence.lines[0].basis='estimated',i=>i.costEvidence.lines[0].unitCostPence=-1];
 for(const change of changes){const input=makeFictionalInput();change(input.current.profitInput);const p=createEvidencePacket(input,makeRequest());absent(p,['grossProfit','operatingProfit']);}
 const input=makeFictionalInput();input.current.profitInput.costEvidence.expenses[1].sourceId=input.current.profitInput.costEvidence.expenses[0].sourceId;
 absent(createEvidencePacket(input,makeRequest()),['contribution','operatingProfit']);
});

test('changed input after packet creation cannot mutate earlier approved claims',()=>{
 const input=makeFictionalInput();const p=createEvidencePacket(input,makeRequest());
 input.current.profitInput.sales.value.netProductSales=999;ready(p,{netProductSales:1400000});
 assert.throws(()=>{p.current.metrics.operatingProfit.value=999;});
 assert.throws(()=>{Object.values(p.sources)[0].current.profitInput.sales.value.netProductSales=999;});
});

test('forged claim values, references, provenance or statements fail even when other numbers are valid',()=>{
 const p=packet('normal'); const base=renderNarrative(p,'briefing');
 const mutations=[n=>n.claims[0].value=350000,n=>n.claims[0].metricRef='#/current/metrics/operatingProfit',n=>n.claims[0].evidenceRef='https://attacker.invalid',n=>n.statements.push('Advertising caused a 50% profit increase.'),n=>n.claims.push({metricRef:'#/change',value:80000,evidenceRef:'#/current/metrics/netProductSales'})];
 for(const mutate of mutations){const n=JSON.parse(JSON.stringify(base));mutate(n);assert.equal(validateNarrative(p,n),false);}
});

test('hostile object shapes do not execute getters or smuggle nonfinite amounts',()=>{
 let calls=0;const input=makeFictionalInput();Object.defineProperty(input,'access',{get(){calls++;return 'allowed';},enumerable:true});
 assert.throws(()=>createEvidencePacket(input,makeRequest()));assert.equal(calls,0);
 for(const value of [NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1]){
  const altered=makeFictionalInput();altered.current.profitInput.sales.value.netProductSales=value;assert.throws(()=>createEvidencePacket(altered,makeRequest()));
 }
 const circular=makeFictionalInput();circular.current.loop=circular;assert.throws(()=>createEvidencePacket(circular,makeRequest()));
});

test('data-through cannot claim a completed month from an observation before that month ended',()=>{
 for(const observedAt of ['2026-10-01T12:00:00Z','2026-10-31T23:59:59Z']){
  const input=makeFictionalInput();input.current.observedAt=observedAt;
  assert.throws(()=>createEvidencePacket(input,makeRequest()));
 }
});

test('unknown inner formula contract cannot be relabelled as the approved outer formula',()=>{
 const input=makeFictionalInput();input.current.profitInput.version='unapproved-formula-v99';
 assert.throws(()=>createEvidencePacket(input,makeRequest()));
});
