const uuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const day = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00.000Z`)) && new Date(`${v}T00:00:00.000Z`).toISOString().slice(0, 10) === v;
/** Reject calendar/time/offset rollover before Date.parse can normalize it. */
export function isMetaSpendTimestamp(value) {
    return typeof value === 'string'
        && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.test(value)
        && day(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}
const timestamp = isMetaSpendTimestamp;
const plain = (value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(value).every(key => typeof key === 'string' && 'value' in descriptors[key] && descriptors[key].enumerable);
};
const denseDays = (value) => Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
    && Reflect.ownKeys(value).length === value.length + 1
    && Array.from({length: value.length}, (_, index) => Object.getOwnPropertyDescriptor(value, String(index)))
        .every(descriptor => descriptor && 'value' in descriptor);
const coverages = new Set(['provider_row', 'no_row', 'partial', 'failed', 'not_collected']);
const fail = () => new Error('Meta spend unavailable');
function parseAccount(v) { if (!plain(v) || Object.keys(v).sort().join(',') !== 'currency,providerAccountId,timeZone' || typeof v.providerAccountId !== 'string' || !/^[0-9]{5,32}$/.test(v.providerAccountId) || typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency) || typeof v.timeZone !== 'string' || v.timeZone.length < 1 || v.timeZone.length > 128)
    throw fail(); try {
    new Intl.DateTimeFormat('en', { timeZone: v.timeZone });
}
catch {
    throw fail();
} return Object.freeze({ providerAccountId: v.providerAccountId, currency: v.currency, timeZone: v.timeZone }); }
function parseDay(v) {
    if (!plain(v) || Object.keys(v).sort().join(',') !== 'coverageState,date,observedAt,runId,runStartedAt,runStatus,spendMinor' || !day(v.date) || typeof v.coverageState !== 'string' || !coverages.has(v.coverageState) || !(v.observedAt === null || timestamp(v.observedAt)) || !(v.runId === null || uuid(v.runId)) || !(v.runStatus === null || v.runStatus === 'complete' || v.runStatus === 'partial') || !(v.runStartedAt === null || timestamp(v.runStartedAt)))
        return null;
    const amount = v.spendMinor;
    if (v.coverageState === 'provider_row') {
        if (typeof amount !== 'string' || !/^(0|[1-9]\d{0,29})$/.test(amount))
            return null;
    }
    else if (amount !== null)
        return null;
    if (v.coverageState === 'not_collected' && (v.observedAt !== null || v.runId !== null || v.runStatus !== null || v.runStartedAt !== null))
        return null;
    if (v.coverageState !== 'not_collected' && (!timestamp(v.observedAt) || !uuid(v.runId) || !(v.runStatus === 'complete' || v.runStatus === 'partial') || !timestamp(v.runStartedAt)))
        return null;
    return Object.freeze({ date: v.date, coverageState: v.coverageState, spendMinor: amount, observedAt: v.observedAt, runId: v.runId, runStatus: v.runStatus, runStartedAt: v.runStartedAt });
}
export function parseMetaSpendReport(v, storeId, from, to) {
    if (!plain(v) || v.storeId !== storeId || v.from !== from || v.to !== to)
        throw fail();
    if (v.status === 'not_connected') {
        if (Object.keys(v).sort().join(',') !== 'account,days,from,status,storeId,to' || v.account !== null || !Array.isArray(v.days) || v.days.length !== 0 || !denseDays(v.days))
            throw fail();
        return Object.freeze({ status: 'not_connected', storeId, from, to, account: null, days: Object.freeze([]) });
    }
    if (Object.keys(v).sort().join(',') !== 'account,connectionState,days,evidenceAvailability,from,lineage,observationFreshness,reauthorizationRequired,status,storeId,to' || v.status !== 'available' || !Array.isArray(v.days) || v.days.length > 93 || !denseDays(v.days))
        throw fail();
    const account = parseAccount(v.account), days = v.days.map(parseDay);
    if (days.some(x => !x))
        throw fail();
    const first = Date.parse(`${from}T00:00:00.000Z`), last = Date.parse(`${to}T00:00:00.000Z`);
    if (!day(from) || !day(to) || from > to || (last - first) / 86_400_000 > 92 || days.length !== (last - first) / 86_400_000 + 1)
        throw fail();
    for (let i = 0; i < days.length; i++) {
        if (days[i].date !== new Date(first + i * 86_400_000).toISOString().slice(0, 10))
            throw fail();
    }
    const lineage = v.lineage;
    if (!plain(lineage) || Object.keys(lineage).sort().join(',') !== 'accountId,connectionId,from,storeId,to,version'
        || lineage.storeId !== storeId || lineage.accountId !== account.providerAccountId || !uuid(lineage.connectionId)
        || lineage.from !== from || lineage.to !== to || typeof lineage.version !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(lineage.version)
        || !(v.connectionState === 'current' || v.connectionState === 'expired')
        || v.reauthorizationRequired !== (v.connectionState === 'expired') || v.observationFreshness !== 'unknown')
        throw fail();
    const evidenceAvailability = days.some(d => d?.coverageState === 'provider_row') ? 'available' : 'unavailable';
    if (v.evidenceAvailability !== evidenceAvailability)
        throw fail();
    return Object.freeze({ status: 'available', storeId, from, to, account, days: Object.freeze(days),
        lineage: Object.freeze({ storeId, accountId: account.providerAccountId, connectionId: lineage.connectionId, from, to, version: lineage.version }),
        connectionState: v.connectionState, reauthorizationRequired: v.reauthorizationRequired,
        evidenceAvailability, observationFreshness: 'unknown' });
}
