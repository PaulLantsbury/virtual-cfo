import type {XeroWriteFs} from './contracts.mjs';
export type XeroReadPhase='token_exchange'|'tenant_discovery'|'account_directory'|'report_snapshot'|'evidence_summary';
export type XeroReadReason='invalid_request'|'network_failure'|'upstream_refused'|'malformed_response';
/** Runtime validates the exact marker shape and rejects arbitrary error details. */
export function writeLocalXeroReadStatus(path:string,status:unknown,options?:{fs?:XeroWriteFs}):Promise<Readonly<{source:'xero';phase:XeroReadPhase;recordedAt:string;reason?:XeroReadReason}>>;
