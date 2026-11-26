/** Exact read-only wire validation shared by API and provider client; no IO. */
export type MetaSpendCoverage = 'provider_row' | 'no_row' | 'partial' | 'failed' | 'not_collected';
export type MetaSpendDay = Readonly<{
    date: string;
    coverageState: MetaSpendCoverage;
    spendMinor: string | null;
    observedAt: string | null;
    runId: string | null;
    runStatus: 'complete' | 'partial' | null;
    runStartedAt: string | null;
}>;
export type MetaSpendRange = Readonly<{
    status: 'available';
    storeId: string;
    from: string;
    to: string;
    account: Readonly<{
        providerAccountId: string;
        currency: string;
        timeZone: string;
    }>;
    days: readonly MetaSpendDay[];
    lineage: Readonly<{
        storeId: string;
        accountId: string;
        connectionId: string;
        from: string;
        to: string;
        version: string;
    }>;
    connectionState: 'current' | 'expired';
    reauthorizationRequired: boolean;
    evidenceAvailability: 'available' | 'unavailable';
    observationFreshness: 'unknown';
}>;
export type MetaSpendResult = MetaSpendRange | Readonly<{
    status: 'not_connected';
    storeId: string;
    from: string;
    to: string;
    account: null;
    days: readonly [];
}>;
export declare function parseMetaSpendReport(v: unknown, storeId: string, from: string, to: string): MetaSpendResult;

export declare function isMetaSpendTimestamp(value: unknown): value is string;
