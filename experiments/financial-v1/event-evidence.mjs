/** Preparation only: consumes verified source facts, never infers them from current status/import time. */
export function eventDay(timestamp, timeZone) {
  const m = typeof timestamp === 'string' && timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/);
  if (!m || !timeZone || typeof timeZone !== 'string') throw new Error('Verified event timestamp with offset and store timezone required');
  const [,year,month,day,hour,minute,second,offset] = m;
  const y=Number(year),mo=Number(month),d=Number(day);
  const leap=y%4===0&&(y%100!==0||y%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(y<1||mo<1||mo>12||d<1||d>days[mo-1]||Number(hour)>23||Number(minute)>59||Number(second)>59||
    (offset!=='Z'&&(Number(offset.slice(1,3))>23||Number(offset.slice(4))>59))||offset==='-00:00')
    throw new Error('Invalid or unknown event timestamp');
  const instant=new Date(timestamp);
  if(!Number.isFinite(instant.getTime()))throw new Error('Invalid event timestamp');
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);
  const part=type=>parts.find(p=>p.type===type).value;
  return `${part('year').padStart(4,'0')}-${part('month')}-${part('day')}`;
}

export function prepareOrderEvent({saleTimestamp,storeTimeZone,originalPaymentStatus,isTest,cancelledBeforeSale,requiresAdjustmentReview,evidenceRef}) {
  if(!evidenceRef?.trim())throw new Error('Source evidence reference required');
  if([isTest,cancelledBeforeSale,requiresAdjustmentReview].some(v=>typeof v!=='boolean'))throw new Error('Explicit original-order facts required');
  if(requiresAdjustmentReview)throw new Error('Order adjustments require review');
  if(!['paid','completed','unpaid'].includes(originalPaymentStatus))throw new Error('Original payment status requires review');
  return {event_date:eventDay(saleTimestamp,storeTimeZone),original_eligible:!isTest&&!cancelledBeforeSale&&originalPaymentStatus!=='unpaid',evidence_ref:evidenceRef};
}

export function prepareRefundEvent({refundTimestamp,storeTimeZone,requiresAdjustmentReview,evidenceRef}) {
  if(!evidenceRef?.trim()||typeof requiresAdjustmentReview!=='boolean')throw new Error('Explicit refund evidence required');
  if(requiresAdjustmentReview)throw new Error('Refund or goodwill adjustment requires review');
  return {event_date:eventDay(refundTimestamp,storeTimeZone),evidence_ref:evidenceRef};
}
