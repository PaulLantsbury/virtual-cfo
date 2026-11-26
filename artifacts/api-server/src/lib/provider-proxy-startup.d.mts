import type {RequestHandler} from 'express';
export declare const WEBSITE_PRIVATE_PROVIDER_ORIGIN: "http://night-scout-provider-api-staging:10000";
export declare function validateWebsiteReportEnvironment(env: NodeJS.ProcessEnv): void;
export declare function createWebsiteOwnerProxy(env: NodeJS.ProcessEnv): RequestHandler | undefined;
export declare function createWebsiteCanaryProxy(env: NodeJS.ProcessEnv): RequestHandler | undefined;
