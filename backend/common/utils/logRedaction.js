const SENSITIVE_QUERY_KEYS = new Set([
  'access_token',
  'credential',
  'nonce',
  'secret',
  'signature',
  'token'
]);

const SIGNED_MEDIA_CONTENT_PATH = /^\/api\/media\/[^/]+\/content\/?$/;
const INVALID_PERCENT_ENCODING = /%(?![0-9a-f]{2})/i;

const queryFreePath = (value) => {
  if (typeof value !== 'string' || value.length === 0) return '/';

  const path = value.split(/[?#]/, 1)[0];
  return path || '/';
};

const redactUrlForLogs = (value) => {
  if (typeof value !== 'string' || value.length === 0) return '/';
  if (INVALID_PERCENT_ENCODING.test(value)) return queryFreePath(value);

  try {
    const parsed = new URL(value, 'http://local.invalid');

    if (SIGNED_MEDIA_CONTENT_PATH.test(parsed.pathname)) {
      return parsed.pathname;
    }

    const keys = [...new Set(parsed.searchParams.keys())];
    keys.forEach((key) => {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    });

    const query = parsed.searchParams.toString();
    return query ? `${parsed.pathname}?${query}` : parsed.pathname;
  } catch (error) {
    return queryFreePath(value);
  }
};

module.exports = {
  redactUrlForLogs
};
