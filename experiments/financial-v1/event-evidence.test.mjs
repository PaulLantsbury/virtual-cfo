import test from 'node:test';
import assert from 'node:assert/strict';
import {eventDay,prepareOrderEvent,prepareRefundEvent} from './event-evidence.mjs';
const original={saleTimestamp:'2026-02-10T12:00:00Z',storeTimeZone:'Europe/London',originalPaymentStatus:'paid',isTest:false,cancelledBeforeSale:false,requiresAdjustmentReview:false,evidenceRef:'synthetic:original-sale'};
test('paid original remains eligible when current status is refunded',()=>{
 assert.equal(prepareOrderEvent({...original,currentStatus:'refunded'}).original_eligible,true);
 assert.equal(prepareOrderEvent({...original,originalPaymentStatus:'completed'}).original_eligible,true);
 for(const patch of [{originalPaymentStatus:'unpaid'},{isTest:true},{cancelledBeforeSale:true}])assert.equal(prepareOrderEvent({...original,...patch}).original_eligible,false);
});
test('event dates follow store timezone across month and daylight-saving boundaries',()=>{
 assert.equal(eventDay('2026-03-31T23:30:00Z','Europe/London'),'2026-04-01');
 assert.equal(eventDay('2026-03-01T00:30:00Z','America/New_York'),'2026-02-28');
 assert.equal(eventDay('2026-10-25T01:30:00+01:00','Europe/London'),'2026-10-25');
 assert.equal(eventDay('2026-10-25T01:30:00Z','Europe/London'),'2026-10-25');
});
test('later refund keeps its own event period and original sale unchanged',()=>{
 const sale=prepareOrderEvent(original);
 const refund=prepareRefundEvent({refundTimestamp:'2026-03-15T12:00:00Z',storeTimeZone:'Europe/London',requiresAdjustmentReview:false,evidenceRef:'synthetic:refund'});
 assert.equal(sale.event_date,'2026-02-10');assert.equal(refund.event_date,'2026-03-15');assert.equal(sale.original_eligible,true);
});
test('missing facts and ambiguous adjustments cannot become certified inputs',()=>{
 for(const patch of [{isTest:undefined},{cancelledBeforeSale:null},{originalPaymentStatus:'refunded'},{requiresAdjustmentReview:true},{evidenceRef:''},{saleTimestamp:undefined,created_at:'2026-02-10T12:00:00Z'}])assert.throws(()=>prepareOrderEvent({...original,...patch}));
 assert.throws(()=>prepareRefundEvent({refundTimestamp:original.saleTimestamp,storeTimeZone:'Europe/London',requiresAdjustmentReview:true,evidenceRef:'goodwill'}));
});
test('rejects impossible dates, offset-free timestamps and unknown timezone',()=>{
 for(const stamp of ['2026-02-30T12:00:00Z','2026-02-29T12:00:00Z','2026-01-01T24:00:00Z','2026-01-01T12:00:00','2026-01-01T12:00:00-00:00','2026-01-01'])assert.throws(()=>eventDay(stamp,'Europe/London'));
 assert.equal(eventDay('2024-02-29T12:00:00Z','Europe/London'),'2024-02-29');
 assert.throws(()=>eventDay(original.saleTimestamp,'not-a-timezone'));
});
