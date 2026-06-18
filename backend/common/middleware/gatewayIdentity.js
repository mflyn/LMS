const crypto = require('crypto');

const IDENTITY_HEADERS = [
  'x-user-id',
  'x-user-role',
  'x-user-name',
  'x-user-family-id',
  'x-user-child-id',
  'x-user-token-version',
  'x-gateway-timestamp',
  'x-gateway-nonce',
  'x-gateway-signature'
];

const MAX_AGE_MS = 300_000;
const nonceStore = new Map();

const assertSecret = (secret) => {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('GATEWAY_IDENTITY_SECRET must contain at least 32 characters');
  }
};

const headerValue = (headers, name) => {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
};

const normalizeRequestTarget = (originalUrl) => {
  const url = new URL(originalUrl || '/', 'http://gateway.local');
  const params = [...url.searchParams.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    ));
  const query = new URLSearchParams(params).toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
};

const stripClientIdentityHeaders = (headers) => {
  IDENTITY_HEADERS.forEach((name) => {
    delete headers[name];
  });
  return headers;
};

const canonicalPayload = ({ method, originalUrl, identity, timestamp, nonce }) => [
  String(method || '').toUpperCase(),
  normalizeRequestTarget(originalUrl),
  identity.id || '',
  identity.role || '',
  identity.username || '',
  identity.familyId || '',
  identity.childId || '',
  identity.tokenVersion === undefined ? '' : String(identity.tokenVersion),
  String(timestamp),
  nonce
].join('\n');

const signPayload = (payload, secret) => crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

const createIdentityHeaders = ({ method, originalUrl, user, secret, now = Date.now(), nonce = crypto.randomUUID() }) => {
  assertSecret(secret);
  const timestamp = Number(now);
  const identity = {
    id: String(user.id || user._id || ''),
    role: String(user.role || ''),
    username: String(user.username || ''),
    familyId: String(user.familyId || ''),
    childId: String(user.childId || (user.role === 'student' ? user.id || user._id || '' : '')),
    tokenVersion: user.tokenVersion
  };
  if (!identity.id || !identity.role) {
    throw new Error('Gateway identity requires id and role');
  }

  const payload = canonicalPayload({ method, originalUrl, identity, timestamp, nonce });
  return {
    'x-user-id': identity.id,
    'x-user-role': identity.role,
    'x-user-name': identity.username,
    'x-user-family-id': identity.familyId,
    'x-user-child-id': identity.childId,
    'x-user-token-version': identity.tokenVersion === undefined ? '' : String(identity.tokenVersion),
    'x-gateway-timestamp': String(timestamp),
    'x-gateway-nonce': nonce,
    'x-gateway-signature': signPayload(payload, secret)
  };
};

const makeEnvelopeError = (code) => {
  const error = new Error(code);
  error.code = code;
  return error;
};

const verifyIdentityEnvelope = ({ method, originalUrl, headers, secret, now = Date.now(), store = nonceStore }) => {
  assertSecret(secret);
  const identity = {
    id: String(headerValue(headers, 'x-user-id') || ''),
    role: String(headerValue(headers, 'x-user-role') || ''),
    username: String(headerValue(headers, 'x-user-name') || ''),
    familyId: String(headerValue(headers, 'x-user-family-id') || ''),
    childId: String(headerValue(headers, 'x-user-child-id') || ''),
    tokenVersion: headerValue(headers, 'x-user-token-version')
  };
  const timestamp = Number(headerValue(headers, 'x-gateway-timestamp'));
  const nonce = String(headerValue(headers, 'x-gateway-nonce') || '');
  const signature = String(headerValue(headers, 'x-gateway-signature') || '');

  if (!identity.id || !identity.role || !Number.isFinite(timestamp) || !nonce || !/^[a-f0-9]{64}$/.test(signature)) {
    throw makeEnvelopeError('INVALID_IDENTITY_ENVELOPE');
  }
  if (Math.abs(Number(now) - timestamp) > MAX_AGE_MS) {
    throw makeEnvelopeError('IDENTITY_ENVELOPE_EXPIRED');
  }

  const payload = canonicalPayload({ method, originalUrl, identity, timestamp, nonce });
  const expected = signPayload(payload, secret);
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    throw makeEnvelopeError('INVALID_IDENTITY_ENVELOPE');
  }

  for (const [storedNonce, expiresAt] of store.entries()) {
    if (expiresAt < Number(now)) store.delete(storedNonce);
  }
  if (store.has(nonce)) {
    throw makeEnvelopeError('IDENTITY_ENVELOPE_REPLAYED');
  }
  store.set(nonce, timestamp + MAX_AGE_MS);

  if (identity.tokenVersion !== '' && identity.tokenVersion !== undefined) {
    identity.tokenVersion = Number(identity.tokenVersion);
  } else {
    delete identity.tokenVersion;
  }
  if (!identity.username) delete identity.username;
  if (!identity.familyId) delete identity.familyId;
  if (!identity.childId) delete identity.childId;
  return identity;
};

const resetIdentityNonceStore = () => nonceStore.clear();

module.exports = {
  IDENTITY_HEADERS,
  MAX_AGE_MS,
  createIdentityHeaders,
  normalizeRequestTarget,
  resetIdentityNonceStore,
  stripClientIdentityHeaders,
  verifyIdentityEnvelope
};
