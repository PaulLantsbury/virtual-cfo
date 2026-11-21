import type {XeroAccount,XeroWriteFs} from './contracts.mjs';
export function writeLocalXeroAccountDirectory(path:string,directory:{tenantId:string;retrievedAt:string;accounts:readonly XeroAccount[]},options?:{fs?:XeroWriteFs}):Promise<Readonly<{path:string;tenantId:string;retrievedAt:string;accountCount:number}>>;
