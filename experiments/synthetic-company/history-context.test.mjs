import test from 'node:test';
import assert from 'node:assert/strict';
import {historyToday,historySourceAsOf} from './history-context.mjs';

test('history source boundaries mean the next London midnight across both DST changes',()=>{
 for(const [day,expected] of [
  ['2026-03-28','2026-03-29T00:00:00.000Z'],
  ['2026-03-29','2026-03-29T23:00:00.000Z'],
  ['2026-10-24','2026-10-24T23:00:00.000Z'],
  ['2026-10-25','2026-10-26T00:00:00.000Z'],
  ['2024-02-29','2024-03-01T00:00:00.000Z'],
 ]) assert.equal(historySourceAsOf(day),expected);
 assert.equal(historyToday(new Date('2026-07-01T23:30:00Z')),'2026-07-02');
 assert.equal(historyToday(new Date('2026-11-05T23:30:00Z')),'2026-11-05');
});
