import test from 'node:test';
import assert from 'node:assert/strict';
import {safeRequestPath} from '../src/lib/safe-request-path.ts';

test('request logging retains the route and removes the complete OAuth query',()=>{
 const code='provider-code-do-not-log';
 const state='opaque-state-do-not-log';
 const session='session-state-do-not-log';
 const logged=safeRequestPath(`/api/xero/staging/callback?code=${code}&state=${state}&session_state=${session}&scope=openid`);
 assert.equal(logged,'/api/xero/staging/callback');
 assert.doesNotMatch(logged,/provider|opaque|session|code=|state=|scope=/);
});

test('request logging preserves query-free paths and rejects non-strings',()=>{
 assert.equal(safeRequestPath('/api/healthz'),'/api/healthz');
 assert.equal(safeRequestPath(undefined),undefined);
 assert.equal(safeRequestPath(null),undefined);
});
