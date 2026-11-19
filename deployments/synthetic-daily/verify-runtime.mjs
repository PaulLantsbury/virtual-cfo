/** Build verification only: load the locked driver and exercise the zero-connection default. */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {operateDaily} from '../../experiments/synthetic-company/daily-operator.mjs';
assert.equal(process.versions.node,'24.22.3','Reviewed Node runtime required');
const require=createRequire(new URL('../../artifacts/api-server/package.json',import.meta.url));
const pg=require('pg'),version=require('pg/package.json').version;
assert.equal(version,'8.20.0','Locked PostgreSQL driver required');
assert.equal(typeof pg.Client,'function');
const result=await operateDaily({recurring:true});
assert.deepEqual(result,{state:'disabled',mode:'inspect',connections:0});
process.stdout.write(JSON.stringify({runtimeVerified:true,node:process.versions.node,pg:version,disabledConnections:result.connections})+'\n');
