const express = require('express');
const { createHash, timingSafeEqual } = require('crypto');
const C = require('../services/ai3ReviewEvidence');

const MAX_BYTES = 32768;
const id = value => typeof value === 'string' && /^[a-f0-9]{24}(?![\s\S])/.test(value);
const uuid = value => typeof value === 'string'
  && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/.test(value);
const digest = value => createHash('sha256').update(value).digest();
const invalid = () => C.error(400, 'VALIDATION_ERROR');
const notFound = () => C.error(404, 'RESOURCE_NOT_FOUND');
const notReady = () => C.error(503, 'AI3_NOT_READY');
const unavailable = () => C.error(503, 'AI3_EVIDENCE_UNAVAILABLE');
const safeErrors = new Map([
  ['INVALID_SERVICE_CREDENTIAL', 401], ['VALIDATION_ERROR', 400], ['CHILD_ACCESS_DENIED', 403],
  ['RESOURCE_NOT_FOUND', 404], ['AI3_EFFECT_CONFLICT', 409], ['AI3_INPUT_TOO_LARGE', 413],
  ['AI3_NOT_READY', 503], ['AI3_EVIDENCE_UNAVAILABLE', 503]
]);

const readQuery = (req, fields) => {
  // Read the wire query: Express's object parser can discard prototype keys or expand nested values.
  const params = new URL(req.originalUrl, 'http://localhost').searchParams;
  if ([...params].length !== fields.length || [...params.keys()].some(key => !fields.includes(key))) throw invalid();
  return Object.fromEntries(fields.map(key => {
    const values = params.getAll(key);
    if (values.length !== 1 || !(key === 'effectId' ? uuid : id)(values[0])) throw invalid();
    return [key, values[0]];
  }));
};
const effectBody = bytes => {
  const body = C.normalizeEffectRequest(C.parseRaw(bytes));
  if (!['familyId', 'childId', 'reviewedByParentId', 'targetId', 'finalReviewId'].every(key => id(body[key]))
    || !uuid(body.effectId)) throw invalid();
  return body;
};

// Factory only. The service owner mounts this ahead of generic parsers at /api/internal/ai3.
function createAi3EvidenceRouter({ kind, serviceToken, service,
  assertContinuous = () => { throw notReady(); } } = {}) {
  const methods = kind === 'proof' ? ['getFinalReview'] : ['getContext', 'apply', 'getReceipt'];
  if (!['mistake', 'mastery', 'proof'].includes(kind) || typeof serviceToken !== 'string'
    || serviceToken.length < 32 || /[^\x21-\x7e]/.test(serviceToken)
    || typeof assertContinuous !== 'function' || methods.some(name => typeof service?.[name] !== 'function')) {
    throw new TypeError('AI3_EVIDENCE_CONFIGURATION_INVALID');
  }
  const expected = digest(serviceToken);
  const router = express.Router({ caseSensitive: true, strict: true });
  const raw = express.raw({ type: () => true, limit: MAX_BYTES });
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const supplied = req.get('x-ai3-evidence-token');
    const occurrences = req.rawHeaders.filter((value, index) => index % 2 === 0
      && value.toLowerCase() === 'x-ai3-evidence-token').length;
    if (occurrences !== 1 || typeof supplied !== 'string' || !timingSafeEqual(digest(supplied), expected)) {
      return next(C.error(401, 'INVALID_SERVICE_CREDENTIAL'));
    }
    if (!['GET', 'POST'].includes(req.method)) return next(notFound());
    next();
  });
  const parse = (req, res, next) => {
    if (req.body !== undefined || req._body) return next(notReady());
    raw(req, res, cause => {
      if (!cause) return next();
      if (cause.type === 'entity.too.large') return next(C.error(413, 'AI3_INPUT_TOO_LARGE'));
      next(invalid());
    });
  };
  const handle = (method, buildInput) => async (req, res, next) => {
    try {
      const input = buildInput(req);
      if (await assertContinuous() === false) throw notReady();
      const data = await service[method](input);
      if (await assertContinuous() === false) throw notReady();
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw unavailable();
      const serialized = JSON.stringify({ success: true, data });
      if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES || serialized.includes(serviceToken)) throw unavailable();
      res.status(200).type('application/json').send(serialized);
    } catch (cause) { next(cause); }
  };
  const getInput = (fields, pathKey, pathValidator) => req => {
    if (Buffer.isBuffer(req.body) && req.body.length) throw invalid();
    if (!pathValidator(req.params.id)) throw invalid();
    return { ...readQuery(req, fields), [pathKey]: req.params.id };
  };
  if (kind === 'proof') {
    router.get('/final-reviews/:id', parse,
      handle('getFinalReview', getInput(['familyId', 'childId', 'effectId'], 'finalReviewId', id)));
  } else {
    const target = kind === 'mistake' ? 'mistakes' : 'knowledge-points';
    const effects = kind === 'mistake' ? 'mistake-review-effects' : 'mastery-effects';
    router.get(`/${target}/:id/review-context`, parse,
      handle('getContext', getInput(['familyId', 'childId', 'actorId'], 'targetId', id)));
    router.post(`/${effects}`, parse, handle('apply', req => {
      readQuery(req, []);
      if (!/^application\/json(?:\s*;\s*charset=(?:utf-8|"utf-8"))?\s*$/i.test(req.get('content-type') || '')) throw invalid();
      return { body: effectBody(req.body) };
    }));
    router.get(`/${effects}/:id`, parse,
      handle('getReceipt', getInput(['familyId', 'childId', 'actorId'], 'effectId', uuid)));
  }
  router.use((_req, _res, next) => next(notFound()));
  router.use((cause, _req, res, _next) => {
    const code = safeErrors.has(cause?.code) && safeErrors.get(cause.code) === cause.statusCode
      ? cause.code : 'AI3_EVIDENCE_UNAVAILABLE';
    res.set('Cache-Control', 'no-store');
    res.status(safeErrors.get(code)).json({ success: false, error: { code, message: code, details: [] } });
  });
  return router;
}

module.exports = { createAi3EvidenceRouter };
