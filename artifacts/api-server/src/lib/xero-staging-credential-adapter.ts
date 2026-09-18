import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** A server-only envelope boundary: master keys and plaintext never leave this module. */
export type XeroEnvelope=Readonly<{ciphertext:Buffer;encryptedDek:Buffer;keyVersion:string;algorithm:'AES-256-GCM'}>;
export type StoredXeroEnvelope=XeroEnvelope&Readonly<{connectionId:string;tenantId:string;version:number;leaseExpiresAt:string|null}>;
export type XeroWorkerRpc=Readonly<{call(name:string,args:readonly unknown[]):Promise<readonly Record<string,unknown>[]>}>;
export type RefreshFailure='invalid_grant'|'provider_unavailable'|'refresh_failed'|'scope_changed'|'tenant_unavailable';
const algorithm='AES-256-GCM' as const, reasons=new Set<RefreshFailure>(['invalid_grant','provider_unavailable','refresh_failed','scope_changed','tenant_unavailable']);
const fail=()=>Error('Xero staging credential unavailable');
const validId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200;
const validVersion=(v:unknown):v is number=>Number.isInteger(v)&&(v as number)>0;
function context(connectionId:string,tenantId:string,keyVersion:string){if(!validId(connectionId)||!validId(tenantId)||!validId(keyVersion))throw fail();return Buffer.from(`night-scout/xero/staging/v1|${connectionId}|${tenantId}|${keyVersion}`);}
function packed(nonce:Buffer,tag:Buffer,body:Buffer){return Buffer.concat([Buffer.from([1]),nonce,tag,body]);}
function unpacket(payload:Buffer){if(payload.length<30||payload[0]!==1)throw fail();return {nonce:payload.subarray(1,13),tag:payload.subarray(13,29),body:payload.subarray(29)};}
function seal(key:Buffer,plain:Buffer,aad:Buffer){const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce,{authTagLength:16});cipher.setAAD(aad);const body=Buffer.concat([cipher.update(plain),cipher.final()]);return packed(nonce,cipher.getAuthTag(),body);}
function open(key:Buffer,payload:Buffer,aad:Buffer){const {nonce,tag,body}=unpacket(payload),decipher=createDecipheriv('aes-256-gcm',key,nonce,{authTagLength:16});decipher.setAAD(aad);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(body),decipher.final()]);}
function bytea(v:unknown):Buffer|null{if(Buffer.isBuffer(v))return Buffer.from(v);if(v instanceof Uint8Array)return Buffer.from(v);if(typeof v==='string'&&/^\\x[0-9a-f]*$/i.test(v)&&v.length%2===0)return Buffer.from(v.slice(2),'hex');return null;}

export function createXeroEnvelopeCrypto(masterMaterial:string|Buffer,keyVersion='staging-v1'){
 const input=typeof masterMaterial==='string'?Buffer.from(masterMaterial):Buffer.from(masterMaterial);if(input.length<32||!validId(keyVersion))throw fail();const kek=createHash('sha256').update(input).digest();
 return Object.freeze({
  encrypt(connectionId:string,tenantId:string,refreshToken:string):XeroEnvelope{if(!validId(refreshToken)||Buffer.byteLength(refreshToken)>8192)throw fail();const aad=context(connectionId,tenantId,keyVersion),dek=randomBytes(32);try{return Object.freeze({ciphertext:seal(dek,Buffer.from(refreshToken),aad),encryptedDek:seal(kek,dek,aad),keyVersion,algorithm});}finally{dek.fill(0);}},
  decrypt(input:XeroEnvelope&{connectionId:string;tenantId:string}):string{if(input.algorithm!==algorithm||input.keyVersion!==keyVersion)throw fail();let dek:Buffer|undefined;try{const aad=context(input.connectionId,input.tenantId,input.keyVersion);dek=open(kek,input.encryptedDek,aad);if(dek.length!==32)throw fail();const plain=open(dek,input.ciphertext,aad);if(!plain.length||plain.length>8192)throw fail();return plain.toString('utf8');}catch{throw fail();}finally{dek?.fill(0);}}
 });
}

/** Fixed RPC functions only: callers cannot select a table/function or interpolate SQL. */
export function createXeroCredentialPersistence(rpc:XeroWorkerRpc){
 if(!rpc||typeof rpc.call!=='function')throw fail();return Object.freeze({
  async getRefreshEnvelope(connectionId:string):Promise<StoredXeroEnvelope|null>{if(!validId(connectionId))throw fail();let rows;try{rows=await rpc.call('xero_v1.worker_get_refresh_envelope',[connectionId]);}catch{throw fail();}if(rows.length===0)return null;if(rows.length!==1)throw fail();const row=rows[0],ciphertext=bytea(row.ciphertext),encryptedDek=bytea(row.encrypted_dek??row.encryptedDek),tenantId=row.tenant_id??row.tenantId,returned=row.connection_id??row.connectionId,keyVersion=row.key_version??row.keyVersion,lease=('lease_expires_at' in row?row.lease_expires_at:row.leaseExpiresAt);if(!validId(returned)||returned!==connectionId||!validId(tenantId)||!validId(keyVersion)||row.algorithm!==algorithm||!validVersion(row.version)||!ciphertext||!encryptedDek||ciphertext.length>16384||encryptedDek.length>16384||(lease!==null&&typeof lease!=='string'))throw fail();return Object.freeze({connectionId,tenantId,ciphertext,encryptedDek,keyVersion,algorithm,version:row.version,leaseExpiresAt:lease});},
  async storeRefreshEnvelope(input:StoredXeroEnvelope):Promise<void>{if(!input||!validId(input.connectionId)||!validId(input.tenantId)||!validId(input.keyVersion)||input.algorithm!==algorithm||!validVersion(input.version)||!Buffer.isBuffer(input.ciphertext)||!Buffer.isBuffer(input.encryptedDek)||input.ciphertext.length<1||input.ciphertext.length>16384||input.encryptedDek.length<1||input.encryptedDek.length>16384||(input.leaseExpiresAt!==null&&typeof input.leaseExpiresAt!=='string'))throw fail();try{await rpc.call('xero_v1.worker_store_refresh_envelope',[input.connectionId,input.ciphertext,input.encryptedDek,input.keyVersion,input.algorithm,input.version,input.leaseExpiresAt]);}catch{throw fail();}},
  async recordRefreshFailure(connectionId:string,safeReason:RefreshFailure):Promise<void>{if(!validId(connectionId)||!reasons.has(safeReason))throw fail();try{await rpc.call('xero_v1.worker_record_credential_refresh_failure',[connectionId,safeReason]);}catch{throw fail();}}
 });
}
