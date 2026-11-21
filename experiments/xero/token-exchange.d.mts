import type {XeroFetch} from './contracts.mjs';
import type {XERO_REDIRECT_URI} from './read-only-oauth.mjs';
export function exchangeReadOnlyCode(input:{code:string;config:{clientId:string;clientSecret:string;redirectUri:typeof XERO_REDIRECT_URI};fetchImpl?:XeroFetch}):Promise<Readonly<{accessToken:string;expiresIn:number}>>;
export function discoverConnectedTenant(input:{accessToken:string;fetchImpl?:XeroFetch}):Promise<Readonly<{tenantId:string;tenantName:string|undefined}>>;
