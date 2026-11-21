import type {XeroFetch,XeroSnapshot} from './contracts.mjs';
export function readXeroSnapshotDate(value:unknown,options?:{today?:string}):string;
/** HTTP success is not report-shape validation: every raw report remains unknown. */
export function readFixedXeroSnapshot(input:{accessToken:string;tenantId:string;date:string;fetchImpl?:XeroFetch}):Promise<XeroSnapshot>;
