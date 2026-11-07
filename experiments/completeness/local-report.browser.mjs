import {validateReferenceFile} from './validate-reference-file.mjs';
import {compareLedgers} from './compare-ledgers.mjs';
import {eventDay} from '../financial-v1/event-evidence.mjs';
const el=id=>document.getElementById(id),states={reference:null,imported:null},versions={reference:0,imported:0};
const labels={missing_imported_event:'Missing from imported ledger',unexpected_imported_event:'Unexpected imported transaction',duplicate_event:'Duplicate transaction',event_mismatch:'Transaction details differ'};
const fields={orderId:'original order',timestamp:'event time',date:'local date',productExVat:'product excluding VAT',shippingExVat:'shipping excluding VAT',vat:'VAT',cash:'payment/refund'};
function clearResult(){el('result').hidden=true;el('rows').replaceChildren();el('issues').replaceChildren();el('outcome').textContent='';}
function pairing(){const a=states.reference,b=states.imported;let message='Select two valid files to compare.';
 let ready=!!a&&!!b;if(ready){if(['storeId','currency','timezone','from','to'].some(k=>a.scope[k]!==b.scope[k])){message='The files must refer to the same store, currency, timezone and period.';ready=false;}else if(a.evidenceRef===b.evidenceRef){message='Use distinct evidence references. Different labels alone do not prove independent sources.';ready=false;}else message='Both file formats are valid. Ready to compare supplied records.';}
 el('pair-status').textContent=message;el('compare').disabled=!ready;
}
for(const side of ['reference','imported'])el(side+'-file').addEventListener('change',async()=>{
 const current=++versions[side];states[side]=null;clearResult();pairing();const messages=el(side+'-errors');messages.replaceChildren();const file=el(side+'-file').files[0];
 if(!file){el(side+'-status').textContent='No file selected.';return;}
 el(side+'-status').textContent='Checking file locally…';
 try{
 if(file.size>1048576)throw Error('The file exceeds the 1 MiB limit.');
 const contents=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(current!==versions[side])return;
 const result=validateReferenceFile(contents);
 if(!result.ledger){el(side+'-status').textContent='File needs attention. Comparison is blocked.';for(const i of result.issues){const li=document.createElement('li');li.textContent=i.path+': '+i.message;messages.append(li);}}
 else{states[side]=result.ledger;el(side+'-status').textContent='Valid format · '+result.ledger.events.length+' events · '+result.ledger.evidenceRef;}
 }catch{if(current!==versions[side])return;el(side+'-status').textContent='Unable to read this file. Use valid UTF-8 JSON of at most 1 MiB.';}
 if(current===versions[side])pairing();
});
el('clear').addEventListener('click',()=>{for(const side of ['reference','imported']){versions[side]++;states[side]=null;el(side+'-file').value='';el(side+'-errors').replaceChildren();el(side+'-status').textContent='No file selected.';}clearResult();pairing();});
el('compare').addEventListener('click',()=>{
 if(el('compare').disabled)return;clearResult();const reference=states.reference,imported=states.imported,scope=reference.scope;const r=compareLedgers({scope,reference,imported});el('result').hidden=false;
 el('outcome').textContent=r.status==='matched_supplied_evidence'?'Supplied records match':r.status==='differences_found'?'Differences need investigation':'Comparison blocked';
 el('scope').textContent=scope.storeId+' · '+scope.from+' to '+scope.to+' · '+scope.timezone+' · '+scope.currency;
 el('counts').textContent=(r.comparedEvents??0)+' transaction '+(r.comparedEvents===1?'identity':'identities')+' compared · '+r.issues.length+' '+(r.issues.length===1?'issue':'issues')+'. Showing at most 200 identities and 100 issues below.';
 for(const i of r.issues.slice(0,100)){const li=document.createElement('li');li.textContent=(labels[i.kind]||'Comparison blocked')+(i.id?': '+i.type+' '+i.id:'')+(i.fields?' — '+i.fields.map(f=>fields[f]).join(', '):'');el('issues').append(li);}
 if(!r.issues.length){const li=document.createElement('li');li.textContent=r.comparedEvents?'No differences found in supplied records.':'No supplied events fall in this period. This does not prove there was no trading.';el('issues').append(li);}
 if(r.status==='blocked')return;
 const maps=[reference,imported].map(l=>new Map(l.events.map(e=>[JSON.stringify([e.type,e.id]),e])));
 const keys=[...new Set([...maps[0].keys(),...maps[1].keys()])].filter(k=>maps.some(m=>{const e=m.get(k);if(!e)return false;const d=eventDay(e.timestamp,scope.timezone);return d>=scope.from&&d<=scope.to;})).sort();
 const issueMap=new Map();for(const i of r.issues){const k=JSON.stringify([i.type,i.id]);issueMap.set(k,[...(issueMap.get(k)||[]),i]);}
 const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:scope.currency}).format(n/100);
 for(const k of keys.slice(0,200)){const[type,id]=JSON.parse(k),tr=document.createElement('tr');for(const text of [type+' '+id,issueMap.has(k)?issueMap.get(k).map(i=>labels[i.kind]).join('; '):'Matches']){const td=document.createElement('td');td.textContent=text;tr.append(td);}for(const m of maps){const td=document.createElement('td'),e=m.get(k);td.textContent=e?eventDay(e.timestamp,scope.timezone)+' · '+e.orderId+' · Product '+money(e.productExVat)+' · Shipping '+money(e.shippingExVat)+' · VAT '+money(e.vat)+' · Payment/refund '+money(e.cash)+' · Time '+e.timestamp:'Not present';tr.append(td);}el('rows').append(tr);}
});
pairing();
