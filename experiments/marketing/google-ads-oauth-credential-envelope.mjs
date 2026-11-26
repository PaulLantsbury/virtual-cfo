import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const fail = () => new Error('Google Ads credential unavailable');
const keyVersionPattern = /^[A-Za-z0-9._-]{1,128}$/;
const idPattern = /^[A-Za-z0-9._:-]{1,200}$/;
const algorithm = 'AES-256-GCM';

function aad(connectionId, storeId, keyVersion) {
  if (!idPattern.test(connectionId ?? '') || !idPattern.test(storeId ?? '')
    || !keyVersionPattern.test(keyVersion ?? '')) throw fail();
  return Buffer.from(`night-scout/google-ads/oauth-credential/v1|${connectionId}|${storeId}|${keyVersion}`);
}

function seal(key, plaintext, context) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
  cipher.setAAD(context);
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), body]);
}

function open(key, payload, context) {
  if (!Buffer.isBuffer(payload) || payload.length < 30 || payload.length > 16_384 || payload[0] !== 1) throw fail();
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(1, 13), { authTagLength: 16 });
  decipher.setAAD(context);
  decipher.setAuthTag(payload.subarray(13, 29));
  return Buffer.concat([decipher.update(payload.subarray(29)), decipher.final()]);
}

/**
 * Per-record envelope encryption for Google Ads user refresh tokens. Supply a
 * high-entropy server secret (32+ bytes) and persist the returned ciphertext,
 * encrypted DEK, algorithm, and key version only. This envelope deliberately
 * excludes Google's application client ID/secret, which belong in the runtime
 * secret store and are not user connection credentials.
 */
export function createGoogleAdsOAuthCredentialEnvelope(masterMaterial, keyVersion = 'google-ads-staging-v1') {
  if (typeof masterMaterial !== 'string' && !Buffer.isBuffer(masterMaterial)) throw fail();
  const material = Buffer.from(masterMaterial);
  if (material.length < 32 || material.length > 4096 || !keyVersionPattern.test(keyVersion)) throw fail();
  const kek = createHash('sha256').update(material).digest();
  material.fill(0);

  return Object.freeze({
    encrypt({ connectionId, storeId, refreshToken }) {
      if (typeof refreshToken !== 'string' || refreshToken.length < 16 || Buffer.byteLength(refreshToken) > 16_384
        || /[\r\n]/.test(refreshToken)) throw fail();
      const context = aad(connectionId, storeId, keyVersion);
      const dek = randomBytes(32);
      const tokenBytes = Buffer.from(refreshToken);
      try {
        return Object.freeze({
          ciphertext: seal(dek, tokenBytes, context),
          encryptedDek: seal(kek, dek, context),
          algorithm,
          keyVersion,
        });
      } finally {
        dek.fill(0);
        tokenBytes.fill(0);
      }
    },

    decrypt({ connectionId, storeId, ciphertext, encryptedDek, storedAlgorithm, storedKeyVersion }) {
      if (storedAlgorithm !== algorithm || storedKeyVersion !== keyVersion) throw fail();
      const context = aad(connectionId, storeId, storedKeyVersion);
      let dek;
      let plaintext;
      try {
        dek = open(kek, encryptedDek, context);
        if (dek.length !== 32) throw fail();
        plaintext = open(dek, ciphertext, context);
        if (plaintext.length < 16 || plaintext.length > 16_384) throw fail();
        return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
      } catch { throw fail(); }
      finally {
        dek?.fill(0);
        plaintext?.fill(0);
      }
    },
  });
}
