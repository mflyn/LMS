const axios = require('axios');
const C = require('./ai1Contract');
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o)
  && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const invalid = () => C.error(503, 'AI_REMOTE_CONTRACT_INVALID');
function buildRequest(job) {
  const p = job.preview;
  if (p.providerProfile !== 'ai3-practice-v1' || p.promptVersion !== 'ai3-practice-prompt-v1'
    || p.outputSchemaVersion !== 'ai3-practice-content-v1') throw invalid();
  const body = JSON.parse(JSON.stringify({ schemaVersion: 'ai3-provider-operation-v1', providerProfile: p.providerProfile,
    promptVersion: p.promptVersion, outputSchemaVersion: p.outputSchemaVersion, modelProfileVersion: p.modelProfileVersion,
    pricingProfileVersion: p.pricingProfileVersion, messages: p.messages, requestOptions: p.requestOptions,
    reservedCeilingMicros: p.reservedCeilingMicros, sendNotAfter: p.sendNotAfter }));
  const request = { ...body, requestHash: C.hash(body) };
  // Match the actual JSON wire body, including escaping, envelope and digest.
  if (Buffer.byteLength(JSON.stringify(request), 'utf8') > 32768) throw C.error(413, 'AI_INPUT_TOO_LARGE');
  return request;
}
function validateMapping(command) {
  const job = command.generation || command;
  if (!job || !uuid(job.remoteOperationId) || !job.preview || !iso(job.preview.sendNotAfter)
    || job.remoteRequestHash !== buildRequest(job).requestHash
    || (job.sendNotAfter && new Date(job.sendNotAfter).toISOString() !== job.preview.sendNotAfter)) throw invalid();
  return job;
}
function validateOperation(command, o) {
  const job = validateMapping(command);
  const request = buildRequest(job);
  if (!exact(o, ['providerProfile', 'remoteOperationId', 'requestHash', 'modelProfileVersion', 'pricingProfileVersion', 'sendNotAfter',
    'status', 'result', 'error', 'usage', 'sendClaimed', 'updatedAt']) || !iso(o.updatedAt)
    || o.providerProfile !== 'ai3-practice-v1' || o.remoteOperationId !== job.remoteOperationId || o.requestHash !== request.requestHash
    || (job.remoteRequestHash && job.remoteRequestHash !== request.requestHash)
    || o.modelProfileVersion !== request.modelProfileVersion || o.pricingProfileVersion !== request.pricingProfileVersion
    || o.sendNotAfter !== request.sendNotAfter || typeof o.sendClaimed !== 'boolean') throw invalid();
  if (o.usage !== null) {
    if (!exact(o.usage, ['inputTokens', 'outputTokens'])) throw invalid();
    try { if (C.costCeiling(o.usage.inputTokens, o.usage.outputTokens, job.preview.pricing) > request.reservedCeilingMicros) throw invalid(); }
    catch { throw invalid(); }
  }
  if (o.status === 'succeeded') {
    if (!o.sendClaimed || o.error !== null || !exact(o.result, ['text', 'contentHash'])
      || typeof o.result.text !== 'string' || !o.result.text.trim() || [...o.result.text].length > 12000
      || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(o.result.text)
      || o.result.text.includes('\r\n') || C.sha(o.result.text) !== o.result.contentHash) throw invalid();
  } else {
    if (o.result !== null) throw invalid();
    if (['accepted', 'sending'].includes(o.status)) {
      if (o.error !== null || o.usage !== null || o.sendClaimed !== (o.status === 'sending')) throw invalid();
    } else if (o.status === 'failed_not_sent') {
      if (o.sendClaimed || o.usage !== null || !['VALIDATION_ERROR', 'PROFILE_UNAVAILABLE', 'PREVIEW_STALE'].includes(o.error)) throw invalid();
    } else if (o.status === 'failed_sent') {
      if (!o.sendClaimed || o.error !== 'PROVIDER_FAILED') throw invalid();
    } else if (o.status === 'unknown') {
      if (!o.sendClaimed || o.error !== 'RESULT_UNKNOWN' || o.usage !== null) throw invalid();
    } else throw invalid();
  }
  return JSON.parse(JSON.stringify(o));
}
function createOperationClient({ baseUrl, token, allowLoopback = false, timeout = 5000 } = {}) {
  let base;
  try { base = new URL(baseUrl); } catch { throw C.error(503, 'AI_PROFILE_UNAVAILABLE'); }
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/'
    || !(base.protocol === 'https:' || (allowLoopback && base.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(base.hostname)))
    || typeof token !== 'string' || !/^[\x21-\x7e]{32,256}$/.test(token)
    || !Number.isInteger(timeout) || timeout < 1 || timeout > 10000) throw C.error(503, 'AI_PROFILE_UNAVAILABLE');
  // Private Axios instance: no application interceptors, proxy inheritance, redirects or retries.
  const transport = axios.create({ timeout, maxRedirects: 0, proxy: false, maxContentLength: 65536, maxBodyLength: 65536,
    responseType: 'text', validateStatus: () => true });
  const send = async (method, command) => {
    const job = validateMapping(command);
    if (!uuid(job.remoteOperationId)) throw invalid();
    const request = buildRequest(job);
    if ((job.remoteRequestHash && job.remoteRequestHash !== request.requestHash)
      || (job.sendNotAfter && new Date(job.sendNotAfter).toISOString() !== request.sendNotAfter)) throw invalid();
    let response;
    try {
      response = await transport.request({ method, url: new URL(`/internal/deeptutor/ai3/operations/${job.remoteOperationId}`, base).href,
        headers: { 'x-ai1-service-token': token }, ...(method === 'PUT' ? { data: request } : {}) });
    } catch { throw C.error(503, 'AI_REMOTE_UNAVAILABLE'); }
    let body;
    try { body = JSON.parse(response.data); } catch { throw C.error(503, 'AI_REMOTE_UNAVAILABLE'); }
    if ([200, ...(method === 'PUT' ? [201] : [])].includes(response.status)) {
      if (!exact(body, ['success', 'data']) || body.success !== true || !exact(body.data, ['operation'])) throw invalid();
      return validateOperation(job, body.data.operation);
    }
    if (response.status === 503 && exact(body, ['success', 'error']) && body.success === false
      && exact(body.error, ['code', 'message', 'details']) && body.error.code === 'AI_STORE_ISOLATED'
      && body.error.message === 'AI_STORE_ISOLATED' && Array.isArray(body.error.details) && !body.error.details.length) {
      throw C.error(503, 'AI_STORE_ISOLATED');
    }
    throw C.error(503, 'AI_REMOTE_UNAVAILABLE');
  };
  return { put: job => send('PUT', job), get: job => send('GET', job) };
}
module.exports = { buildRequest, validateMapping, validateOperation, createOperationClient };
