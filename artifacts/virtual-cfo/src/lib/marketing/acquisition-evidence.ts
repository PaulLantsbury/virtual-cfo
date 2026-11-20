import { HISTORY_EDITION } from '../v11/history-supported.ts';
import { FORMULA_VERSION } from '../v11/fixtures.ts';
import type { composeHistoryMonth } from '../v11/history-composition.ts';
export const ACQUISITION_POLICY = 'synthetic-identity-and-spend-v1';
export type ReviewedMonth = NonNullable<ReturnType<typeof composeHistoryMonth>>;
export interface SyntheticFunnel {contract:'synthetic-funnel-v1';policy:'synthetic-session-events-v1';coverage:{from:string;to:string;complete:true};daily:{date:string;sessions:number;cartSessions:number;checkoutSessions:number;purchasingSessions:number;orders:number;sourceHash:string}[];totals:{sessions:number;cartSessions:number;checkoutSessions:number;purchasingSessions:number;orders:number};sourceHash:string}
export interface AllocatedCostValues {netProductSales:number;netShipping:number;cogs:number;variableCosts:number;repeatMarketingCosts:number;contributionBeforeMarketing:number}
export interface AcquisitionEconomics {
 policy:'synthetic-order-cost-allocation-v1';
 dependencies:{from:string;to:string;versionId:string;salesRevision:string;costRevision:string}[];
 first:AllocatedCostValues & {contract:'synthetic-first-order-economics-v1';policy:'synthetic-order-cost-allocation-v1';scope:{from:string;to:string;observedThrough:string;currency:'GBP';timezone:'Europe/London'};customers:number;acquisitionSpend:number;acquisitionMetricsState:'supported'|'unavailable';source:{costSourceHash:string;acquisitionSourceHash:string;allocationHash:string};basis:string};
 mature:{contract:'synthetic-mature-cohort-economics-v1';state:'supported';policy:'synthetic-order-cost-allocation-v1';scope:{from:string;to:string;observedThrough:string;days:90;currency:'GBP';timezone:'Europe/London'};customers:number;acquisitionSpend:number;curve:(AllocatedCostValues & {day:number})[];source:{costSourceHash:string;acquisitionSourceHash:string;allocationHash:string;repeatMarketingHash:string};basis:string}|null;
 source:{costSourceHash:string;allocationHash:string;repeatMarketingHash:string};
}
export interface DerivedAcquisitionEconomics {firstOrderContribution:number|null;firstOrderContributionAfterAcquisition:number|null;firstOrderBreakEvenCacBeforeOverheads:number|null;mature:{cac:number;grossProfitToCac:number;contributionAfterAcquisition:number;firstCrossingDay:number|null;recoveryReversed:boolean;curve:{day:number;contributionBeforeAcquisition:number}[]}|null}
export interface AcquisitionPayload {
  contract: 'synthetic-acquisition-v1'; state: 'supported'; profile: 'uk-gifts-v2'; policy: typeof ACQUISITION_POLICY;
  scope: {storeId:string;currency:'GBP';timezone:'Europe/London';from:string;to:string};
  financial: {snapshotId:string;edition:string;anchor:string;salesRevision:string;costRevision:string;formulaVersion:string};
  source: {from:string;through:string;sourceHash:string;ordersHash:string;refundsHash:string;allocationHash:string;synthetic:true};
  coverage: {originalOrders:number;identifiedFirstOrders:number;identifiedRepeatOrders:number;guestOrders:number;unknownOrders:number;paidFirstCustomers:number};
  spend: {advertising:number;acquisition:number;retention:number;unallocated:number};
  revenue: {netProductSales:number;identifiedFirst:number;identifiedRepeat:number;guest:number;unknown:number};
  analytics?: SyntheticFunnel;
  economics?: AcquisitionEconomics;
  metrics: {cac:null;firstOrderContribution:null;maturePaybackDays:null};
  limitations: string[];
}
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const day = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0,10) === v;
const text = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 256;
const sha = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
/** Raw API-compatible financial scope, not browser assumptions or a sample baseline. */
export function acquisitionFinancialContext(month: ReviewedMonth | null) {
  if (!month) return null;
  const advertising = month.input.profit?.advertising;
  if (advertising?.state !== 'ready' || !Number.isSafeInteger(advertising.value)
    || month.view.primary.result.metrics.contributionBeforeMarketing === null) return null;
  return {state:'supported',versionId:month.selection.versionId,
    scope:{storeId:month.selection.storeId,currency:month.selection.currency,from:month.selection.period.from,to:month.selection.period.to},
    metadata:{edition:month.selection.edition,anchor:month.selection.anchor,formulaVersion:month.context.formulaVersion},
    salesRevision:month.evidence.salesRevision,costRevision:month.evidence.costRevision,
    sales:{originalOrders:month.originalOrders,netProductSales:month.amounts.netProductSales},components:{advertising:advertising.value}};
}
/** Validate exact financial edition, version, source revisions, coverage and integer spend partition. */
export function acquisitionView(payload: unknown, financial: unknown): (AcquisitionPayload & {cac:number|null;funnel:{conversion:number|null;checkoutCompletion:number|null;cartRate:number|null;checkoutRate:number|null}|null;economicsView:DerivedAcquisitionEconomics|null}) | null {
  if (!object(payload) || !object(financial) || financial.state !== 'supported' || !object(financial.scope) || !object(financial.metadata)
    || !object(financial.sales) || !object(financial.components) || payload.contract !== 'synthetic-acquisition-v1' || payload.state !== 'supported'
    || payload.profile !== 'uk-gifts-v2' || payload.policy !== ACQUISITION_POLICY || !object(payload.scope) || !object(payload.financial)
    || !object(payload.source) || !object(payload.coverage) || !object(payload.spend) || !object(payload.revenue) || !object(payload.metrics)) return null;
  const scope=payload.scope, f=payload.financial, source=payload.source, c=payload.coverage, s=payload.spend, m=payload.metrics;
  if (scope.storeId!=='d7500000-0000-4000-8000-000000000009' || scope.storeId!==financial.scope.storeId || scope.currency!=='GBP' || financial.scope.currency!=='GBP' || scope.timezone!=='Europe/London'
    || !day(scope.from) || !day(scope.to) || scope.from>scope.to || scope.from!==financial.scope.from || scope.to!==financial.scope.to
    || !text(f.snapshotId) || f.snapshotId!==financial.versionId || f.edition!==HISTORY_EDITION || f.edition!==financial.metadata.edition
    || !day(f.anchor) || f.anchor!==financial.metadata.anchor || f.formulaVersion!==FORMULA_VERSION || f.formulaVersion!==financial.metadata.formulaVersion
    || !text(f.salesRevision) || f.salesRevision!==financial.salesRevision || !text(f.costRevision) || f.costRevision!==financial.costRevision) return null;
  if (source.from!=='2024-01-01' || !day(source.through) || source.through<scope.to || source.synthetic!==true || !sha(source.sourceHash) || !sha(source.ordersHash) || !sha(source.refundsHash) || !sha(source.allocationHash)) return null;
  if (!['originalOrders','identifiedFirstOrders','identifiedRepeatOrders','guestOrders','unknownOrders','paidFirstCustomers'].every(key=>count(c[key]))
    || !count(financial.sales.originalOrders) || c.originalOrders!==financial.sales.originalOrders
    || BigInt(c.identifiedFirstOrders)+BigInt(c.identifiedRepeatOrders)+BigInt(c.guestOrders)+BigInt(c.unknownOrders)!==BigInt(c.originalOrders)
    || c.paidFirstCustomers>c.identifiedFirstOrders) return null;
  if (!['advertising','acquisition','retention','unallocated'].every(key=>count(s[key])) || !count(financial.components.advertising)
    || s.advertising!==financial.components.advertising || c.paidFirstCustomers===0 && s.acquisition!==0 || BigInt(s.acquisition)+BigInt(s.retention)+BigInt(s.unallocated)!==BigInt(s.advertising)) return null;
  const r=payload.revenue;
  if (!['netProductSales','identifiedFirst','identifiedRepeat','guest','unknown'].every(key=>typeof r[key]==='number'&&Number.isSafeInteger(r[key])) || !Number.isSafeInteger(financial.sales.netProductSales) || r.netProductSales!==financial.sales.netProductSales || BigInt(r.identifiedFirst)+BigInt(r.identifiedRepeat)+BigInt(r.guest)+BigInt(r.unknown)!==BigInt(r.netProductSales)) return null;
  const cac=c.paidFirstCustomers>0&&s.acquisition>0?s.acquisition/c.paidFirstCustomers:null;
  if (m.cac!==null || m.firstOrderContribution!==null || m.maturePaybackDays!==null
    || !Array.isArray(payload.limitations) || !payload.limitations.length || payload.limitations.length>12 || payload.limitations.some((v:unknown)=>typeof v!=='string'||!v||v.length>500)) return null;
  const analytics=payload.analytics===undefined?null:validateSyntheticFunnel(payload.analytics,scope.from,scope.to,c.originalOrders);
  if(payload.analytics!==undefined&&!analytics)return null;
  const ratio=(n:number,d:number)=>d>0?n/d:null;
  const funnel=analytics?{conversion:ratio(analytics.totals.purchasingSessions,analytics.totals.sessions),checkoutCompletion:ratio(analytics.totals.purchasingSessions,analytics.totals.checkoutSessions),cartRate:ratio(analytics.totals.cartSessions,analytics.totals.sessions),checkoutRate:ratio(analytics.totals.checkoutSessions,analytics.totals.sessions)}:null;
  const economics=payload.economics===undefined?null:validateAcquisitionEconomics(payload.economics,payload as AcquisitionPayload);
  if(payload.economics!==undefined&&!economics)return null;
  return { ...payload as AcquisitionPayload, cac, funnel, economicsView:economics?deriveAcquisitionEconomics(economics):null };
}
export function validateAcquisitionPayload(payload: unknown, financial: unknown): boolean { return acquisitionView(payload, financial) !== null; }

/** Complete dated simulated session observations; ratios remain view calculations. */
export function validateSyntheticFunnel(value:unknown,from:string,to:string,orders:number):SyntheticFunnel|null {
 if(!object(value)||value.contract!=='synthetic-funnel-v1'||value.policy!=='synthetic-session-events-v1'||!object(value.coverage)||value.coverage.from!==from||value.coverage.to!==to||value.coverage.complete!==true||!sha(value.sourceHash)||!Array.isArray(value.daily)||!object(value.totals))return null;
 const expected=Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1;
 if(expected<1||expected>31||value.daily.length!==expected)return null;
 const keys=['sessions','cartSessions','checkoutSessions','purchasingSessions','orders'] as const;
 const totals={sessions:0n,cartSessions:0n,checkoutSessions:0n,purchasingSessions:0n,orders:0n};
 for(let i=0;i<value.daily.length;i++){
  const d=value.daily[i],expectedDate=new Date(Date.parse(from+'T12:00:00Z')+i*86400000).toISOString().slice(0,10);
  if(!object(d)||d.date!==expectedDate||!sha(d.sourceHash)||!keys.every(k=>count(d[k]))||d.purchasingSessions>d.orders||d.purchasingSessions>d.checkoutSessions||d.checkoutSessions>d.cartSessions||d.cartSessions>d.sessions)return null;
  for(const key of keys)totals[key]+=BigInt(d[key]);
 }
 if(!keys.every(k=>count(value.totals[k])&&BigInt(value.totals[k])===totals[k])||value.totals.orders!==orders)return null;
 return value as SyntheticFunnel;
}

const costKeys=['netProductSales','netShipping','cogs','variableCosts','repeatMarketingCosts','contributionBeforeMarketing'] as const;
const keys=(value:Record<string,any>,expected:string[])=>Object.keys(value).sort().join(',')===expected.sort().join(',');
const signedMoney=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&!Object.is(value,-0);
function costValues(value:unknown):boolean {
 if(!object(value)||!costKeys.every(k=>signedMoney(value[k]))||value.variableCosts<0||value.repeatMarketingCosts<0)return false;
 return signedMoney(value.netProductSales-value.cogs)&&signedMoney(value.contributionBeforeMarketing-value.repeatMarketingCosts)&&BigInt(value.netProductSales)+BigInt(value.netShipping)-BigInt(value.cogs)-BigInt(value.variableCosts)===BigInt(value.contributionBeforeMarketing);
}
/** Optional cost/cohort evidence is all-or-nothing; malformed data never becomes a partial success. */
export function validateAcquisitionEconomics(value:unknown,payload:AcquisitionPayload):AcquisitionEconomics|null {
 const policy='synthetic-order-cost-allocation-v1';
 if(!object(value)||!keys(value,['policy','first','mature','dependencies','source'])||value.policy!==policy||!object(value.source)||!keys(value.source,['costSourceHash','allocationHash','repeatMarketingHash'])||!Object.values(value.source).every(sha)||!object(value.first))return null;
 const source=value.source,f=value.first;
 if(!keys(f,['contract','policy','scope','customers',...costKeys,'acquisitionSpend','acquisitionMetricsState','source','basis'])||f.contract!=='synthetic-first-order-economics-v1'||f.policy!==policy||!object(f.scope)||!keys(f.scope,['from','to','observedThrough','currency','timezone'])||f.scope.from!==payload.scope.from||f.scope.to!==payload.scope.to||f.scope.observedThrough!==payload.scope.to||f.scope.currency!=='GBP'||f.scope.timezone!=='Europe/London'
 ||!signedMoney(f.contributionBeforeMarketing-f.acquisitionSpend)||!count(f.customers)||f.customers!==payload.coverage.paidFirstCustomers||!count(f.acquisitionSpend)||f.acquisitionSpend!==payload.spend.acquisition||f.acquisitionMetricsState!==(f.customers>0&&f.acquisitionSpend>0?'supported':'unavailable')||!costValues(f)||f.repeatMarketingCosts!==0||typeof f.basis!=='string'||!f.basis||f.basis.length>1000||!object(f.source)||!keys(f.source,['costSourceHash','acquisitionSourceHash','allocationHash'])||f.source.costSourceHash!==source.costSourceHash||f.source.acquisitionSourceHash!==payload.source.sourceHash||f.source.allocationHash!==source.allocationHash)return null;
 const m=value.mature;
 if(!Array.isArray(value.dependencies)||value.dependencies.length!==(m===null?0:6))return null;
 const seenVersions=new Set<string>();
 for(let i=0;i<value.dependencies.length;i++){
  const d=value.dependencies[i],from=`2026-${String(i+4).padStart(2,'0')}-01`,to=new Date(Date.UTC(2026,i+4,0)).toISOString().slice(0,10);
  if(!object(d)||!keys(d,['from','to','versionId','salesRevision','costRevision'])||d.from!==from||d.to!==to||typeof d.versionId!=='string'||!/^[-a-f0-9]{36}$/i.test(d.versionId)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(d.versionId)||seenVersions.has(d.versionId)||!sha(d.salesRevision)||!sha(d.costRevision))return null;
  if(d.from===payload.scope.from&&d.to===payload.scope.to&&(d.versionId!==payload.financial.snapshotId||d.salesRevision!==payload.financial.salesRevision||d.costRevision!==payload.financial.costRevision))return null;
  seenVersions.add(d.versionId);
 }
 if(m!==null){
  if(!object(m)||!keys(m,['contract','state','policy','scope','customers','acquisitionSpend','curve','source','basis'])||m.contract!=='synthetic-mature-cohort-economics-v1'||m.state!=='supported'||m.policy!==policy||!object(m.scope)||!keys(m.scope,['from','to','observedThrough','days','currency','timezone'])||m.scope.from!=='2026-04-01'||m.scope.to!=='2026-06-30'||m.scope.observedThrough!=='2026-09-30'||m.scope.days!==90||m.scope.currency!=='GBP'||m.scope.timezone!=='Europe/London'||m.scope.observedThrough>payload.scope.to||m.scope.observedThrough>payload.source.through
   ||!count(m.customers)||m.customers<=0||!count(m.acquisitionSpend)||m.acquisitionSpend<=0||!Array.isArray(m.curve)||m.curve.length!==90||typeof m.basis!=='string'||!m.basis||m.basis.length>1000||!object(m.source)||!keys(m.source,['costSourceHash','acquisitionSourceHash','allocationHash','repeatMarketingHash'])||m.source.costSourceHash!==source.costSourceHash||m.source.acquisitionSourceHash!==payload.source.sourceHash||m.source.allocationHash!==source.allocationHash||m.source.repeatMarketingHash!==source.repeatMarketingHash)return null;
  for(let i=0;i<m.curve.length;i++){
   const row=m.curve[i];
   if(!object(row)||!keys(row,['day',...costKeys])||row.day!==i||!costValues(row)||!signedMoney(row.contributionBeforeMarketing-row.repeatMarketingCosts-m.acquisitionSpend)||i>0&&(row.variableCosts<m.curve[i-1].variableCosts||row.repeatMarketingCosts<m.curve[i-1].repeatMarketingCosts))return null;
  }
 }
 return value as AcquisitionEconomics;
}
/** All divisions and the first crossing are browser-derived from matched integer inputs. */
export function deriveAcquisitionEconomics(value:AcquisitionEconomics):DerivedAcquisitionEconomics {
 const f=value.first,firstOrderContribution=f.customers>0?f.contributionBeforeMarketing/f.customers:null;
 const m=value.mature;
 let mature:DerivedAcquisitionEconomics['mature']=null;
 if(m){
  const curve=m.curve.map(row=>({day:row.day,contributionBeforeAcquisition:(row.contributionBeforeMarketing-row.repeatMarketingCosts)/m.customers}));
  const firstCrossingDay=m.curve.find(row=>row.contributionBeforeMarketing-row.repeatMarketingCosts>=m.acquisitionSpend)?.day??null;
  const recoveryReversed=firstCrossingDay!==null&&m.curve.some(row=>row.day>firstCrossingDay&&row.contributionBeforeMarketing-row.repeatMarketingCosts<m.acquisitionSpend);
  const end=m.curve[89];
  mature={cac:m.acquisitionSpend/m.customers,grossProfitToCac:(end.netProductSales-end.cogs)/m.acquisitionSpend,contributionAfterAcquisition:(end.contributionBeforeMarketing-end.repeatMarketingCosts-m.acquisitionSpend)/m.customers,firstCrossingDay,recoveryReversed,curve};
 }
 return {firstOrderContribution,firstOrderContributionAfterAcquisition:f.customers>0?(f.contributionBeforeMarketing-f.acquisitionSpend)/f.customers:null,firstOrderBreakEvenCacBeforeOverheads:firstOrderContribution,mature};
}

export function contributionRecoveryLabel(day:number|null,reversed=false):string {
 if(day===null)return 'Not recovered within 90 days';
 return `Day ${day}${day===0?' · first-order day':''}${reversed?' · later reversal observed':''}`;
}
