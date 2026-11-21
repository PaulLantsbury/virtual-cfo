export const XERO_REDIRECT_URI:'http://localhost:3000/xero/callback';
export const XERO_READ_SCOPES:readonly ['accounting.settings.read','accounting.reports.profitandloss.read','accounting.reports.balancesheet.read','accounting.reports.trialbalance.read','accounting.reports.banksummary.read'];
export type XeroReadOnlyConfig=Readonly<{clientId:string;clientSecret:string;redirectUri:typeof XERO_REDIRECT_URI;scopes:typeof XERO_READ_SCOPES}>;
export type XeroAuthorizationConfig=Readonly<{clientId:string;redirectUri:string;scopes:readonly string[]}>;
export type XeroAuthorization=Readonly<{url:string;state:string}>;
export function readXeroTestConfig(input?:{enabled?:unknown;clientId?:unknown;clientSecret?:unknown;redirectUri?:unknown}):XeroReadOnlyConfig|undefined;
export function createAuthorization(config:XeroAuthorizationConfig,options:{stateKey:string;now?:number;nonce?:string}):XeroAuthorization;
export function verifyAuthorizationState(state:unknown,options?:{stateKey?:unknown;now?:number}):boolean;
export function createSingleUseStateGuard(options:{stateKey:string;now?:()=>number}):Readonly<{issue(config:XeroAuthorizationConfig,options?:{now?:number;nonce?:string}):XeroAuthorization;consume(state:unknown,options?:{at?:number}):boolean}>;
