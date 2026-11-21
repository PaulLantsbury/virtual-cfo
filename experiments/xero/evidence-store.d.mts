import type {XeroWriteFs} from './contracts.mjs';
/** Validates the complete exact string-only summary before writing. */
export function writeLocalXeroEvidenceSummary(path:string,summary:unknown,options?:{fs?:XeroWriteFs}):Promise<Readonly<{path:string;source:'xero';reportDate:string;retrievedAt:string}>>;
