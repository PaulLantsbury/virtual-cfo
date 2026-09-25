export type ProfitScope={storeId:string;from:string;to:string;currency:string};
export function validProfitScope(scope:unknown):scope is ProfitScope;
export function createProfitReportingService(db:unknown,supabase:unknown):{read(scope:ProfitScope,authorization:string):Promise<unknown>};
