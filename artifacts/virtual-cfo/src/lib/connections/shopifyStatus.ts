export type Attempt = { state: 'running' | 'completed' | 'unconfirmed'; startedAt: string; finishedAt: string | null; from: string; to: string; resultCode: string | null };
export type ConnectionStatus = {state: 'available' | 'not_configured';storeId: string;latestAttempt: Attempt | null;latestSuccessfulCollection: {finishedAt:string;from:string;to:string;resultCode:string} | null;candidate: {state: 'not_assessed' | 'unavailable' | 'current_unverified' | 'needs_recheck';from: string | null;to: string | null;orderCount: number | null;refundCount: number | null;mappedEventCount: number | null;testExcludedCount: number | null};financialVerification: 'not_assessed'};
const failure = () => { throw new Error('Shopify connection status is unavailable'); };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : failure();
const day = (value: unknown): string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value ? value : failure();
const time = (value: unknown): string => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)) ? value : failure();
const codes = ['recorded_requires_review','changed_requires_review','replay','historical_replay','missing_source','stale_source','conflicting_source'];
function attempt(value: unknown): Attempt | null {
 if(value === null || value === undefined)return null;
 const a=object(value);if(!['running','completed','unconfirmed'].includes(String(a.state)))return failure();
 const from=day(a.from),to=day(a.to);if(from>to)return failure();
 const resultCode=a.resultCode==null?null:codes.includes(String(a.resultCode))?String(a.resultCode):failure();
 const startedAt=time(a.startedAt),finishedAt=a.finishedAt==null?null:time(a.finishedAt);
 if(a.state==='completed'&&(!finishedAt||!resultCode))return failure();
 return {state:a.state as Attempt['state'],startedAt,finishedAt,from,to,resultCode};
}
/** Discard unknown fields; scope mismatch or malformed evidence fails closed. */
export function parseShopifyStatus(value: unknown, storeId: string): ConnectionStatus {
 const raw=object(value);if(raw.storeId!==storeId||!['available','not_configured'].includes(String(raw.state))||raw.financialVerification!=='not_assessed')return failure();
 const c=object(raw.candidate);if(!['not_assessed','unavailable','current_unverified','needs_recheck'].includes(String(c.state)))return failure();
 const from=c.from==null?null:day(c.from),to=c.to==null?null:day(c.to);if((from===null)!==(to===null)||(from&&to&&from>to))return failure();
 const latestAttempt=attempt(raw.latestAttempt);let latestSuccessfulCollection:ConnectionStatus['latestSuccessfulCollection']=null;
 if(raw.latestSuccessfulCollection!=null){const c=object(raw.latestSuccessfulCollection);const from=day(c.from),to=day(c.to);if(from>to||!['recorded_requires_review','changed_requires_review','replay'].includes(String(c.resultCode)))return failure();latestSuccessfulCollection={from,to,finishedAt:time(c.finishedAt),resultCode:String(c.resultCode)};}
 if(['current_unverified','needs_recheck'].includes(String(c.state))&&(!latestAttempt||from!==latestAttempt.from||to!==latestAttempt.to))return failure();
 const count=(v:unknown)=>v==null?null:Number.isSafeInteger(v)&&Number(v)>=0?Number(v):failure();
 return {state:raw.state as ConnectionStatus['state'],storeId,latestAttempt,latestSuccessfulCollection,candidate:{state:c.state as ConnectionStatus['candidate']['state'],from,to,orderCount:count(c.orderCount),refundCount:count(c.refundCount),mappedEventCount:count(c.mappedEventCount),testExcludedCount:count(c.testExcludedCount)},financialVerification:'not_assessed'};
}

/** Reports evidence uncertainty only; it does not infer freshness from a clock or certify figures. */
export function collectionWarning(data: ConnectionStatus): string | null {
 if(data.state !== 'available')return null;
 const a=data.latestAttempt;
 if(!a)return 'No collection has been recorded. Data freshness is unknown.';
 if(a.state === 'running')return 'The latest collection has not finished. It may still be running or may have been interrupted. Newer data is not confirmed.';
 if(a.state === 'unconfirmed')return 'The latest collection could not be confirmed. Displayed figures may be out of date; check the last completed collection.';
 if(['missing_source','stale_source','conflicting_source','historical_replay'].includes(a.resultCode ?? ''))return 'The latest attempt did not establish a newer current collection. Previously verified figures may be out of date; investigation is needed.';
 return null;
}
