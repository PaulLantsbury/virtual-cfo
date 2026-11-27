import assert from 'node:assert/strict';
import test from 'node:test';
import { createReportingSelectionStore, DEFAULT_REPORTING_SELECTION, restoreReportingSelection, updateReportingSelection } from './reportingSelection.ts';

const owner = { userId: 'owner', storeId: 'company-a' };
const memoryStorage = () => {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};

test('prototype defaults and two page consumers share changes in both directions', () => {
  const store = createReportingSelectionStore();
  assert.equal(store.read(owner).period, DEFAULT_REPORTING_SELECTION.period);
  assert.equal(store.read(owner).view, DEFAULT_REPORTING_SELECTION.view);
  let firstPageNotifications = 0, secondPageNotifications = 0;
  const unmountFirst = store.subscribe(owner, () => firstPageNotifications++);
  const unmountSecond = store.subscribe(owner, () => secondPageNotifications++);
  store.update(owner, { period: 6, view: 'monthly', perOrder: true, comparison: 'rolling' });
  assert.equal(store.read(owner).period, 6);
  assert.equal(store.read(owner).view, 'monthly');
  assert.equal(store.read(owner).perOrder, true);
  assert.equal(firstPageNotifications, 1);
  assert.equal(secondPageNotifications, 1);
  unmountFirst();
  store.update(owner, { period: 12, comparison: 'last-year' });
  assert.equal(store.read(owner).period, 12);
  assert.equal(store.read(owner).comparison, 'last-year');
  assert.equal(firstPageNotifications, 1);
  assert.equal(secondPageNotifications, 2);
  unmountSecond();
  // Remounting a page must not reset the existing selection to its local defaults.
  assert.equal(store.read(owner, { period: 3, view: 'weekly' }).period, 12);
});

test('single-period presets and view switches stay coherent', () => {
  const monthly = updateReportingSelection(DEFAULT_REPORTING_SELECTION, { period: 'last-month' });
  assert.equal(monthly.view, 'monthly');
  const weekly = updateReportingSelection(monthly, { view: 'weekly' });
  assert.equal(weekly.period, 'last-week');
  assert.equal(weekly.view, 'weekly');
  const again = updateReportingSelection(weekly, { view: 'monthly' });
  assert.equal(again.period, 'last-month');
  const explicit = updateReportingSelection(again, { period: 'last-week', view: 'monthly' });
  assert.equal(explicit.view, 'weekly');
});

test('user and company scopes never inherit another scope selection', () => {
  const storage = memoryStorage(), store = createReportingSelectionStore(() => storage);
  let otherNotifications = 0;
  const otherCompany = { ...owner, storeId: 'company-b' };
  store.subscribe(otherCompany, () => otherNotifications++);
  store.update(owner, { month: '2026-10-01', comparisonMonth: '2026-09-01', perOrder: true });
  assert.equal(store.read(otherCompany).period, DEFAULT_REPORTING_SELECTION.period);
  assert.notEqual(store.read(otherCompany).period, 'custom');
  assert.equal(store.read({ userId: 'different-user', storeId: owner.storeId }).perOrder, false);
  assert.equal(otherNotifications, 0);
  assert.equal(store.read(owner).comparisonMonth, '2026-09-01');
  assert.equal(store.read({ userId: null, storeId: owner.storeId }), DEFAULT_REPORTING_SELECTION);
  store.update({ userId: null, storeId: owner.storeId }, { perOrder: true });
  assert.equal(store.read({ userId: null, storeId: owner.storeId }).perOrder, false);
});

test('session restore projects only valid preferences and never restores evidence authority', () => {
  const storage = memoryStorage(), first = createReportingSelectionStore(() => storage);
  first.update(owner, { period: 6, view: 'monthly', month: '2026-10-01', comparisonMonth: '2025-10-01' });
  const second = createReportingSelectionStore(() => storage);
  assert.deepEqual(second.read(owner), first.read(owner));
  assert.equal(second.read(owner, { period: 'last-month', view: 'monthly' }).period, 6);
  const restored = restoreReportingSelection(JSON.stringify({ ...DEFAULT_REPORTING_SELECTION, versionId: 'injected', storeId: 'other-company', facts: { profit: 100 } }));
  assert.equal(restored!.period, DEFAULT_REPORTING_SELECTION.period);
  assert.equal(restored!.customFrom, '');
  assert.equal('versionId' in restored!, false);
});

test('malformed storage is ignored and blocked storage keeps navigation functional', () => {
  for (const raw of ['{', 'null', '[]', '{}', JSON.stringify({ ...DEFAULT_REPORTING_SELECTION, period: '120' }), JSON.stringify({ ...DEFAULT_REPORTING_SELECTION, month: '2026-13-01' }), 'x'.repeat(2049)]) {
    assert.equal(restoreReportingSelection(raw), null);
  }
  const blocked = createReportingSelectionStore(() => { throw Error('blocked storage'); });
  assert.doesNotThrow(() => blocked.update(owner, { period: 12 }));
  assert.equal(blocked.read(owner).period, 12);
});

test('connected first-use defaults are explicit and only apply once', () => {
  const store = createReportingSelectionStore();
  const first = store.read(owner, { period: 'last-month', view: 'monthly' });
  assert.equal(first.period, 'last-month');
  assert.equal(first.view, 'monthly');
  store.update(owner, { period: 3, view: 'monthly' });
  assert.equal(store.read(owner, { period: 'last-month', view: 'monthly' }).period, 3);
});

test('invalid patches cannot corrupt state and future comparison anchors are cleared', () => {
  const store = createReportingSelectionStore();
  store.update(owner, { month: '2026-10-01', comparisonMonth: '2026-09-01' });
  store.update(owner, { month: '2026-08-01' });
  assert.equal(store.read(owner).comparisonMonth, '');
  store.update(owner, { month: 'bad', period: -1, perOrder: 'true' } as never);
  assert.equal(store.read(owner).month, '2026-08-01');
  assert.equal(store.read(owner).period, 'custom');
  assert.equal(store.read(owner).perOrder, false);
});

test('explicit cleared month hints survive navigation and reload without stale URL reseeding', () => {
  const storage = memoryStorage(), store = createReportingSelectionStore(() => storage);
  assert.equal(store.metadata(owner).monthTouched, false);
  store.update(owner, { month: '' });
  assert.equal(store.metadata(owner).monthTouched, true);
  assert.equal(store.metadata(owner).comparisonMonthTouched, false);
  store.update(owner, { comparisonMonth: '' });
  assert.equal(store.metadata(owner).comparisonMonthTouched, true);
  const reloaded = createReportingSelectionStore(() => storage);
  assert.equal(reloaded.read(owner).month, '');
  assert.equal(reloaded.metadata(owner).monthTouched, true);
  assert.equal(reloaded.metadata(owner).comparisonMonthTouched, true);
  assert.equal(reloaded.metadata({ ...owner, storeId: 'another' }).hasPreference, false);
});

test('last-year and custom comparisons preserve their explicit meanings', () => {
  const storage = memoryStorage(), store = createReportingSelectionStore(() => storage);
  store.update(owner, { month: '2026-10-01' });
  assert.equal(store.read(owner).comparison, 'last-year');
  assert.equal(store.read(owner).comparisonMonth, '2025-10-01');
  assert.equal(store.metadata(owner).comparisonMonthTouched, false);
  const reloaded = createReportingSelectionStore(() => storage);
  reloaded.read(owner);
  assert.equal(reloaded.metadata(owner).comparisonMonthTouched, false);
  store.update(owner, { comparisonMonth: '2026-09-01' });
  assert.equal(store.read(owner).comparison, 'custom');
  assert.equal(store.read(owner).comparisonMonth, '2026-09-01');
  store.update(owner, { comparison: 'last-year' });
  assert.equal(store.read(owner).comparisonMonth, '2025-10-01');
  store.update(owner, { month: '2026-08-01' });
  assert.equal(store.read(owner).comparisonMonth, '2025-08-01');
  store.update(owner, { comparison: 'none' });
  assert.equal(store.read(owner).comparisonMonth, '');
});


test('custom exact dates persist independently and explicit presets defeat stale month hints', () => {
 const storage=memoryStorage(), store=createReportingSelectionStore(()=>storage);
 store.update(owner,{period:'custom',view:'monthly',customFrom:'2026-09-03',customTo:'2026-09-17'});
 assert.equal(store.read(owner).period,'custom');
 assert.equal(store.read(owner).customFrom,'2026-09-03');
 assert.equal(store.read(owner).month,'2026-09-01');
 assert.equal(store.metadata(owner).monthTouched,true);
 const reloaded=createReportingSelectionStore(()=>storage);
 assert.equal(reloaded.read(owner).customTo,'2026-09-17');
 reloaded.update(owner,{period:'last-month'});
 assert.equal(reloaded.read(owner).period,'last-month');
 assert.equal(reloaded.metadata(owner).monthTouched,true);
 const encoded=[...storage.values.values()][0];
 assert.equal(JSON.parse(encoded).schemaVersion,2);
});
test('legacy saved historical month migrates to Custom but v2 presets remain automatic', () => {
 const legacy={period:'last-month',view:'monthly',perOrder:false,comparison:'none',month:'2026-09-01',comparisonMonth:''};
 const old=restoreReportingSelection(JSON.stringify(legacy))!;
 assert.equal(old.period,'custom');assert.equal(old.customFrom,'2026-09-01');assert.equal(old.customTo,'2026-09-30');
 const modern=restoreReportingSelection(JSON.stringify({...legacy,schemaVersion:2,customFrom:'',customTo:''}))!;
 assert.equal(modern.period,'last-month');assert.equal(modern.customFrom,'');
});
test('each legacy explicit month choice becomes a full Custom month, including leap years', () => {
 const selected=updateReportingSelection(DEFAULT_REPORTING_SELECTION,{month:'2024-02-01',view:'monthly'});
 assert.equal(selected.period,'custom');assert.equal(selected.customFrom,'2024-02-01');assert.equal(selected.customTo,'2024-02-29');
 const clear=updateReportingSelection(selected,{month:''});assert.equal(clear.period,'custom');assert.equal(clear.customFrom,'');assert.equal(clear.customTo,'');assert.equal(clear.month,'');
});
test('invalid modern custom fields cannot inject invalid calendar dates', () => {
 const stored={...DEFAULT_REPORTING_SELECTION,schemaVersion:2,period:'custom',customFrom:'2026-02-30',customTo:'2026-03-01'};
 assert.equal(restoreReportingSelection(JSON.stringify(stored)),null);
});
