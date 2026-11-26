export type MetaAdsCollectorRuntime = Readonly<{
  collector: Readonly<{ collect(input: Readonly<Record<string, unknown>>): Promise<unknown> }>;
  listActiveAccounts(): Promise<readonly Readonly<{
    storeId: string;
    connectionId: string;
    accountId: string;
    currency: string;
    timeZone: string;
  }>[]>;
  expirePendingConnections(): Promise<void>;
  close(): Promise<void>;
}>;

export declare function createMetaAdsCollectorRuntime(
  env: NodeJS.ProcessEnv,
  dependencies?: Readonly<Record<string, unknown>>,
): Promise<MetaAdsCollectorRuntime | undefined>;
