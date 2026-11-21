/** Reversible legacy-route navigation only. Kept query values are requests for
 * the destination to validate, not evidence that a period/version is supported.
 * Obsolete scenario assumptions are deliberately not replayed as a new plan. */
export const LEGACY_CONTEXT_KEYS = [
  'reviewStore', 'reviewFrom', 'reviewTo', 'reviewVersion',
  'compareFrom', 'compareTo', 'compareVersion',
  'reviewHorizon', 'reviewView', 'reviewCompare', 'tab',
  'acceptance', // Inert release-probe metadata; never reporting evidence or authority.
] as const;

const destinations = new Set([
  '/dashboard', '/profit-engine', '/new-marketing', '/new-cash-control',
  '/plan', '/monitoring',
  '/v11/scout', '/v11/profit', '/v11/growth', '/v11/cash',
  '/v11/plan', '/v11/monitoring', '/v11/settings',
]);
const base = 'https://night-scout.invalid';
const noControls = (value: string) => !/[\u0000-\u001f\u007f]/.test(value);

/** Preserve explicit reporting context and fragment while fixed destination
 * parameters (especially Plan tab/legacy) take precedence. Pure: no DOM/storage. */
export function contextPreservingRedirect(target: string, search = '', hash = ''): string {
  const rawPath = target.split(/[?#]/, 1)[0];
  if (!target.startsWith('/') || target.startsWith('//') || !destinations.has(rawPath)
    || !noControls(target) || target.includes('\\')) {
    throw new Error('Legacy redirect destination must be a known same-site page.');
  }
  const destination = new URL(target, base);
  if (destination.origin !== base || !destinations.has(destination.pathname)) {
    throw new Error('Legacy redirect destination must be a known same-site page.');
  }
  const incoming = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of LEGACY_CONTEXT_KEYS) {
    if (destination.searchParams.has(key)) continue;
    const values = incoming.getAll(key);
    // An ambiguous repeated scope is not silently resolved to one source.
    if (values.length === 1 && values[0] && noControls(values[0])) {
      destination.searchParams.set(key, values[0]);
    }
  }
  if (!destination.hash && hash && noControls(hash)) {
    destination.hash = hash.startsWith('#') ? hash : `#${hash}`;
  }
  return destination.pathname + destination.search + destination.hash;
}
