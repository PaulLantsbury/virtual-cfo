export type AttestationScope={storeId:string;from:string;to:string};
export const CUSTOMER_ATTESTATION_POLICY:Readonly<{enabled:boolean;opensAt:string;expiresAt:string;removeAfter:string;maxProcessMs:number}>;
export function createCustomerRuntimeAttestationService(database:unknown,auth:unknown,options?:{trustedRevision:unknown;runtimeProjectRef?:string;policy?:typeof CUSTOMER_ATTESTATION_POLICY;now?:()=>Date}):Readonly<{inspect(scope:AttestationScope,authorization:string):Promise<unknown>}>;
