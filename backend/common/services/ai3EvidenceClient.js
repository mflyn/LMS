const C = require('./ai3ReviewEvidence');
const id = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
  && Reflect.ownKeys(value).length === keys.length && keys.every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key); return d?.enumerable && Object.hasOwn(d, 'value');
  });
const unavailable = () => C.error(503, 'AI3_EVIDENCE_UNAVAILABLE');
const invalid = () => C.error(400, 'VALIDATION_ERROR');
const remoteError = Symbol('validated-remote-error');
const stableErrors = new Map([
  ['INVALID_SERVICE_CREDENTIAL', 401], ['VALIDATION_ERROR', 400], ['CHILD_ACCESS_DENIED', 403],
  ['RESOURCE_NOT_FOUND', 404], ['AI3_EFFECT_CONFLICT', 409], ['AI3_INPUT_TOO_LARGE', 413],
  ['AI3_NOT_READY', 503], ['AI3_EVIDENCE_UNAVAILABLE', 503]
]);
function query(input, fields) {
  if (!closed(input, fields) || fields.some(key => !(key === 'effectId' ? uuid : id)(input[key]))) throw invalid();
  return input;
}
function context(value, kind, targetId) {
  const keys = kind === 'mistake' ? ['id', 'stateRevision', 'knowledgePointId'] : ['id', 'stateRevision'];
  if (!closed(value, keys) || value.id !== targetId || !Number.isSafeInteger(value.stateRevision) || value.stateRevision < 0
    || kind === 'mistake' && value.knowledgePointId !== null && !id(value.knowledgePointId)) throw unavailable();
  return value;
}
function createAi3EvidenceClient({ kind, baseUrl, serviceToken, fetchImpl = globalThis.fetch, timeoutMs = 3000 } = {}) {
  let base;
  try {
    base = new URL(baseUrl);
    if (!['mistake', 'mastery', 'proof'].includes(kind) || typeof baseUrl !== 'string' || !['http:', 'https:'].includes(base.protocol)
      || base.username || base.password || base.pathname !== '/' || base.search || base.hash
      || typeof serviceToken !== 'string' || serviceToken.length < 32 || /[\r\n]/.test(serviceToken)
      || typeof fetchImpl !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw Error();
  } catch (_) { throw new Error('AI3_EVIDENCE_CONFIGURATION_INVALID'); }
  const endpoint = `${base.origin}/api/internal/ai3`;
  const collection = kind === 'mistake' ? 'mistake-review-effects' : 'mastery-effects';
  async function call(method, suffix, input, body) {
    const controller = new AbortController();
    let timer, reader;
    const request = async () => {
      const url = `${endpoint}${suffix}${input ? '?' + new URLSearchParams(input).toString() : ''}`;
      const response = await fetchImpl(url, { method, redirect: 'error', signal: controller.signal,
        headers: { 'x-ai3-evidence-token': serviceToken, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      if (controller.signal.aborted) {
        Promise.resolve(response.body?.cancel()).catch(() => {});
        throw unavailable();
      }
      const length = response.headers.get('content-length');
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > 32768)) throw unavailable();
      reader = response.body?.getReader();
      if (!reader) throw unavailable();
      const chunks = []; let size = 0;
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 32768) throw unavailable();
        chunks.push(Buffer.from(chunk.value));
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.toString('utf8').includes(serviceToken)) throw unavailable();
      let value;
      try { value = C.parseRaw(bytes); } catch (_) { throw unavailable(); }
      if (response.status !== 200) {
        if (!closed(value, ['success', 'error']) || value.success !== false
          || !closed(value.error, ['code', 'message', 'details']) || !Array.isArray(value.error.details)
          || value.error.details.length || value.error.message !== value.error.code
          || stableErrors.get(value.error.code) !== response.status) throw unavailable();
        throw Object.assign(C.error(response.status, value.error.code), { [remoteError]: true });
      }
      if (!closed(value, ['success', 'data']) || value.success !== true) throw unavailable();
      return value.data;
    };
    try {
      return await Promise.race([request(), new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(unavailable()); }, timeoutMs);
      })]);
    } catch (e) {
      if (e?.[remoteError] === true && stableErrors.has(e.code) && stableErrors.get(e.code) === e.statusCode) throw C.error(e.statusCode, e.code);
      throw unavailable();
    } finally {
      clearTimeout(timer); controller.abort();
      if (reader) Promise.resolve(reader.cancel()).catch(() => {});
    }
  }
  return {
    async getContext(input) {
      if (kind === 'proof') throw invalid();
      const { targetId, ...scope } = query(input, ['familyId', 'childId', 'actorId', 'targetId']);
      const data = await call('GET', `/${kind === 'mistake' ? 'mistakes' : 'knowledge-points'}/${targetId}/review-context`, scope);
      return context(data, kind, targetId);
    },
    async apply({ body } = {}) {
      if (kind === 'proof') throw invalid();
      C.normalizeEffectRequest(body);
      const request = { ...body };
      const data = await call('POST', `/${collection}`, null, request);
      try { return C.validateReceipt(data, request); } catch (_) { throw unavailable(); }
    },
    async getReceipt(input) {
      if (kind === 'proof') throw invalid();
      const { effectId, ...scope } = query(input, ['familyId', 'childId', 'actorId', 'effectId']);
      const data = await call('GET', `/${collection}/${effectId}`, scope);
      try {
        if (!data || data.effectId !== effectId || data.familyId !== scope.familyId || data.childId !== scope.childId
          || data.reviewedByParentId !== scope.actorId) throw unavailable();
        const request = { schemaVersion: 'ai3-review-effect-v1', effectId, finalReviewId: data.finalReviewId,
          finalReviewHash: data.finalReviewHash, familyId: scope.familyId, childId: scope.childId,
          reviewedByParentId: scope.actorId, targetId: data.targetId, expectedStateRevision: data.expectedStateRevision };
        return C.validateReceipt(data, request);
      } catch (_) { throw unavailable(); }
    },
    async getFinalReview(input) {
      if (kind !== 'proof') throw invalid();
      const { finalReviewId, ...scope } = query(input, ['familyId', 'childId', 'effectId', 'finalReviewId']);
      const data = await call('GET', `/final-reviews/${finalReviewId}`, scope);
      try {
        const request = { schemaVersion: 'ai3-review-effect-v1', effectId: scope.effectId, finalReviewId,
          finalReviewHash: data.finalReviewHash, familyId: scope.familyId, childId: scope.childId,
          reviewedByParentId: data.finalReview.reviewedByParentId, targetId: data.effect.targetId,
          expectedStateRevision: data.effect.expectedStateRevision };
        C.validateProof(data, request, data.effect.kind); return data;
      } catch (_) { throw unavailable(); }
    }
  };
}
module.exports = { createAi3EvidenceClient };
