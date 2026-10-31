import test from 'node:test';
import assert from 'node:assert/strict';
import {mappingVersionInScope,validateXeroMappingVersion} from './mapping-version-contract.mjs';

const version={versionId:'version-1',storeId:'store-1',tenantId:'tenant-1',effectiveFrom:'2026-09-18',confirmedAt:'2026-09-18T12:00:00.000Z',confirmedBy:'member-1',mapping:{revenue:['sales','shipping'],processingFee:'fees',advertising:'ads',software:'software',includedCash:'bank'}};

test('accepts only a complete immutable mapping version without financial payloads',()=>{
 const result=validateXeroMappingVersion(version);
 assert.deepEqual(result,{...version,mapping:{revenue:['sales','shipping'],processingFee:['fees'],advertising:['ads'],software:['software'],includedCash:['bank']}});
 assert.equal(JSON.stringify(result).match(/amount|balance|token|shopify/i),null);
});
test('rejects unconfirmed, malformed, incomplete and financially polluted versions',()=>{
 for(const invalid of [{...version,confirmedAt:'bad'},{...version,effectiveFrom:'2026-02-31'},{...version,mapping:{...version.mapping,software:[]}},{...version,amount:100}])assert.equal(validateXeroMappingVersion(invalid),null);
});
test('requires exact authenticated store and pinned tenant scope',()=>{
 assert.ok(mappingVersionInScope({version,storeId:'store-1',tenantId:'tenant-1'}));
 assert.equal(mappingVersionInScope({version,storeId:'store-2',tenantId:'tenant-1'}),null);
 assert.equal(mappingVersionInScope({version,storeId:'store-1',tenantId:'tenant-2'}),null);
});
