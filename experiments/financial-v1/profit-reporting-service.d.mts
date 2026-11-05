export type ProfitScope={storeId:string;from:string;to:string;currency:string};
export function validProfitScope(scope:unknown):scope is ProfitScope;
export function createProfitReportingService(db:unknown,supabase:unknown,options?:{snapshotPolicy?:{storeId:string;sourceBasis:'synthetic-local'|'shopify-operational';formulaVersion:string;profileVersion?:string}|null}):{read(scope:ProfitScope,authorization:string):Promise<unknown>};
