import type {XeroAccountStructure,XeroWriteFs} from './contracts.mjs';
export function writeLocalXeroAccountStructure(path:string,input:{retrievedAt:string;structure:XeroAccountStructure},options?:{fs?:XeroWriteFs}):Promise<Readonly<{path:string;retrievedAt:string}>>;
