import assert from 'node:assert/strict';
import test from 'node:test';
import { readStorePreference, writeStorePreference } from './storePreference.ts';

test('persists and clears a user-scoped store preference', () => {
  const values = new Map<string,string>();
  const storage = {
    getItem: (key:string) => values.get(key) ?? null,
    setItem: (key:string,value:string) => { values.set(key,value); },
    removeItem: (key:string) => { values.delete(key); },
  };
  writeStorePreference(storage, 'owner', 'store-a');
  assert.equal(readStorePreference(storage, 'owner'), 'store-a');
  assert.equal(readStorePreference(storage, 'another-owner'), null);
  writeStorePreference(storage, 'owner', null);
  assert.equal(readStorePreference(storage, 'owner'), null);
});

test('fails closed when browser storage is unavailable', () => {
  const storage = {
    getItem: () => { throw Error('blocked'); },
    setItem: () => { throw Error('blocked'); },
    removeItem: () => { throw Error('blocked'); },
  };
  assert.equal(readStorePreference(storage, 'owner'), null);
  assert.doesNotThrow(() => writeStorePreference(storage, 'owner', 'store-a'));
});
