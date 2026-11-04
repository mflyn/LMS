const Ajv = require('ajv/dist/2020');
const { canonicalize } = require('json-canonicalize');
const { createHash } = require('crypto');
const error = (statusCode, code) => Object.assign(new Error(code), { statusCode, code, details: [] });
const hash = value => createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
const id = { type: 'string', pattern: '^[a-f0-9]{24}$' };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const version = { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const common = { schemaVersion: { const: 'ai2-min-v1' },
  operationId: { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' } };
const shapes = {
  submit: { expectedPackageVersion: version, note: { type: 'string', maxLength: 1000 },
    mediaIds: { type: 'array', items: id, minItems: 1, maxItems: 10, uniqueItems: true } },
  recover: {},
  publish: { cycleId: id, expectedCycleStateVersion: version, artifactId: id, artifactVersion: version,
    artifactContentHash: digest, expectedArtifactReviewVersion: version, childSnapshotHash: digest, childContentConfirmed: { const: true } },
  withdraw: { expectedPackageVersion: version, reason: { type: 'string', minLength: 1, maxLength: 500, pattern: '\\S' } },
  review: { expectedPackageVersion: version, expectedAttemptVersion: version, attemptPayloadHash: digest,
    decision: { enum: ['approve', 'revise'] }, comment: { type: 'string', maxLength: 1000 } }
};
const ajv = new Ajv({ strict: true });
const validators = Object.fromEntries(Object.entries(shapes).map(([action, fields]) => {
  const properties = { ...common, ...fields };
  return [action, ajv.compile({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })];
}));
const clean = value => {
  if (Array.isArray(value)) return Array.from(value, clean);
  if (typeof value === 'string') {
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw error(400, 'VALIDATION_ERROR');
    return value.replace(/\r\n/g, '\n');
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
  }
  return value;
};
function normalize(action, body) {
  let serialized;
  try { serialized = JSON.stringify(body); } catch (_) { throw error(400, 'VALIDATION_ERROR'); }
  if (typeof serialized !== 'string') throw error(400, 'VALIDATION_ERROR');
  if (Buffer.byteLength(serialized, 'utf8') > 32768) throw error(413, 'AI2_INPUT_TOO_LARGE');
  const value = clean(body);
  if (!validators[action]?.(value) || (action === 'review' && value.decision === 'revise' && !value.comment.trim())) {
    throw error(400, 'VALIDATION_ERROR');
  }
  return value;
}
function pagination(page = 1, pageSize = 20) {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
    || !Number.isSafeInteger((page - 1) * pageSize)) throw error(400, 'VALIDATION_ERROR');
  return { page, pageSize, skip: (page - 1) * pageSize };
}
module.exports = { error, hash, normalize, pagination,
  isId: value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value),
  requestHash: (action, path, body) => hash({ method: 'POST', path, endpointOperation: `ai2.${action}`, body }) };
