import type {XeroAccount,XeroFetch} from './contracts.mjs';
export function parseXeroAccountDirectory(payload:unknown):readonly XeroAccount[];
export function discoverXeroAccounts(input:{accessToken:string;tenantId:string;pinnedTenantId:string;fetchImpl?:XeroFetch}):Promise<readonly XeroAccount[]>;
