import type {HistoryScope,HistoryVersionSelection} from './history-reader.mjs';
export type SupplementalKind='cash'|'acquisition';
export type SupplementalScope=HistoryScope&{currency:'GBP';timezone:'Europe/London'};
export type SupplementalEnvelope={contract:'reviewed-supplement-v1';kind:SupplementalKind;scope:SupplementalScope;financialVersionId:string;salesRevision:string;costRevision:string;sourceBasis:'synthetic-local';observedAt:string;payload:Record<string,unknown>};
export type SupplementalResult=({state:'supported';snapshotId:string}&SupplementalEnvelope)|{state:'unavailable';contract:'reviewed-supplement-v1';reason:string};
export interface SupplementalReadService {read(scope:HistoryScope,authorization:string,selection:HistoryVersionSelection,kind:SupplementalKind):Promise<SupplementalResult>}
export function supplementalDigest(body:unknown):string;
export function createSupplementalService(database:any,auth:any,options?:{now?:()=>Date;validators?:Partial<Record<SupplementalKind,(payload:any,financial:any)=>boolean>>;readHistory?:(tx:any,scope:HistoryScope,options:any)=>Promise<any>}):SupplementalReadService;
