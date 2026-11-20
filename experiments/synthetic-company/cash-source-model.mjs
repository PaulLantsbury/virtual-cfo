/** Offline derived cash proposal. Immutable uk-gifts-v2 journals remain the sole transaction source. */
import {createHash} from 'node:crypto';
import {generate,PROFILE,date,addDays,summarise} from './generator.mjs';
import {amendedExpense} from './history-expense-correction.mjs';
import {profitEvidenceDigest as digest} from '../financial-v1/profit-evidence-reader.mjs';
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const check=(condition,reason)=>{if(!condition)throw Error(reason);};
const total=values=>{check(values.every(Number.isSafeInteger),'Unsafe cash source amount');const v=values.reduce((n,x)=>n+BigInt(x),0n);check(v>=BigInt(Number.MIN_SAFE_INTEGER)&&v<=BigInt(Number.MAX_SAFE_INTEGER),'Cash source sum exceeds integer precision');return Number(v);};
const accounts=['bank','inventory','equipment','equity','processor','product_revenue','shipping_revenue','vat_control','cogs','supplier_payable','accrued_payable','net_payable','payroll_liability','accumulated_depreciation',...['storage','returns','marketing','pickPack','carrier','packaging','premises','software','insurance','utilities','professional','depreciation','processor','salary','employer','pension'].map(k=>'expense:'+k)];
const operatingBankKinds=new Set(['processor_payout','refund','processor_fee','supplier_payment','payroll_payment','payroll_remittance','vat_settlement']);
const categories={stock:['inventory'],debtors:[],providerSettlements:['processor'],supplierCredit:['supplier_payable','accrued_payable'],other:['vat_control','net_payable','payroll_liability']};
export const CASH_SOURCE_VERSION='synthetic-cash-journal-v1';
export const EXISTING_CAPITAL_ASSUMPTION=Object.freeze({bank:6000000,stock:3500000,equipment:2400000,equity:11900000,provenance:'synthetic-capital-assumption'});
/** Explicit capital acknowledgement is mandatory, not a balance inferred from profit. No network or writes. */
export function createSyntheticCashSource(fixture,{openingCapital,observedAt,verifiedExpenseOverlays=[]}={}){
 check(fixture?.from==='2024-11-01'&&fixture?.scope?.company===PROFILE.company&&fixture.scope.profile===PROFILE.version&&fixture.scope.currency==='GBP'&&fixture.scope.timezone==='Europe/London'&&fixture.scope.provenance==='synthetic-local'&&fixture.scope.provider===null,'Only the isolated uk-gifts-v2 synthetic journal is eligible');
 check(openingCapital&&Object.keys(openingCapital).length===Object.keys(EXISTING_CAPITAL_ASSUMPTION).length&&Object.entries(EXISTING_CAPITAL_ASSUMPTION).every(([k,v])=>openingCapital[k]===v),'Explicit existing synthetic capital assumption required; no new funding may be invented');
 check(typeof observedAt==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(observedAt)&&Number.isFinite(Date.parse(observedAt)),'Explicit cash observation timestamp required');
 const {fingerprint,...payload}=fixture;
 check(sha(payload)===fingerprint,'Cash source fixture integrity differs');
 const canonical=generate({asOf:fixture.asOf,from:fixture.from,months:fixture.months,company:fixture.scope.company,profile:fixture.scope.profile});
 check(canonical.fingerprint===fingerprint,'Cash requires the exact immutable source programme, not rehashed edited transactions');
 check(Object.entries(fixture.openingAssumptions).every(([k,v])=>openingCapital[k]===v),'Source opening capital differs');
 fixture=structuredClone(fixture);openingCapital={...openingCapital};
 check(Array.isArray(verifiedExpenseOverlays)&&verifiedExpenseOverlays.length<=64,'Bounded reviewed expense overlay list required');
 const overlayProofs=[],effectiveById=new Map(fixture.events.map(e=>[e.id,e]));
 for(const overlay of verifiedExpenseOverlays){
  check(overlay&&typeof overlay.financialVersionId==='string'&&overlay.financialVersionId.trim()&&overlay.afterBody?.id&&typeof overlay.beforeHash==='string'&&typeof overlay.afterHash==='string','Verified financial-version overlay proof required');
  const before=effectiveById.get(overlay.afterBody.id),after=overlay.afterBody;
  check(before&&before.kind==='expense_accrual'&&digest(before)===overlay.beforeHash&&digest(after)===overlay.afterHash,'Expense overlay predecessor/body hash differs');
  const expense=after.postings?.filter(p=>p.account.startsWith('expense:'));
  check(expense?.length===1&&digest(amendedExpense(before,expense[0].amount))===overlay.afterHash,'Only the exact approved typed expense/VAT/accrual change is eligible');
  check(!overlayProofs.some(p=>p.financialVersionId===overlay.financialVersionId),'Duplicate expense overlay refused');
  effectiveById.set(after.id,structuredClone(after));overlayProofs.push({...structuredClone(overlay),scopeMonth:after.date.slice(0,7)});
 }
 const effectiveEvents=fixture.events.map(e=>effectiveById.get(e.id));
 const opening=fixture.events.filter(e=>e.kind==='opening');check(opening.length===1&&opening[0].date===fixture.from,'Exactly one anchored opening journal required');
 const balances=Object.fromEntries(accounts.map(a=>[a,0])),daily=new Map(),bankLedger=[];const ids=new Set();
 for(let day=fixture.from,index=0;day<=fixture.to;day=addDays(day,1)){
  const before={...balances},events=[];
  while(index<effectiveEvents.length&&effectiveEvents[index].date===day){
   const event=effectiveEvents[index++];check(!ids.has(event.id)&&Array.isArray(event.postings),'Unique complete source journal required');ids.add(event.id);
   check(total(event.postings.map(p=>p.amount))===0,'Unbalanced journal cannot support cash');
   for(const p of event.postings){check(accounts.includes(p.account),'Unclassified account prevents cash publication');balances[p.account]=total([balances[p.account],p.amount]);}
   const bank=total(event.postings.filter(p=>p.account==='bank').map(p=>p.amount));
   if(bank&&event.kind!=='opening'){check(operatingBankKinds.has(event.kind),'Unclassified external bank movement');bankLedger.push({sourceId:event.id+':bank',eventId:event.id,date:day,kind:event.kind,amount:bank,classification:'operating',sourceHash:sha(event)});}
   events.push(event);
  }
  daily.set(day,{before,closing:{...balances},events});
 }
 check(daily.size===fixture.daily.length,'Complete daily journal coverage required');
 const snapshot=Object.freeze({fixtureHash:fingerprint,from:fixture.from,to:fixture.to,profile:PROFILE.version});
 return {snapshot,month({from,to,storeId,now=new Date(),financialVersionId,reviewedEbitda}={}){
  date(from);date(to);check(typeof storeId==='string'&&storeId.trim(),'Explicit synthetic reporting-store binding required');
  const end=new Date(from+'T12:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
  check(from.endsWith('-01')&&end.toISOString().slice(0,10)===to&&from>=fixture.from&&to<=fixture.to,'Only completely covered calendar months are eligible');
  check(Number.isFinite(now.getTime())&&Date.parse(observedAt)<=now.getTime()&&Date.parse(observedAt)>=Date.parse(to+'T23:59:59Z'),'Cash observation must be truthful and after the complete period');
  const rows=[];for(let d=from;d<=to;d=addDays(d,1))rows.push(...daily.get(d).events);
  const trading=rows.filter(e=>e.kind!=='opening');
  const openingBalances={...daily.get(from).before};
  // The opening entry establishes start-of-anchor balances, never period financing or revenue.
  if(from===fixture.from)for(const p of opening[0].postings)openingBalances[p.account]=total([openingBalances[p.account],p.amount]);
  const closing=daily.get(to).closing;
  const movements={};
  for(const [category,sourceAccounts] of Object.entries(categories)){
   movements[category]=trading.flatMap(e=>e.postings.filter(p=>sourceAccounts.includes(p.account)).map(p=>({sourceId:e.id+':working-capital:'+p.account,date:e.date,amount:-p.amount,account:p.account,eventId:e.id})));
   if(!movements[category].length)movements[category]=[{sourceId:`${PROFILE.company}:${CASH_SOURCE_VERSION}:${from}:${category}:verified-zero`,date:to,amount:0,verification:'No matching movements in the complete canonical journal',account:category==='debtors'?'no-credit-debtors-in-prepaid-model':sourceAccounts.join(',')}];
   check(total(movements[category].map(r=>r.amount))===-total(sourceAccounts.map(a=>closing[a]-openingBalances[a])),'Working-capital movement must match independent control-account roll-forward');
  }
  const totals=summarise({daily:trading.map(e=>({date:e.date,metrics:e.metrics}))},from,to);
  const currentOverlays=overlayProofs.filter(p=>p.afterBody.date>=from&&p.afterBody.date<=to);
  if(currentOverlays.length)check(financialVersionId===currentOverlays.at(-1).financialVersionId&&Number.isSafeInteger(reviewedEbitda),'Exact selected correction version and reviewed EBITDA required');
  if(reviewedEbitda!==undefined)check(Number.isSafeInteger(reviewedEbitda)&&reviewedEbitda===totals.ebitda,'Reviewed financial EBITDA differs from effective cash source');
  const wc=Object.fromEntries(Object.entries(movements).map(([k,v])=>[k,total(v.map(r=>r.amount))]));
  const operatingCash=total([totals.ebitda,...Object.values(wc)]);
  const monthBank=bankLedger.filter(r=>r.date>=from&&r.date<=to).map(r=>({...r})),actualBankMovement=total(monthBank.map(r=>r.amount));
  check(operatingCash===actualBankMovement,'EBITDA and explicit working-capital effects must reconcile to independent bank ledger; no balancing plug');
  check(total([openingBalances.bank,actualBankMovement])===closing.bank,'Observed opening and closing bank balances must reconcile');
  check(closing.processor>=0,'Unsettled processor asset cannot be negative');
  const sourcePrefixHash=sha(effectiveEvents.filter(e=>e.date<=to));
  const sourceRevision=sha({version:CASH_SOURCE_VERSION,sourcePrefixHash,from,to,openingBalances,closing,rows:rows.map(e=>({id:e.id,hash:sha(e)}))});
  const mappingVersion=CASH_SOURCE_VERSION;
  const bankMovements=Object.fromEntries(['taxAndInterest','investing','financing','other'].map(k=>[k,[{sourceId:`${PROFILE.company}:${mappingVersion}:${from}:bank-${k}:verified-zero`,date:to,amount:0,verification:'No external bank movements of this classification in the complete canonical journal'}]]));
  const inputs={sourceBasis:'synthetic-model',sourceRevision,mappingVersion,observedAt,
   accounts:[{id:PROFILE.company+':unrestricted-model-bank',included:true,unrestricted:true,opening:{sourceId:`${sourceRevision}:bank-opening`,date:from,amount:openingBalances.bank},closing:{sourceId:`${sourceRevision}:bank-closing`,date:to,amount:closing.bank}}],
   workingCapital:movements,bankMovements,unsettledProviderFunds:{sourceId:`${sourceRevision}:processor-closing`,date:to,amount:closing.processor},
   coverage:{accountsComplete:true,workingCapitalComplete:true,bankMovementsComplete:true,internalTransfersExcluded:true}};
  const evidence={contract:'eligible-cash-v1',storeId,currency:'GBP',timezone:'Europe/London',from,to,state:'reviewed',invalidated:false,sourceRevision,mappingVersion,observedAt,coverage:inputs.coverage,
   accounts:inputs.accounts.map(a=>({id:a.id,included:true,unrestricted:true,openingDate:from,closingDate:to,opening:a.opening.amount,closing:a.closing.amount})),
   ebitda:totals.ebitda,workingCapital:wc,operatingCash,bankMovements:Object.fromEntries(Object.keys(bankMovements).map(k=>[k,0])),unsettledProviderFunds:closing.processor};
  const sourceManifest={contract:CASH_SOURCE_VERSION,state:'prepared-only',sourceBasis:'synthetic-model',company:PROFILE.company,profile:PROFILE.version,storeId,currency:'GBP',timezone:'Europe/London',from,to,anchor:fixture.from,sourceThrough:to,sourceRevision,mappingVersion,observedAt,
   financialVersionId:financialVersionId??null,reviewedEbitda:reviewedEbitda??null,verifiedExpenseOverlays:structuredClone(overlayProofs.filter(p=>p.afterBody.date<=to)),
   openingCapital:{...openingCapital},sourcePrefixHash,sourceRows:rows.map(e=>({id:e.id,date:e.date,kind:e.kind,sha256:sha(e)})),bankSourceIds:monthBank.map(r=>r.sourceId),bankLedgerHash:sha(monthBank),workingCapitalSources:movements,
   openingControlBalances:openingBalances,closingControlBalances:{...closing},bankMovementClassification:'VAT settlements and payroll remittances remain operating; control-account changes include their actual payments. taxAndInterest means corporation tax/interest only, absent from this source. No double counting.',
   accountEligibility:'One fictional unrestricted GBP bank account; model eligibility only, never provider/account certification',financialBinding:'Requires the exact supported monthly financial version and source/cost revisions before any publication; supplied overlays require separate authenticated selected-lineage verification' };
  return {state:'prepared-only',inputs,evidence,sourceManifest,bankLedger:monthBank,reconciliation:{ebitda:totals.ebitda,workingCapital:wc,operatingCash,actualBankMovement,openingBank:openingBalances.bank,closingBank:closing.bank,difference:operatingCash-actualBankMovement},limitations:['Synthetic model only; no live bank feed or provider acceptance.','No corporation-tax accrual/payment, borrowing, dividends, later capital expenditure, reserve or failed payout is invented.','Two weekday payout lag excludes bank holidays; fees are bank charged separately from gross payouts.','Existing opening-cohort refunds remain dated source cash outflows; pre-anchor trading is not reconstructed.','No forecast, safe-spend assertion, auto-seed or P&L/feed modification.']};
 }};
}
