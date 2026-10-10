import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pinXeroTenant} from './tenant-pin.mjs';

test('first tenant is locally owner-pinned and the same tenant is reusable',async()=>{
 const root=await mkdtemp(join(tmpdir(),'xero-pin-')),path=join(root,'private','tenant.json');
 const first=await pinXeroTenant(path,{tenantId:'tenant-1',tenantName:'Night Scout Test'});
 assert.deepEqual(first,{tenantId:'tenant-1',tenantName:'Night Scout Test'});assert.deepEqual(JSON.parse(await readFile(path,'utf8')),first);assert.equal((await stat(path)).mode&0o777,0o600);
 assert.deepEqual(await pinXeroTenant(path,{tenantId:'tenant-1',tenantName:'Changed remotely'}),first);
});
test('a changed tenant or malformed pin is rejected',async()=>{
 const root=await mkdtemp(join(tmpdir(),'xero-pin-')),path=join(root,'tenant.json');
 await pinXeroTenant(path,{tenantId:'tenant-1'});
 await assert.rejects(pinXeroTenant(path,{tenantId:'tenant-2'}),/changed/);
 await assert.rejects(pinXeroTenant(path,{tenantId:''}),/invalid/);
});
