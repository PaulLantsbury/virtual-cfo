import type {RequestHandler} from 'express';
export declare const WEBSITE_PRIVATE_PROVIDER_ORIGIN: undefined;
export declare function validateWebsiteReportEnvironment(env: NodeJS.ProcessEnv): void;
export declare function createWebsiteOwnerProxy(env: NodeJS.ProcessEnv): RequestHandler | undefined;
