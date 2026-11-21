/** Type-only boundaries for the existing read-only Xero adapters. Raw provider JSON
 * remains unknown until a parser validates it; amounts are integer minor units. */
export type XeroCategory='revenue'|'processingFee'|'advertising'|'software'|'includedCash';
export type XeroAccount=Readonly<{id:string;name:string;type:string;status:string}>;
export type XeroAccountMapping=Readonly<Record<XeroCategory,readonly string[]>>;
export type XeroAmounts=Readonly<Record<XeroCategory,number>>;
export type XeroScope=Readonly<{from:string;to:string;currency:string;closedPeriod?:boolean}>;
export type XeroConnection=Readonly<{id:string;tenantId:string}>;
export type XeroReportKey='profitAndLoss'|'balanceSheet'|'trialBalance'|'bankSummary';
export type XeroSnapshot=Readonly<{date:string;tenantId:string;organisation:unknown;profitAndLoss:unknown;balanceSheet:unknown;trialBalance:unknown;bankSummary:unknown}>;
export type XeroFetch=(input:string|URL,init:{method?:'GET'|'POST';redirect:'error';headers:Record<string,string>;body?:URLSearchParams})=>Promise<{ok:boolean;status:number;json():Promise<unknown>}>;
export type XeroWriteFs={mkdir(path:string,options:{recursive:true;mode:number}):Promise<unknown>;writeFile(path:string,data:string,options:{encoding:'utf8';mode:number;flag:'wx'}):Promise<unknown>;rename(from:string,to:string):Promise<unknown>};
export type XeroReadFs={readFile(path:string,encoding:'utf8'):Promise<string>};
export type XeroEvidenceHeader=Readonly<{source:'xero';reportDate:string;retrievedAt:string;baseCurrency:string;reports:Readonly<Record<XeroReportKey,string>>;shopifyComparison:'not_requested'}>;
/** Summary construction does not itself validate arbitrary provider field values.
 * The local evidence writer/header reader enforce the final string-only shape. */
export type XeroEvidenceSummaryCandidate=Readonly<{source:'xero';tenantId:string;reportDate:string;retrievedAt:string;baseCurrency:unknown;reports:Readonly<Record<XeroReportKey,unknown>>;shopifyComparison:'not_requested'}>;
export type XeroEvidenceSummary=XeroEvidenceHeader&Readonly<{tenantId:string}>;
export type XeroAccountingView=({readonly available:true;readonly reason:null}&XeroAmounts&{readonly shopifyComparison:'not_requested'})|Readonly<{available:false;reason:'account_mapping_incomplete';revenue:null;processingFee:null;advertising:null;software:null;includedCash:null;shopifyComparison:'not_requested'}>;
export type XeroAccountReportStructure=Readonly<{selectedAccountIds:readonly string[];foundAccountIds:readonly string[];missingAccountIds:readonly string[];accountAttributeRows:number;cellCounts:readonly number[]}>;
export type XeroAccountStructure=Readonly<{profitAndLoss:XeroAccountReportStructure;balanceSheet:XeroAccountReportStructure}>;
export type XeroMappingSuggestion=Readonly<{category:XeroCategory;requiresReview:true;status:'no_suggestion'|'ambiguous'|'suggested';candidates:readonly Readonly<{accountId:string;accountName:string;accountType:string;score:number;confidence:'high'|'medium'|'low';reasons:readonly string[]}>[]}>;
export type XeroAccountingReader=Readonly<{available:true;reason:null;accounting:Readonly<{basis:'accrual_p_and_l';currency:string;period:Readonly<{from:string;to:string}>;bookedRevenue:number;processingFees:number;advertising:number;software:number;asOf:string}>;cash:Readonly<{basis:'dated_unrestricted_balance';currency:string;includedBalance:number;asOf:string;unsettledProcessorFunds:'separate_or_unavailable'}>;shopifyComparison:'not_requested'}>;
export type XeroSupportedEvidence=Readonly<{state:'supported';scope:XeroScope;asOf:string;values:XeroAmounts}>;
