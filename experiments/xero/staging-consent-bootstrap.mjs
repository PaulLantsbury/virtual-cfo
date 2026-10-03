/**
 * Server-only composition for accepting a single Xero OAuth callback in staging.
 *
 * All provider, encryption and database capabilities are injected.  This module
 * does not read an environment, emit logs, make network calls or expose token
 * material.  It returns only a safe connection receipt.  The caller must have
 * already consumed its signed, one-time OAuth state before invoking complete.
 */
export function createStagingXeroConsentBootstrap({exchangeAuthorizationCode,encryptRefreshCredential,persistConnection,now=()=>new Date().toISOString()}={}){
 if(typeof exchangeAuthorizationCode!=='function'||typeof encryptRefreshCredential!=='function'||typeof persistConnection!=='function'||typeof now!=='function')throw Error('Xero staging consent configuration is invalid');
 return Object.freeze({
  async complete({authorizationCode,storeId,expectedTenantId}={}){
   if(!code(authorizationCode)||!identifier(storeId)||!identifier(expectedTenantId))throw Error('Xero staging consent unavailable');
   let exchange;
   try {
    // The exchange port can perform token exchange and tenant discovery in one
    // private operation.  Its access token must never cross this boundary.
    exchange=await exchangeAuthorizationCode(Object.freeze({authorizationCode}));
    if(!validExchange(exchange)||exchange.tenantId!==expectedTenantId)throw safeFailure('tenant_unavailable');
    const envelope=await encryptRefreshCredential(exchange.refreshCredential);
    if(!validEnvelope(envelope))throw safeFailure('refresh_failed');
    const receipt=await persistConnection(Object.freeze({storeId,tenantId:exchange.tenantId,envelope:freezeEnvelope(envelope),recordedAt:timestamp(now())}));
    if(!validReceipt(receipt))throw safeFailure('refresh_failed');
    // Deliberately return only values that are safe for an API response/audit.
    return Object.freeze({connectionId:receipt.connectionId,storeId,tenantId:exchange.tenantId,status:'connected'});
   } catch(error) {
    // Provider/encryption/database implementations may carry sensitive details.
    // They are never propagated to a route, audit record or caller.
    throw Error('Xero staging consent unavailable');
   } finally {
    // Shorten accidental retention in this coordinator.  Runtime memory handling
    // remains the responsibility of the trusted ports and host process.
    exchange=undefined;
   }
  },
 });
}
function code(value){return typeof value==='string'&&value.length>=8&&value.length<=4096}
function identifier(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value)}
function validExchange(value){return plain(value)&&Object.keys(value).sort().join(',')==='refreshCredential,tenantId'&&typeof value.refreshCredential==='string'&&value.refreshCredential.length>=16&&value.refreshCredential.length<=4096&&identifier(value.tenantId)}
function validEnvelope(value){return plain(value)&&Object.keys(value).sort().join(',')==='algorithm,ciphertext,encryptedDek,keyVersion'&&value.algorithm==='AES-256-GCM'&&typeof value.ciphertext==='string'&&value.ciphertext.startsWith('sealed:')&&value.ciphertext.length<=4096&&typeof value.encryptedDek==='string'&&value.encryptedDek.startsWith('wrapped:')&&value.encryptedDek.length<=4096&&identifier(value.keyVersion)}
function freezeEnvelope(value){return Object.freeze({algorithm:value.algorithm,ciphertext:value.ciphertext,encryptedDek:value.encryptedDek,keyVersion:value.keyVersion})}
function validReceipt(value){return plain(value)&&Object.keys(value).length===1&&identifier(value.connectionId)}
function timestamp(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('invalid timestamp');return value}
function plain(value){return value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype}
function safeFailure(reason){const error=new Error(reason);error.safeReason=reason;return error}
