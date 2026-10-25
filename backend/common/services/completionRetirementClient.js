const ID = /^[0-9a-f]{24}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fields = ['familyId', 'childId', 'mediaId', 'retirementId'];
const pending = () => Object.assign(new Error('Media retirement is pending'), {
  status: 503, statusCode: 503, code: 'MEDIA_RETIREMENT_PENDING'
});
const shape = (value, keys) => value !== null && typeof value === 'object'
  && (Object.getPrototypeOf(value) === null || Object.getPrototypeOf(Object.getPrototypeOf(value)) === null)
  && Reflect.ownKeys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
const validCommand = value => shape(value, fields) && fields.every(key => typeof value[key] === 'string'
  && (key === 'retirementId' ? UUID : ID).test(value[key]));

const createCompletionRetirementClient = ({ baseUrl, token, timeoutMs = 3000, fetchImpl = globalThis.fetch } = {}) => {
  let endpoint;
  try {
    const url = new URL(baseUrl);
    if (typeof baseUrl !== 'string' || baseUrl !== baseUrl.trim() || !['http:', 'https:'].includes(url.protocol)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/'
      || typeof token !== 'string' || !/^[\x21-\x7e]{32,}$/.test(token)
      || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647
      || typeof fetchImpl !== 'function') throw pending();
    endpoint = new URL('/api/internal/completion-media-retirements', url).href;
  } catch (_cause) { throw pending(); }

  const request = async (input, suffix, states) => {
    let timer;
    const controller = new AbortController();
    try {
      if (!validCommand(input)) throw pending();
      const command = Object.fromEntries(fields.map(key => [key, input[key]]));
      const deadline = new Promise((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(pending()); }, timeoutMs);
      });
      const execute = async () => {
        const response = await fetchImpl(endpoint + suffix, { method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { 'content-type': 'application/json', 'x-service-token': token }, body: JSON.stringify(command) });
        if (response.status !== 200 || response.redirected) throw pending();
        const envelope = await response.json();
        if (!shape(envelope, ['success', 'data']) || envelope.success !== true
          || !shape(envelope.data, [...fields, 'state'])
          || fields.some(key => envelope.data[key] !== command[key])
          || !states.includes(envelope.data.state)) throw pending();
        return { ...command, state: envelope.data.state };
      };
      return await Promise.race([execute(), deadline]);
    } catch (_cause) {
      // Unknown transport outcomes never prove a grant and must not expose upstream data or credentials.
      throw pending();
    } finally { clearTimeout(timer); controller.abort(); }
  };
  return {
    retire: input => request(input, '', ['granted', 'in_use']),
    status: input => request(input, '/status', ['absent', 'available', 'retired'])
  };
};

module.exports = { createCompletionRetirementClient };
