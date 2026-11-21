import type {XeroAccount,XeroCategory,XeroMappingSuggestion,XeroEvidenceHeader,XeroReadFs} from './contracts.mjs';
export function readLocalXeroAccountDirectory(path:string,options?:{fs?:XeroReadFs}):Promise<Readonly<{source:'xero';tenantId:string;retrievedAt:string;accounts:readonly XeroAccount[]}>>;
export function readLocalXeroEvidenceHeader(path:string,options?:{fs?:XeroReadFs}):Promise<XeroEvidenceHeader>;
export function buildXeroMappingPreview(input:{accounts:readonly XeroAccount[];mapping:unknown}):Readonly<{source:'xero';mappingStatus:'owner_confirmed_local_test';categories:readonly Readonly<{category:XeroCategory;confirmed:readonly XeroAccount[];suggestion:XeroMappingSuggestion}>[]}>;
