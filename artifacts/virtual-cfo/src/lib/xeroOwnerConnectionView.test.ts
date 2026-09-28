import assert from 'node:assert/strict';
import test from 'node:test';
import { xeroOwnerConnectionView } from './xeroOwnerConnectionView.ts';

test('gives reauthorisation a clear owner reconnect action', () => {
  const view=xeroOwnerConnectionView('reauthorization_required');
  assert.equal(view.reconnecting,true);
  assert.match(view.title,/Reconnect/);
  assert.match(view.action,/Reconnect/);
  assert.match(view.detail,/retain the existing confirmed mapping/);
});

test('keeps disconnected setup distinct from reconnection', () => {
  const view=xeroOwnerConnectionView('disconnected');
  assert.equal(view.reconnecting,false);
  assert.match(view.action,/Discover/);
});
