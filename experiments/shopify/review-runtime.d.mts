export type ReviewScope={storeId:string;from:string;to:string};
export type RestoreRequest={scope:ReviewScope;batchId:string;snapshotDigest:string;coverageConfirmed:true;evidenceRef:string;completenessStatement:string};
export type Runtime={service:{prepare(scope:ReviewScope,authorization:string):Promise<unknown>;restore(request:RestoreRequest,authorization:string):Promise<unknown>};close():Promise<void>};
export function initialiseReviewRuntime(config:{projectRef:string;authUrl:string;publishableKey:string;databaseUrl:string},factories:{createPool:(options:Record<string,unknown>)=>unknown;createAuthClient:(url:string,key:string,options:Record<string,unknown>)=>unknown;fetchImpl?:typeof fetch}):Promise<Runtime>;
