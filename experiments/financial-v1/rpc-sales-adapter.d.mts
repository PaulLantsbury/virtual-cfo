export interface VerifiedSales {
 grossProductSales:number;discounts:number;netProductSales:number;netShipping:number;
 originalOrders:number;productRefundExVat:number;cashRefunded:number;
 aov:{value:number|null;reason:string|null};hasActivity:boolean;hasRefundActivity:boolean;
 cogs:null;profitDataState:'incomplete';
 provenance:{storeId:string;currency:string;from:string;to:string;coverageEvidence:string};
}
export function fetchVerifiedSales(rpc:(name:string,params:{p_store_id:string;p_date_from:string;p_date_to:string})=>PromiseLike<{data:unknown;error:unknown}>,scope:{storeId:string;currency:string;from:string;to:string}):Promise<VerifiedSales>;
