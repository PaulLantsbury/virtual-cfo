import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createEvidencePacket, renderNarrative, validateNarrative, QUESTION_IDS } from './evidence-packet.mjs';
import { makeFictionalInput, makeRequest, SCENARIOS } from './fixtures.mjs';
const output=new URL('./generated/',import.meta.url);
const examples=SCENARIOS.map(scenario=>{
 const packet=createEvidencePacket(makeFictionalInput(scenario),makeRequest());
 const narratives=QUESTION_IDS.map(id=>renderNarrative(packet,id));
 if(!narratives.every(n=>validateNarrative(packet,n)))throw new Error('Generated narrative failed canonical validation');
 return {scenario,request:makeRequest(),packet,narratives};
});
await mkdir(output,{recursive:true});
await writeFile(new URL('examples.json',output),JSON.stringify(examples,null,2)+'\n');
const names={'normal':'Supported October results','zero':'A supported zero result','negative':'A refund-only loss','missing-costs':'Historical product costs are missing','missing-advertising':'Advertising evidence is missing','missing-overheads':'Overhead evidence is missing','missing-cash':'Bank balances are missing','cash-supported':'A dated cash balance is supported','stale':'The saved figures are stale','invalidated':'The source evidence was withdrawn','denied':'Access is denied','comparison-mismatch':'The comparison is incompatible','prompt-injection':'Source notes contain attempted instructions'};
const questions={'briefing':'October briefing','profit-change':'What changed in profit?','marketing-spend':'Can I increase marketing spend?','cash':'What is my cash position?'};
const lines=['# Fictional CFO briefings','','**Northbridge Home Ltd is fictional. These are deterministic examples, not ChatGPT responses or actual business advice.**','','Review date: 26 November 2026. Reporting month: October 2026, in GBP and Europe/London; comparison: September 2026. No action is executed.','','[Inspect the supporting figures and policy decisions](technical-evidence.md).',''];
for(const example of examples){
 lines.push(`## ${names[example.scenario]}`,'');
 const selected=example.scenario==='normal'?example.narratives:example.narratives.filter(n=>n.questionId==='briefing');
 for(const narrative of selected)lines.push(`### ${questions[narrative.questionId]}`,'',...narrative.statements,'');
}
await writeFile(new URL('sample-briefings.md',output),lines.join('\n').trimEnd()+'\n');
const technical=['# Technical evidence companion','','This companion separates exact metric/source references and shared policy decisions from the plain-English briefings. All evidence is fictional. A coherent digest is not proof of source completeness or access authorisation.',''];
for(const [index,example] of examples.entries()){
 technical.push(`## ${example.scenario}`,'',`Packet: examples.json#/${index}/packet`,'');
 for(const narrative of example.narratives){
  technical.push(`### ${narrative.questionId}`,'');
  for(const claim of narrative.claims)technical.push(`- examples.json#/${index}/packet${claim.metricRef.slice(1)}: ${claim.value} pence; source ${JSON.stringify((Array.isArray(claim.evidenceRef)?claim.evidenceRef:[claim.evidenceRef]).map(ref=>`examples.json#/${index}/packet${ref.slice(1)}`))}`);
  if(narrative.policyDecisions)technical.push('','Shared policy decisions:',...narrative.policyDecisions.map(d=>`- ${JSON.stringify(d)}`));
  technical.push('');
 }
}
await writeFile(new URL('technical-evidence.md',output),technical.join('\n').trimEnd()+'\n');
console.log(`Generated ${examples.length} fictional cases at ${fileURLToPath(output)}`);
