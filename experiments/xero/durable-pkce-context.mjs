/** Server-only, disconnected OAuth context encryption. No routes or storage. */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
const PURPOSE = 'night-scout:xero:durable-pkce-context:v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[a-f0-9]{64}$/;
const KEY_ID = /^[A-Za-z0-9._-]{1,64}$/;
const BASE_FIELDS = ['storeId','ownerId','sessionDigest','attemptId','stateDigest','tenantId','connectionId','credentialVersion'];
const unavailable = () => Error('Durable OAuth context unavailable');
const exact = (value, fields) => value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === fields.length && fields.every(k => Object.hasOwn(value,k));
function validBinding(value, phase) {
 const fields = phase === 'exchanging' ? [...BASE_FIELDS,'exchangeClaim'] : BASE_FIELDS;
 return exact(value, fields) && ['storeId','ownerId','attemptId','tenantId','connectionId',...(phase === 'exchanging' ? ['exchangeClaim'] : [])].every(k=>typeof value[k]==='string'&&UUID.test(value[k])) && ['sessionDigest','stateDigest'].every(k=>typeof value[k]==='string'&&DIGEST.test(value[k])) && Number.isSafeInteger(value.credentialVersion) && value.credentialVersion>0 && value.credentialVersion<Number.MAX_SAFE_INTEGER;
}
const same = (a,b) => Object.keys(a).every(k=>a[k]===b[k]);
const encode = b => b.toString('base64url');
function decode(s, max) { if(typeof s!=='string'||s.length>max||!s.length||!/^[A-Za-z0-9_-]+$/.test(s))throw unavailable(); const b=Buffer.from(s,'base64url');if(encode(b)!==s)throw unavailable();return b; }
/** Keys must be generated independently from refresh-envelope keys and provided
 * only by trusted server configuration. Historical keys permit rotation reads;
 * only activeKeyId encrypts. No request-supplied clock or key selection. */
export function createDurablePkceContext({enabled=false,keyPurpose,activeKeyId,keys}={}) {
 if(enabled!==true)return Object.freeze({enabled:false,seal(){throw unavailable();},open(){throw unavailable();}});
 if(keyPurpose!==PURPOSE||typeof activeKeyId!=='string'||!KEY_ID.test(activeKeyId)||!(keys instanceof Map)||keys.size<1||keys.size>8)throw unavailable();
 const ring=new Map();for(const [id,key] of keys){if(typeof id!=='string'||!KEY_ID.test(id)||!Buffer.isBuffer(key)||key.length!==32)throw unavailable();ring.set(id,Buffer.from(key));}if(!ring.has(activeKeyId))throw unavailable();
 return Object.freeze({enabled:true,
  seal({phase,binding,pkceVerifier,expiresAt}={}) {try {
   const now=Date.now();if(!['authorization','exchanging'].includes(phase)||!validBinding(binding,phase)||typeof pkceVerifier!=='string'||!/^[A-Za-z0-9._~-]{43,128}$/.test(pkceVerifier)||!Number.isSafeInteger(expiresAt)||expiresAt<=now||expiresAt>now+600000)throw unavailable();
   const payload=Buffer.from(JSON.stringify({phase,binding,pkceVerifier,issuedAt:now,expiresAt}));
   const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',ring.get(activeKeyId),iv);cipher.setAAD(Buffer.from(`${PURPOSE}:${activeKeyId}`));const encrypted=Buffer.concat([cipher.update(payload),cipher.final()]);
   return `${activeKeyId}.${encode(Buffer.concat([iv,cipher.getAuthTag(),encrypted]))}`;
  }catch{throw unavailable();}},
  /** Expected binding comes from authenticated session + saved attempt, never
   * browser identity flags. The returned verifier is server-private secret. */
  open(capsule,{phase,binding}={}) {try {
   if(typeof capsule!=='string'||capsule.length>4096||!['authorization','exchanging'].includes(phase)||!validBinding(binding,phase))throw unavailable();
   const dot=capsule.lastIndexOf('.'),id=capsule.slice(0,dot),wire=decode(capsule.slice(dot+1),4000);if(dot<1||!ring.has(id)||wire.length<29)throw unavailable();
   const decipher=createDecipheriv('aes-256-gcm',ring.get(id),wire.subarray(0,12));decipher.setAAD(Buffer.from(`${PURPOSE}:${id}`));decipher.setAuthTag(wire.subarray(12,28));
   const p=JSON.parse(Buffer.concat([decipher.update(wire.subarray(28)),decipher.final()]).toString('utf8')),now=Date.now();
   if(!exact(p,['phase','binding','pkceVerifier','issuedAt','expiresAt'])||p.phase!==phase||!validBinding(p.binding,phase)||!same(binding,p.binding)||typeof p.pkceVerifier!=='string'||!/^[A-Za-z0-9._~-]{43,128}$/.test(p.pkceVerifier)||!Number.isSafeInteger(p.issuedAt)||!Number.isSafeInteger(p.expiresAt)||p.issuedAt>now||p.expiresAt<=now||p.expiresAt<=p.issuedAt||p.expiresAt-p.issuedAt>600000)throw unavailable();
   return Object.freeze({phase,binding:Object.freeze({...p.binding}),pkceVerifier:p.pkceVerifier,issuedAt:p.issuedAt,expiresAt:p.expiresAt});
  }catch{throw unavailable();}}
 });
}
export const DURABLE_PKCE_KEY_PURPOSE=PURPOSE;
