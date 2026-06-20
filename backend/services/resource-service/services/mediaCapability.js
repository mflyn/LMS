const crypto = require('crypto');
const { AppError } = require('../../../common/middleware/errorTypes');

const MEDIA_ID_PATTERN = /^[0-9a-f]{24}$/i;
const NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/i;

const invalidCapability = () => new AppError(
  'Invalid media access capability',
  400,
  'VALIDATION_ERROR',
  true,
  []
);

const assertMediaId = (mediaId) => {
  if (typeof mediaId !== 'string' || !MEDIA_ID_PATTERN.test(mediaId)) {
    throw invalidCapability();
  }
};

const createMediaCapabilityService = ({
  secret,
  maxAgeSeconds = 300,
  now = Date.now,
  randomUUID = crypto.randomUUID,
  basePath = '/api/media'
} = {}) => {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('MEDIA_URL_SIGNING_SECRET must contain at least 32 characters');
  }
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1 || maxAgeSeconds > 300) {
    throw new Error('MEDIA_ACCESS_MAX_AGE_SECONDS must be between 1 and 300');
  }
  if (typeof basePath !== 'string' || !basePath.startsWith('/') || basePath.endsWith('/')) {
    throw new Error('Media capability basePath must be an absolute path without a trailing slash');
  }

  const pathFor = (mediaId) => `${basePath}/${mediaId}/content`;
  const canonicalPayload = ({ path, mediaId, expires, nonce }) => [
    'GET',
    path,
    mediaId,
    String(expires),
    nonce
  ].join('\n');
  const sign = (payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const issue = (mediaId) => {
    assertMediaId(mediaId);
    const nonce = randomUUID();
    if (typeof nonce !== 'string' || !NONCE_PATTERN.test(nonce)) {
      throw new Error('Media capability nonce generator must return a UUID');
    }
    const expires = Math.floor(Number(now()) / 1000) + maxAgeSeconds;
    const path = pathFor(mediaId);
    const signature = sign(canonicalPayload({ path, mediaId, expires, nonce }));
    const query = new URLSearchParams({ expires: String(expires), nonce, signature });

    return {
      url: `${path}?${query.toString()}`,
      expiresAt: new Date(expires * 1000).toISOString()
    };
  };

  const verify = ({ path, mediaId, expires, nonce, signature } = {}) => {
    assertMediaId(mediaId);
    const numericExpires = Number(expires);
    if (path !== pathFor(mediaId)
      || !Number.isSafeInteger(numericExpires)
      || String(numericExpires) !== String(expires)
      || typeof nonce !== 'string'
      || !NONCE_PATTERN.test(nonce)
      || typeof signature !== 'string'
      || !SIGNATURE_PATTERN.test(signature)) {
      throw invalidCapability();
    }

    const currentSeconds = Math.floor(Number(now()) / 1000);
    if (numericExpires <= currentSeconds || numericExpires - currentSeconds > maxAgeSeconds) {
      throw invalidCapability();
    }

    const expected = sign(canonicalPayload({
      path,
      mediaId,
      expires: numericExpires,
      nonce
    }));
    const providedBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (providedBuffer.length !== expectedBuffer.length
      || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw invalidCapability();
    }
    return true;
  };

  return { issue, verify };
};

module.exports = {
  MEDIA_ID_PATTERN,
  NONCE_PATTERN,
  SIGNATURE_PATTERN,
  createMediaCapabilityService
};
