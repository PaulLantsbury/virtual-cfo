import type {XeroWriteFs,XeroReadFs} from './contracts.mjs';
/** Existing pins validate their ID; their optional historical name remains opaque. */
export function pinXeroTenant(path:string,tenant:{tenantId:string;tenantName?:string},options?:{fs?:XeroWriteFs&XeroReadFs}):Promise<Readonly<{tenantId:string;tenantName?:unknown}>>;
