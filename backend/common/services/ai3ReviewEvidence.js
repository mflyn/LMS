const Ajv = require('ajv/dist/2020');
const { canonicalize } = require('json-canonicalize');
const { createHash } = require('crypto');
const { TextDecoder } = require('util');
const { addLocalDateDays } = require('../utils/familyDate');

const error = (statusCode, code) => Object.assign(new Error(code), { statusCode, code, details: [] });
const invalid = () => error(400, 'VALIDATION_ERROR');
const conflict = () => error(409, 'AI3_EFFECT_CONFLICT');
const hash = value => createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
const id = { type: 'string', pattern: '^[a-f0-9]{24}$' };
const uuid = { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const revision = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const version = { ...revision, minimum: 1 };
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const time = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$' };
const text = maxLength => ({ type: 'string', maxLength });
const requiredText = maxLength => ({ ...text(maxLength), minLength: 1, pattern: '\\S' });
const target = { id, stateRevision: revision, effectId: uuid };
const requestFields = { schemaVersion: { const: 'ai3-review-effect-v1' }, effectId: uuid, finalReviewId: id,
  finalReviewHash: digest, familyId: id, childId: id, reviewedByParentId: id, targetId: id, expectedStateRevision: revision };
const snapshot = object({ schemaVersion: { const: 'ai3-final-review-v1' }, id, familyId: id, childId: id, roundId: id,
  sourcePackageId: id, sourceAttemptId: id, sourceAttemptVersion: version, sourceAttemptPayloadHash: digest,
  sourceReviewHash: digest, source: object({ type: { enum: ['task', 'mistake'] }, id }),
  contentId: id, contentVersion: version, contentHash: digest, childSnapshotHash: digest,
  attemptId: id, attemptVersion: version, attemptPayloadHash: digest, reviewedByParentId: id, reviewedAt: time,
  evidenceSummary: requiredText(1000), comment: text(1000), masteryConfirmed: { type: 'boolean' },
  reviewReminderDate: nullable({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  targets: object({ mistake: nullable(object({ ...target, knowledgePointId: nullable(id) })), knowledgePoint: nullable(object(target)) }) });
const effect = object({ kind: { enum: ['mistake', 'mastery'] }, effectId: uuid, targetId: id, expectedStateRevision: revision });
const ajv = new Ajv({ strict: true });
const schemas = {
  request: ajv.compile(object(requestFields)), snapshot: ajv.compile(snapshot),
  proof: ajv.compile(object({ finalReview: snapshot, finalReviewHash: digest, effect })),
  receipt: ajv.compile(object({ ...Object.fromEntries(Object.entries(requestFields).filter(([k]) => k !== 'schemaVersion')),
    status: { enum: ['applied', 'not_applied_conflict', 'not_applied_missing'] }, reviewedAt: time,
    appliedAt: nullable(time), decidedAt: time, eventId: nullable(id) }))
};

function plain(value, depth = 0) {
  if (depth > 8) throw invalid();
  if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value === 'string') {
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw invalid();
    return;
  }
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw invalid();
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw invalid();
    plain(descriptor.value, depth + 1);
  }
}
function validateShape(name, value) {
  plain(value);
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 32768) throw error(413, 'AI3_INPUT_TOO_LARGE');
  if (!schemas[name](value)) throw invalid();
  return value;
}
const canonicalTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
function normalizeEffectRequest(body) { return validateShape('request', body); }
function validateFinalReview(value) {
  validateShape('snapshot', value);
  if (!canonicalTime(value.reviewedAt)) throw invalid();
  if (value.reviewReminderDate !== null) {
    try { addLocalDateDays(value.reviewReminderDate, 0); } catch (_) { throw invalid(); }
  }
  const { mistake, knowledgePoint } = value.targets;
  if (value.source.type === 'mistake' ? !mistake || mistake.id !== value.source.id : mistake !== null) throw conflict();
  if (value.masteryConfirmed !== (knowledgePoint !== null)) throw conflict();
  if (mistake && knowledgePoint && (mistake.knowledgePointId !== knowledgePoint.id || mistake.effectId === knowledgePoint.effectId)) throw conflict();
  return value;
}
function validateProof(proof, request, kind) {
  normalizeEffectRequest(request); validateShape('proof', proof);
  const review = validateFinalReview(proof.finalReview);
  if (!['mistake', 'mastery'].includes(kind) || hash(review) !== proof.finalReviewHash
    || proof.finalReviewHash !== request.finalReviewHash || review.id !== request.finalReviewId
    || ['familyId', 'childId', 'reviewedByParentId'].some(key => review[key] !== request[key])) throw conflict();
  const selected = review.targets[kind === 'mistake' ? 'mistake' : 'knowledgePoint'];
  if (!selected || proof.effect.kind !== kind || proof.effect.effectId !== request.effectId
    || proof.effect.targetId !== request.targetId || proof.effect.expectedStateRevision !== request.expectedStateRevision
    || selected.effectId !== request.effectId || selected.id !== request.targetId
    || selected.stateRevision !== request.expectedStateRevision) throw conflict();
  return review;
}
function validateReceipt(receipt, request) {
  normalizeEffectRequest(request); validateShape('receipt', receipt);
  if (Object.keys(requestFields).filter(key => key !== 'schemaVersion').some(key => receipt[key] !== request[key])
    || !canonicalTime(receipt.reviewedAt) || !canonicalTime(receipt.decidedAt)) throw conflict();
  if (receipt.status === 'applied'
    ? !receipt.eventId || !canonicalTime(receipt.appliedAt) || receipt.decidedAt !== receipt.appliedAt
    : receipt.eventId !== null || receipt.appliedAt !== null) throw conflict();
  return receipt;
}
function parseRaw(bytes) {
  if (!Buffer.isBuffer(bytes)) throw invalid();
  if (bytes.length > 32768) throw error(413, 'AI3_INPUT_TOO_LARGE');
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (_) { throw invalid(); }
}
module.exports = { normalizeEffectRequest, validateFinalReview, validateProof, validateReceipt, parseRaw, hash, error };
