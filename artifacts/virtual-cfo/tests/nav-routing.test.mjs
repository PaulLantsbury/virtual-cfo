import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contextPreservingRedirect} from '../src/lib/legacyNavigation.ts';
import {CORE_NAV_ITEMS,SUPPORT_NAV_ITEMS,HELP_NAV_ITEM,isNavigationActive} from '../src/components/layout/nav-model.ts';
const params = url => new URL(url, 'https://night-scout.invalid').searchParams;

test('canonical fixed Plan tab and legacy marker win over an incoming bookmark', () => {
  const result = contextPreservingRedirect('/plan?tab=planner&legacy=1', '?tab=opportunities&legacy=0&reviewFrom=2026-10-01', '#inputs');
  assert.equal(params(result).get('tab'), 'planner');
  assert.equal(params(result).get('legacy'), '1');
  assert.equal(params(result).get('reviewFrom'), '2026-10-01');
  assert.ok(result.endsWith('#inputs'));
});

test('explicit financial month/version and comparison context survive without approving it', () => {
  const query = new URLSearchParams({reviewStore:'company-a',reviewFrom:'2026-10-01',reviewTo:'2026-10-31',reviewVersion:'requested-current-version',compareFrom:'2025-10-01',compareTo:'2025-10-31',compareVersion:'requested-prior-version'});
  const result = contextPreservingRedirect('/profit-engine', query.toString(), '#profit-figures');
  for (const [key, value] of query) assert.equal(params(result).get(key), value);
  assert.ok(result.endsWith('#profit-figures'));
});

test('legacy sample context stays explicit and an existing supported tab is retained', () => {
  const result = contextPreservingRedirect('/new-marketing', '?reviewHorizon=6&reviewView=monthly&reviewCompare=last-year&tab=retention', '#growth-evidence');
  assert.equal(params(result).get('reviewHorizon'), '6');
  assert.equal(params(result).get('reviewView'), 'monthly');
  assert.equal(params(result).get('reviewCompare'), 'last-year');
  assert.equal(params(result).get('tab'), 'retention');
  assert.ok(result.endsWith('#growth-evidence'));
});

test('obsolete scenario values, external next destinations and unrecognised queries are not replayed', () => {
  const result = contextPreservingRedirect('/plan?tab=planner&legacy=1', '?spend=999999&cac=1&aov=100&orders=200&next=https%3A%2F%2Foutside.example&reviewFrom=2026-10-01');
  assert.deepEqual([...params(result).keys()].sort(), ['legacy','reviewFrom','tab']);
});

test('a destination-owned fragment and reporting parameter override incoming values', () => {
  const result = contextPreservingRedirect('/profit-engine?reviewView=monthly#source', '?reviewView=weekly', '#other');
  assert.equal(params(result).get('reviewView'), 'monthly');
  assert.ok(result.endsWith('#source'));
});

test('external, protocol-relative, script and unrecognised destinations are rejected', () => {
  for (const target of ['https://outside.example/plan','//outside.example/plan','javascript:alert(1)','/settings','/../plan','/plan/other','/\\outside.example','/plan\n']) {
    assert.throws(() => contextPreservingRedirect(target), /known same-site/);
  }
});

test('duplicate scopes and control characters are withheld rather than guessed', () => {
  const result = contextPreservingRedirect('/dashboard', '?reviewStore=a&reviewStore=b&reviewVersion=one&reviewFrom=2026-10-01%0A&tab=', '#safe');
  assert.equal(params(result).get('reviewStore'), null);
  assert.equal(params(result).get('reviewVersion'), 'one');
  assert.equal(params(result).get('reviewFrom'), null);
  assert.equal(params(result).get('tab'), null);
  assert.ok(result.endsWith('#safe'));
});

test('empty context resolves deterministically to the approved canonical pages', () => {
  for (const route of ['/dashboard','/profit-engine','/new-marketing','/new-cash-control','/plan','/monitoring','/v11/scout']) {
    assert.equal(contextPreservingRedirect(route), route);
  }
});

test('shared navigation exposes the five core areas while retired designs stay out of the owner menu', () => {
  assert.equal(CORE_NAV_ITEMS.length, 5);
  assert.deepEqual(CORE_NAV_ITEMS.map(item => item.href), ['/dashboard','/profit-engine','/new-marketing','/new-cash-control','/plan']);
  const all = [...CORE_NAV_ITEMS, ...SUPPORT_NAV_ITEMS, HELP_NAV_ITEM];
  assert.equal(new Set(all.map(item => item.href)).size, all.length);
  assert.ok(all.every(item => !item.label.startsWith('New ')));
  assert.ok(all.every(item => !['/growth-quality','/marketing-efficiency','/cash-control','/scenario-lab','/opportunities'].includes(item.href)));
  assert.deepEqual(SUPPORT_NAV_ITEMS.map(item => item.href), ['/monitoring','/settings']);
  assert.equal(HELP_NAV_ITEM.href, '/help');
});

test('active navigation uses exact page boundaries and ignores query/fragment, not similar route names', () => {
  assert.equal(isNavigationActive('/new-marketing?tab=retention#growth-evidence','/new-marketing'), true);
  assert.equal(isNavigationActive('/plan/actions','/plan'), true);
  assert.equal(isNavigationActive('/planner','/plan'), false);
  assert.equal(isNavigationActive('/profit-engine-original','/profit-engine'), false);
  assert.equal(isNavigationActive('/marketing-efficiency-original','/new-marketing'), false);
});


test('every current Profit alias preserves the exact hosted acceptance probe and fragment', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const aliases = [...app.matchAll(/<Route path="([^"]+)"><ContextRedirect to="\/profit-engine"\s*\/>/g)].map(match => match[1]);
  assert.deepEqual(aliases.sort(), ['/margin-analysis', '/new-profit', '/pricing-optimisation'].sort());
  for (const alias of aliases) {
    const incoming = new URL(alias + '?acceptance=release#evidence', 'https://night-scout.invalid');
    assert.equal(contextPreservingRedirect('/profit-engine', incoming.search, incoming.hash), '/profit-engine?acceptance=release#evidence', alias);
  }
});

test('acceptance metadata coexists with reporting context without replaying assumptions', () => {
  const query = new URLSearchParams({acceptance:'release',reviewStore:'company-a',reviewFrom:'2026-10-01',reviewTo:'2026-10-31',reviewVersion:'requested-current',compareFrom:'2025-10-01',compareTo:'2025-10-31',compareVersion:'requested-prior'});
  const result = contextPreservingRedirect('/profit-engine', '?' + query + '&spend=999&cac=1&unknown=drop&next=https://outside.example', '#evidence');
  assert.deepEqual([...params(result)].sort(), [...query].sort());
  assert.equal(new URL(result, 'https://night-scout.invalid').hash, '#evidence');
  const plan = contextPreservingRedirect('/plan?tab=planner&legacy=1', '?acceptance=release&tab=wrong&legacy=0&spend=999', '#plan-evidence');
  assert.equal(params(plan).get('tab'), 'planner');
  assert.equal(params(plan).get('legacy'), '1');
  assert.equal(params(plan).get('acceptance'), 'release');
  assert.equal(params(plan).has('spend'), false);
  assert.equal(new URL(plan, 'https://night-scout.invalid').hash, '#plan-evidence');
});

test('acceptance metadata retains existing duplicate and control-character rejection', () => {
  for (const query of ['?acceptance=one&acceptance=two', '?acceptance=release%0A', '?acceptance=']) {
    assert.equal(params(contextPreservingRedirect('/profit-engine', query)).get('acceptance'), null);
  }
});
