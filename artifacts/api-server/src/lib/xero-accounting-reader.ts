export type XeroAccountingScope=Readonly<{storeId:string;from:string;to:string;currency:string}>;
export type XeroAccountingPeriod=Readonly<{storeId:string;scope:{from:string;to:string;currency:string};state:'available'|'stale'|'unavailable'|'review_required';reason:null|string;accounting:null|{basis:'accrual_p_and_l';currency:string;asOf:string;retrievedAt:string;mappingVersionId:string;closedPeriod:boolean;bookedRevenueMinor:string;processingFeesMinor:string;advertisingMinor:string;softwareMinor:string};cash:null;shopifyComparison:'not_requested'}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const xeroDay=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(`${v}T00:00:00Z`))&&new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export function validXeroScope(v:unknown):v is XeroAccountingScope{return plain(v)&&exact(v,['storeId','from','to','currency'])&&typeof v.storeId==='string'&&uuid.test(v.storeId)&&xeroDay(v.from)&&xeroDay(v.to)&&v.from<=v.to&&typeof v.currency==='string'&&/^[A-Z]{3}$/.test(v.currency);}
const minor=(v:unknown)=>typeof v==='string'&&/^-?(0|[1-9][0-9]{0,15})$/.test(v)&&v!=='-0'&&BigInt(v)>=BigInt(Number.MIN_SAFE_INTEGER)&&BigInt(v)<=BigInt(Number.MAX_SAFE_INTEGER);
export function parseXeroAccountingPeriod(value:unknown,scope:XeroAccountingScope):XeroAccountingPeriod|null{
 if(!validXeroScope(scope)||!plain(value)||!exact(value,['storeId','scope','state','reason','accounting','cash','shopifyComparison'])||value.storeId!==scope.storeId||!plain(value.scope)||!exact(value.scope,['from','to','currency'])||value.scope.from!==scope.from||value.scope.to!==scope.to||value.scope.currency!==scope.currency||value.cash!==null||value.shopifyComparison!=='not_requested')return null;
 if(value.state==='unavailable'||value.state==='review_required')return value.accounting===null&&['accounting_evidence_unavailable','source_refresh_failed','source_review_required','account_mapping_review_required'].includes(String(value.reason))?value as XeroAccountingPeriod:null;
 if(!['available','stale'].includes(String(value.state))||(value.state==='available'?value.reason!==null:value.reason!=='source_refresh_failed')||!plain(value.accounting))return null;
 const a=value.accounting;
 if(value.state==='stale'&&a.closedPeriod!==true)return null;
 if(!exact(a,['basis','currency','asOf','retrievedAt','mappingVersionId','closedPeriod','bookedRevenueMinor','processingFeesMinor','advertisingMinor','softwareMinor'])||a.basis!=='accrual_p_and_l'||a.currency!==scope.currency||!xeroDay(a.asOf)||a.asOf!==scope.to||typeof a.retrievedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(a.retrievedAt)||!Number.isFinite(Date.parse(a.retrievedAt))||typeof a.mappingVersionId!=='string'||!uuid.test(a.mappingVersionId)||typeof a.closedPeriod!=='boolean'||!['bookedRevenueMinor','processingFeesMinor','advertisingMinor','softwareMinor'].every(key=>minor(a[key])))return null;
 return value as XeroAccountingPeriod;
}
