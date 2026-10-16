export type SavedXeroCategory='revenue'|'processingFee'|'advertising'|'software'|'includedCash';
export type SavedXeroMapping=Readonly<{storeId:string;state:'available'|'not_connected'|'mapping_unavailable';mapping:null|Readonly<{version:number;effectiveFrom:string;confirmedAt:string;directoryRetrievedAt:string;reviewRequired:boolean;categories:readonly Readonly<{category:SavedXeroCategory;accounts:readonly Readonly<{accountId:string;name:string|null;type:string|null;status:string|null}>[]}>[]}>}>;
export const XERO_SAVED_CATEGORIES:readonly SavedXeroCategory[];
export function parseSavedXeroMapping(value:unknown,storeId:string):SavedXeroMapping|null;
