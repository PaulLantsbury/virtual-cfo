/** Owner-facing synthesis of already validated specialist results. Money is pence.
 * No API, source fallback, spending instruction or forecast is created here. */
export type ScoutTone = 'good' | 'warning' | 'neutral';
export type ScoutAction = { label: string; href: string };
export type ScoutSnapshot = {
  scope: { storeId: string; currency: string; timezone: string; from: string; to: string; versionId: string };
  financial: { sales: number|null; contribution: number|null; ebitda: number|null; overheads: number|null; advertising: number|null; orders: number|null };
  cash?: { operatingCash: number|null; openingBank: number|null; closingBank: number|null; bankMovement: number|null; stock: number|null; debtors: number|null; settlements: number|null; supplierCredit: number|null; otherWorkingCapital: number|null; allocatedToDatedEbitdaAdjustment?:number|null } | null;
  acquisition?: { cac: number|null; firstOrderContribution: number|null; sessions: number|null; purchasingSessions: number|null; newCustomers: number|null; repeatOrders: number|null; repeatRevenue: number|null } | null;
};
export type ScoutOutcome = { id: 'sales'|'contribution'|'ebitda'|'operatingCash'|'bank'; label: string; value: number|null; previous: number|null; delta: number|null; changePct: number|null; note: string; kind: 'flow'|'balance'; asAt?: string; comparisonLabel: string; tone: ScoutTone };
export type ScoutInsight = { id: string; title: string; evidence: string; implication: string; action: ScoutAction; priority: number; tone: ScoutTone; visual: { label: string; value: number }[]; nextStep: string };
const money = (p: number) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(p/100);
const count = (n: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits:0 }).format(n);
const valid = (n: unknown): n is number => typeof n==='number' && Number.isFinite(n) && Math.abs(n)<=Number.MAX_SAFE_INTEGER;
const amount = (n: number|null|undefined) => valid(n) ? n : null;
const delta = (a: number|null,b: number|null) => a!==null && b!==null && valid(a-b) ? a-b : null;
const rate = (a: number|null,b: number|null) => a!==null&&b!==null&&a>=0&&b>0&&a<=b?a/b:null;
const direction = (n: number) => n>0?'higher':n<0?'lower':'unchanged';
const date = (s:string) => /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
function scoped(s:ScoutSnapshot|null|undefined):s is ScoutSnapshot { return !!s&&!!s.scope.storeId&&!!s.scope.versionId&&s.scope.currency==='GBP'&&s.scope.timezone==='Europe/London'&&date(s.scope.from)&&date(s.scope.to)&&s.scope.from<=s.scope.to; }
function checked(s:ScoutSnapshot|null|undefined):ScoutSnapshot|null {
  if(!scoped(s))return null;
  const f=Object.fromEntries(Object.entries(s.financial).map(([k,v])=>[k,Number.isSafeInteger(v)?v:null])) as ScoutSnapshot['financial'];
  if(f.orders!==null&&(!Number.isSafeInteger(f.orders)||f.orders<0))f.orders=null;
  if(f.contribution!==null&&f.overheads!==null&&f.ebitda!==null&&f.contribution-f.overheads!==f.ebitda){f.contribution=null;f.ebitda=null;}
  let cash=s.cash?Object.fromEntries(Object.entries(s.cash).map(([k,v])=>[k,Number.isSafeInteger(v)?v:null])) as NonNullable<ScoutSnapshot['cash']>:null;
  if(cash){
    if(cash.openingBank!==null&&cash.closingBank!==null&&cash.bankMovement!==null&&cash.closingBank-cash.openingBank!==cash.bankMovement)cash=null;
    const wc=cash&&[cash.stock,cash.debtors,cash.settlements,cash.supplierCredit,cash.otherWorkingCapital];
    if(cash&&f.ebitda!==null&&cash.operatingCash!==null&&wc&&wc.every((v):v is number=>v!==null)){
      const timing=cash.allocatedToDatedEbitdaAdjustment===undefined?0:cash.allocatedToDatedEbitdaAdjustment;
      if(!Number.isSafeInteger(timing)||f.ebitda+(timing??0)+wc.reduce((a,b)=>a+b,0)!==cash.operatingCash)cash=null;
    }
  }
  const a=s.acquisition?Object.fromEntries(Object.entries(s.acquisition).map(([k,v])=>[k,amount(v)])) as NonNullable<ScoutSnapshot['acquisition']>:null;
  return {...s,financial:f,cash,acquisition:a};
}
const links={profit:{label:'Review the profit drivers',href:'/profit-engine'},cash:{label:'Review what moved cash',href:'/new-cash-control'},acquisition:{label:'Review acquisition profitability',href:'/new-marketing?tab=acquisition'},conversion:{label:'Review visits and conversion',href:'/new-marketing?tab=conversion'},retention:{label:'Review new and repeat customers',href:'/new-marketing?tab=retention'},evidence:{label:'Choose reviewed evidence',href:'#scout-evidence'}};
/** Fixed decision order, not a confidence score or estimated savings ranking:
 * operating loss, positive-profit/negative-cash, deteriorating economics,
 * acquisition shortfall, other working-capital/customer explanations. */
export function buildScoutOverview(input:{current:ScoutSnapshot|null;previous?:ScoutSnapshot|null;comparisonLabel:string;sample?:boolean}) {
  const current=checked(input.current),candidate=checked(input.previous);
  const previous=current&&candidate&&candidate.scope.storeId===current.scope.storeId&&candidate.scope.currency===current.scope.currency&&candidate.scope.timezone===current.scope.timezone&&candidate.scope.to<current.scope.from?candidate:null;
  const comparisonLabel=previous?input.comparisonLabel:'No supported comparison selected';
  const f=current?.financial,p=previous?.financial,c=current?.cash,pc=previous?.cash;
  const outcomes:ScoutOutcome[]=(['sales','contribution','ebitda','operatingCash','bank'] as const).map(id=>{
    const value=amount(id==='bank'?c?.closingBank:id==='operatingCash'?c?.operatingCash:f?.[id]);
    const old=amount(id==='bank'?c?.openingBank:id==='operatingCash'?pc?.operatingCash:p?.[id]);
    const d=delta(value,old),label=id==='sales'?'Sales':id==='contribution'?'Marketing contribution':id==='ebitda'?'Profit · EBITDA':id==='operatingCash'?'Operating cash generated':'Bank balance';
    const note=id==='sales'?'Net product sales after discounts and refunds; excludes VAT and shipping.':id==='contribution'?'After product, variable and advertising costs; funds overheads first.':id==='ebitda'?'After overheads, excluding depreciation and amortisation.':id==='operatingCash'?'Cash from operations in this reporting period, not bank movement.':'Dated closing balance; not available spending headroom.';
    return {id,label,value,previous:old,delta:d,changePct:d!==null&&old!==null&&old>0?d/old*100:null,note,kind:id==='bank'?'balance':'flow',...(id==='bank'&&current?{asAt:current.scope.to}:{}),comparisonLabel:id==='bank'&&current?'since '+current.scope.from:comparisonLabel,tone:id==='bank'||d===null||d===0?'neutral':d>0?'good':'warning'};
  });
  const insights:ScoutInsight[]=[];
  const salesChange=delta(amount(f?.sales),amount(p?.sales)),contributionChange=delta(amount(f?.contribution),amount(p?.contribution)),profitChange=delta(amount(f?.ebitda),amount(p?.ebitda));
  if(f?.contribution!==null&&f?.contribution!==undefined&&f.overheads!==null&&f.contribution<f.overheads){
    const gap=f.overheads-f.contribution;
    insights.push({id:'overhead-gap',title:'Marketing contribution is not covering overheads.',evidence:`${money(f.contribution)} remains after product, variable and advertising costs, against ${money(f.overheads)} overheads excluding D&A. The gap is ${money(gap)}.`,implication:'The business needs more contribution or lower overheads to break even. Higher sales alone do not resolve this.',action:links.profit,priority:100,tone:'warning',visual:[{label:'Marketing contribution',value:f.contribution},{label:'Overheads to cover',value:f.overheads}],nextStep:'Review the largest contribution and overhead drivers before modelling a change in Plan.'});
  } else if(f?.ebitda!==null&&f?.ebitda!==undefined&&f.ebitda<0){
    insights.push({id:'reported-loss',title:'The selected period made an EBITDA loss.',evidence:`Supported EBITDA is ${money(f.ebitda)}. The contribution/overhead split is incomplete, so its detailed drivers are not inferred.`,implication:'Review the supported loss and complete the missing cost explanation before choosing an improvement assumption.',action:links.profit,priority:100,tone:'warning',visual:[{label:'EBITDA',value:f.ebitda}],nextStep:'Inspect the profit source coverage and cost breakdown; do not treat the unexplained loss as an identified saving.'});
  } else if(salesChange!==null&&contributionChange!==null&&profitChange!==null&&(contributionChange<0||profitChange<0)){
    const spend=delta(amount(f?.advertising),amount(p?.advertising));
    insights.push({id:'profit-pressure',title:salesChange>0?'More sales are not becoming more profit.':'Less contribution is reaching the bottom line.',evidence:`Sales are ${money(Math.abs(salesChange))} ${direction(salesChange)}, marketing contribution ${money(Math.abs(contributionChange))} ${direction(contributionChange)}, and EBITDA ${money(Math.abs(profitChange))} ${direction(profitChange)} vs ${comparisonLabel}.${spend===null?'':` Advertising is ${money(Math.abs(spend))} ${direction(spend)} over the same comparison.`}`,implication:'Sales growth alone is not enough. Check the biggest cost increases and contribution per order before adding budget.',action:links.profit,priority:85,tone:'warning',visual:[{label:'Sales change',value:salesChange},{label:'Contribution change',value:contributionChange},{label:'EBITDA change',value:profitChange}],nextStep:'Open the profit bridge and check the largest changed cost per order before selecting a test.'});
  }
  if(c?.operatingCash!==null&&c?.operatingCash!==undefined&&f?.ebitda!==null&&f?.ebitda!==undefined&&c.operatingCash<f.ebitda){
    const drivers=[{label:'Cost allocation timing',value:c.allocatedToDatedEbitdaAdjustment??0},{label:'Stock',value:c.stock},{label:'Debtors',value:c.debtors},{label:'Provider settlements',value:c.settlements},{label:'Supplier credit',value:c.supplierCredit},{label:'Other working capital',value:c.otherWorkingCapital}].filter((r):r is {label:string;value:number}=>r.value!==null&&r.value<0).sort((a,b)=>a.value-b.value);
    const strongest=drivers[0],negative=c.operatingCash<0&&f.ebitda>=0,timing=strongest?.label==='Cost allocation timing';
    insights.push({id:'cash-conversion',title:negative?'The business made a profit but consumed operating cash.':timing?'Cost timing helps explain the profit-to-cash gap.':'Some profit is tied up before it reaches cash.',evidence:`EBITDA was ${money(f.ebitda)}; operating cash was ${money(c.operatingCash)}.${timing?` Monthly cost allocation differs from dated accruals by ${money(strongest.value)}; that adjustment is not a bank payment.`:strongest?` ${strongest.label} absorbed ${money(-strongest.value)} in the signed profit-to-cash bridge.`:''}`,implication:timing?'Spreading monthly payroll changes reported profit timing, not when money leaves the bank. Check the dated cash bridge and commitments before relying on the balance.':'Profit and cash move at different times. Check what is tied up in stock, customer balances or settlements before committing more cash.',action:links.cash,priority:negative?95:75,tone:'warning',visual:[{label:'EBITDA',value:f.ebitda},{label:'Operating cash',value:c.operatingCash}],nextStep:timing?'Check the allocation timing adjustment separately from actual working-capital and bank movements.':strongest?`Review ${strongest.label.toLowerCase()} movements and related payment/settlement timing before committing more cash.`:'Review the reconciled working-capital and bank movements before committing more cash.'});
  }
  const a=current?.acquisition,pa=previous?.acquisition;
  if(a?.cac!==null&&a?.cac!==undefined&&a.cac>0&&a.firstOrderContribution!==null&&a.cac>a.firstOrderContribution){
    insights.push({id:'acquisition-gap',title:'The first order does not recover acquisition cost.',evidence:`Matched CAC is ${money(a.cac)} per paid new customer, against ${money(a.firstOrderContribution)} contribution before acquisition cost.`,implication:'Check what these customers contribute on later purchases and whether cash can cover the wait before increasing spend. This first-order comparison is not the business-wide break-even CAC limit.',action:links.acquisition,priority:80,tone:'warning',visual:[{label:'CAC / paid new customer',value:a.cac},{label:'First-order contribution',value:a.firstOrderContribution}],nextStep:'Inspect matched acquisition spend, first-order contribution and mature recovery before choosing a bounded budget test.'});
  }
  const conversion=rate(amount(a?.purchasingSessions),amount(a?.sessions)),priorConversion=rate(amount(pa?.purchasingSessions),amount(pa?.sessions));
  if(a&&pa&&conversion!==null&&priorConversion!==null&&conversion<priorConversion&&a.sessions!==null&&pa.sessions!==null&&a.sessions>pa.sessions){
    insights.push({id:'traffic-conversion',title:'More visits are being offset by weaker conversion.',evidence:`Sessions rose from ${count(pa.sessions)} to ${count(a.sessions)}, while purchase conversion moved from ${(priorConversion*100).toFixed(2)}% to ${(conversion*100).toFixed(2)}% vs ${comparisonLabel}.`,implication:'Traffic and conversion are moving in opposite directions. Check the funnel before attributing the change to an individual channel or website step.',action:links.conversion,priority:65,tone:'warning',visual:[],nextStep:'Check comparable traffic sources and the largest session-funnel drop-off; test one change and review contribution as well as sales.'});
  }
  if(a&&pa&&a.newCustomers!==null&&pa.newCustomers!==null&&a.repeatRevenue!==null&&pa.repeatRevenue!==null&&a.newCustomers<pa.newCustomers&&a.repeatRevenue>pa.repeatRevenue){
    insights.push({id:'repeat-pipeline',title:'Repeat spending is supporting sales as new-customer inflow falls.',evidence:`First-time customer orders moved from ${count(pa.newCustomers)} to ${count(a.newCustomers)}; repeat net product sales rose from ${money(pa.repeatRevenue)} to ${money(a.repeatRevenue)} vs ${comparisonLabel}.`,implication:'A stronger repeat-sales share is not proof that retention improved. Future cohort sales are not forecast from this observation.',action:links.retention,priority:60,tone:'warning',visual:[{label:'Previous repeat sales',value:pa.repeatRevenue},{label:'Selected repeat sales',value:a.repeatRevenue}],nextStep:'Review new-customer inflow alongside repeat orders, basket value and equally mature customer groups.'});
  }
  if(!insights.length&&profitChange!==null&&contributionChange!==null&&profitChange>0&&contributionChange>=0){
    insights.push({id:'improving-profit',title:'More contribution is reaching the bottom line.',evidence:`Marketing contribution is ${money(Math.abs(contributionChange))} ${direction(contributionChange)} and EBITDA is ${money(profitChange)} higher vs ${comparisonLabel}.`,implication:'Understand which supported drivers improved and whether they can continue. Better profit alone is not permission to increase spending.',action:links.profit,priority:30,tone:'good',visual:[{label:'Contribution change',value:contributionChange},{label:'EBITDA change',value:profitChange}],nextStep:'Review the profit bridge to identify improvements worth protecting, then check cash before testing growth.'});
  }
  const ranked=insights.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,3);
  const supported=outcomes.filter(r=>r.value!==null).length;
  const primaryAction=ranked[0]?.action??(supported?links.profit:links.evidence);
  const verdict=ranked[0]?{title:ranked[0].title,explanation:ranked[0].evidence,tone:ranked[0].tone,action:primaryAction}:{title:supported?'Your supported results are ready to review.':'Choose reviewed evidence to see the business clearly.',explanation:supported?'No additional priority is established by the available comparisons. Review the supported figures and remaining evidence gaps; this is not an all-clear or a completed monitoring check.':'Sales, marketing contribution, profit and cash appear only when their selected source evidence is supported. Fictional figures are never substituted automatically.',tone:'neutral' as ScoutTone,action:primaryAction};
  return {scope:current?.scope??null,comparisonLabel,outcomes,insights:ranked,verdict,primaryAction,sample:input.sample===true,coverage:{supportedOutcomes:supported,totalOutcomes:5,comparisonSupported:!!previous,financial:!!current&&f?.sales!==null,cash:!!c,acquisition:!!a},rankingBasis:'A contribution shortfall comes first, followed by profit consuming operating cash, deteriorating economics and supported acquisition/customer findings. This is a decision order, not an estimated-savings or confidence score.'};
}
