export function createGoogleAdsCollectorRuntime(env: NodeJS.ProcessEnv, dependencies?: Readonly<Record<string, unknown>>): Promise<Readonly<{
  collector: Readonly<{ collect(input: Readonly<{ storeId: string; connectionId: string; customerId: string; from: string; to: string; idempotencyKey: string }>): Promise<unknown> }>;
  listActiveAccounts(): Promise<readonly unknown[]>;
  expirePendingConnections(): Promise<void>;
  close(): Promise<void>;
}> | undefined>;
