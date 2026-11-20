export type HistoryScope={storeId:string;currency:string;from:string;to:string};
export type HistoryVersionSelection={edition:string;versionId:string};
export interface HistoryReadService {
 read(scope:HistoryScope,authorization:string,selection?:HistoryVersionSelection):Promise<any>;
 available(scope:{storeId:string;currency:string},authorization:string):Promise<any>;
}
export function createHistoryService(database:any,auth:any,options?:{now?:()=>Date}):HistoryReadService;
