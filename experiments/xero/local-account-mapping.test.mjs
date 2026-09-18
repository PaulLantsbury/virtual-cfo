import test from 'node:test';
import assert from 'node:assert/strict';
import {readLocalXeroAccountMapping} from './local-account-mapping.mjs';
const mapping={revenue:['sales','shipping'],processingFee:'fees',advertising:'ads',software:'software',includedCash:['bank1','bank2']};
test('reads only a complete owner-approved mapping',async()=>{
 const result=await readLocalXeroAccountMapping('/tmp/xero-map.json',{fs:{readFile:async()=>JSON.stringify(mapping)}});
 assert.deepEqual(result.revenue,['sales','shipping']);
});
test('withholds a missing, malformed or incomplete mapping',async()=>{
 for(const readFile of [async()=>{throw Error('missing');},async()=>'{',async()=>JSON.stringify({})])await assert.rejects(readLocalXeroAccountMapping('/tmp/xero-map.json',{fs:{readFile}}),/unavailable/);
});
