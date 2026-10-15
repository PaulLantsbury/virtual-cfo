/** Pure transaction contract; not an OAuth handler or a persistence implementation. */
const unavailable = () => { throw new Error('Xero reconnect unavailable'); };
const opaque = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const live = (x, now) => Number.isSafeInteger(x) && x > now;
function authorized(context, connection, now) {
  if (!Number.isSafeInteger(now) || !context || !connection || context.verified !== true ||
      context.owner !== true || context.membershipActive !== true ||
      !opaque(context.actorId) || !opaque(context.sessionBinding) ||
      context.storeId !== connection.storeId || connection.retired ||
      !opaque(connection.id) || !opaque(connection.tenantId) ||
      !Number.isSafeInteger(connection.credentialVersion) || connection.credentialVersion < 1 || connection.credentialVersion >= Number.MAX_SAFE_INTEGER ||
      (connection.leaseExpiresAt !== null && (!Number.isSafeInteger(connection.leaseExpiresAt) || connection.leaseExpiresAt > now))) unavailable();
}
/** All inputs are server-loaded/verified. Caller cannot assert membership/provider proof. */
export function planReconnectStart({context, connection, activeAttempt = null, now, attemptId, stateDigest, expiresAt, scopeVersion}) {
  authorized(context, connection, now);
  if (!opaque(attemptId) || typeof stateDigest !== 'string' || !/^[a-f0-9]{64}$/.test(stateDigest) ||
      !opaque(scopeVersion) || scopeVersion !== connection.scopeVersion ||
      !live(expiresAt, now) || expiresAt - now > 600_000 ||
      (activeAttempt && ['pending', 'exchanging'].includes(activeAttempt.status) && (!Number.isSafeInteger(activeAttempt.expiresAt) || live(activeAttempt.expiresAt, now)))) unavailable();
  return Object.freeze({id: attemptId, connectionId: connection.id, storeId: connection.storeId,
    actorId: context.actorId, sessionBinding: context.sessionBinding, tenantId: connection.tenantId,
    expectedVersion: connection.credentialVersion, scopeVersion, stateDigest, createdAt: now,
    expiresAt, status: 'pending'});
}
export function planReconnectCommit({context, connection, attempt, proof, now}) {
  authorized(context, connection, now);
  if (!attempt || attempt.status !== 'exchanging' || !opaque(attempt.exchangeClaimId) || !live(attempt.expiresAt, now) || now < attempt.createdAt ||
      attempt.connectionId !== connection.id || attempt.storeId !== connection.storeId ||
      attempt.tenantId !== connection.tenantId || attempt.actorId !== context.actorId ||
      attempt.sessionBinding !== context.sessionBinding || attempt.expectedVersion !== connection.credentialVersion ||
      attempt.scopeVersion !== connection.scopeVersion || !proof || proof.serverVerified !== true ||
      proof.exchangeClaimId !== attempt.exchangeClaimId || proof.attemptId !== attempt.id || proof.stateDigest !== attempt.stateDigest ||
      proof.tenantId !== attempt.tenantId || proof.scopeVersion !== attempt.scopeVersion ||
      !Number.isSafeInteger(proof.consentedAt) || proof.consentedAt < attempt.createdAt || proof.consentedAt > now ||
      proof.freshCodeExchange !== true || proof.offlineAccess !== true || proof.envelopeValidated !== true ||
      !opaque(proof.stagedEnvelopeId)) unavailable();
  // Adapter must execute the complete command under one transaction and compare-and-swap.
  return Object.freeze({kind: 'replace_credential_and_consume_attempt', attemptId: attempt.id,
    connectionId: connection.id, storeId: connection.storeId, tenantId: connection.tenantId,
    expectedVersion: attempt.expectedVersion, replacementVersion: attempt.expectedVersion + 1,
    stagedEnvelopeId: proof.stagedEnvelopeId, consumedAt: now, preserveMapping: true,
    preserveEvidence: true, auditAction: 'member_reconnected'});
}
