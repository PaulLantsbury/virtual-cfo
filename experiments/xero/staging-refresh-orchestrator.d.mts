import type {XeroConnection,XeroScope,XeroSupportedEvidence,XeroEvidenceSummaryCandidate,XeroAccountingReader} from './contracts.mjs';
export type XeroRefreshFailureReason='source_refresh_failed'|'source_review_required'|'account_mapping_review_required'|'accounting_evidence_unavailable'|'later_posting_review_required';
export type XeroRefreshFailure=Readonly<{state:'failed';scope:XeroScope;asOf:string;reason:XeroRefreshFailureReason;attempts:number;retained:boolean}>;
/** Retention validates source identity/scope, but does not re-parse prior monetary fields. */
export type XeroRetainedEvidence=Readonly<{state:'supported';scope:XeroScope;asOf:string;values:Readonly<Record<string,unknown>>}>;
export type XeroRefreshReadRequest=Readonly<{tenantId:string;from:string;to:string}>;
export type XeroRefreshPersistenceRequest=Readonly<{connectionId:string;tenantId:string;scope:XeroScope}>;
export type XeroSupportedRefreshWrite=XeroRefreshPersistenceRequest&Readonly<{evidence:XeroSupportedEvidence;summary:XeroEvidenceSummaryCandidate;reader:XeroAccountingReader;sourceFingerprint:string}>;
export type XeroFailedRefreshWrite=XeroRefreshPersistenceRequest&Readonly<{failure:XeroRefreshFailure;retainedEvidence:XeroRetainedEvidence|null}>;
export type XeroRefreshPersistence={writeSupported(input:XeroSupportedRefreshWrite):Promise<unknown>;writeFailure(input:XeroFailedRefreshWrite):Promise<unknown>;readLatestSupported?(input:XeroRefreshPersistenceRequest):Promise<unknown>};
export type XeroRefreshResult=Readonly<{state:'supported';connectionId:string;scope:XeroScope;evidence:XeroSupportedEvidence;reader:XeroAccountingReader;summary:XeroEvidenceSummaryCandidate}>|Readonly<{state:'stale';connectionId:string;scope:XeroScope;evidence:XeroRetainedEvidence;failure:XeroRefreshFailure}>|Readonly<{state:'failed';connectionId:string;scope:XeroScope;failure:XeroRefreshFailure}>;
export type XeroRefreshDiagnostic=Readonly<{event:'xero_accounting_evidence_failed';phase:'selected_account_totals'|'account_mapping_view'|'accounting_reader'|'evidence_summary';reason:string;report?:'ProfitAndLoss'|'BalanceSheet'|'BankSummary';category?:'revenue'|'processingFee'|'advertising'|'software'|'includedCash'}>;
/** A single explicitly invoked read; does not construct a provider, scheduler or credential client. */
export function runStagingXeroRefresh(input:{connection:XeroConnection;scope:XeroScope;mapping:unknown;readSnapshot(input:XeroRefreshReadRequest):Promise<unknown>;persist:XeroRefreshPersistence;now?:()=>string;maxAttempts?:1|2|3;diagnose?:(detail:XeroRefreshDiagnostic)=>void}):Promise<XeroRefreshResult>;
