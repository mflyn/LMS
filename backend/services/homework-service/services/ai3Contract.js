const Ajv = require('ajv/dist/2020');
const { canonicalize } = require('json-canonicalize');
const { createHash } = require('crypto');
const { TextDecoder } = require('util');
const { addLocalDateDays } = require('../../../common/utils/familyDate');
const error = (statusCode, code) => Object.assign(new Error(code), { statusCode, code, details: [] });
const hash = value => createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
const id = { type: 'string', pattern: '^[a-f0-9]{24}$' };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const version = { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const nullable = value => ({ anyOf: [value, { type: 'null' }] });
const text = maxLength => ({ type: 'string', minLength: 1, maxLength, pattern: '\\S' });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const content = object({ instructions: text(500), exercises: { type: 'array', minItems: 2, maxItems: 3,
  items: object({ exerciseId: { enum: ['q1', 'q2', 'q3'] }, questionText: text(1000), answerForParent: text(1000), rubricForParent: text(1000) }) } });
const common = { schemaVersion: { const: 'ai3-min-v1' },
  operationId: { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' } };
const seen = { expectedRoundVersion: version, contentId: id, contentVersion: version, contentHash: digest };
const shapes = {
  review: { ...seen, expectedAttemptVersion: version, attemptPayloadHash: digest, decision: { enum: ['approve', 'revise'] },
    comment: { type: 'string', maxLength: 1000 }, evidenceSummary: { type: 'string', maxLength: 1000 },
    masteryConfirmed: { type: 'boolean' }, reviewReminderDate: nullable({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
    reviewContextHash: nullable(digest) },
  submit: { expectedRoundVersion: version, contentId: id, contentVersion: version, childSnapshotHash: digest,
    note: { type: 'string', maxLength: 1000 }, mediaIds: { type: 'array', minItems: 1, maxItems: 10, uniqueItems: true, items: id } },
  generate: { expectedRoundVersion: version, generationInputHash: digest, modelProfileVersion: text(200), pricingProfileVersion: text(200),
    maxAuthorizedCostMicros: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    externalSendConfirmed: { const: true }, deidentifiedConfirmed: { const: true } },
  create: { sourcePackageId: id, expectedSourcePackageVersion: version, sourceAttemptId: id,
    expectedSourceAttemptVersion: version, sourceAttemptPayloadHash: digest, sourceReviewHash: digest,
    exerciseCount: { enum: [2, 3] }, knowledgePointId: nullable(id) },
  revise_content: { expectedRoundVersion: version, expectedContentId: nullable(id), expectedContentVersion: nullable(version),
    expectedContentHash: nullable(digest), content, reason: text(500) },
  reject_content: { ...seen, reason: text(500) },
  publish: { ...seen, childSnapshotHash: digest, childContentConfirmed: { const: true }, answersChecked: { const: true } },
  cancel: { expectedRoundVersion: version, reason: text(500) },
  withdraw: { expectedRoundVersion: version, reason: text(500) }, recover: {}
};
const ajv = new Ajv({ strict: true });
const generatedText = { type: 'string' };
const validGeneratedContent = ajv.compile(object({ instructions: generatedText, exercises: {
  type: 'array', minItems: 2, maxItems: 3, items: object({ exerciseId: generatedText, questionText: generatedText,
    answerForParent: generatedText, rubricForParent: generatedText }) } }));
const validators = Object.fromEntries(Object.entries(shapes).map(([action, fields]) => [action, ajv.compile(object({ ...common, ...fields }))]));
function clean(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw error(400, 'VALIDATION_ERROR');
    return value.map(clean);
  }
  if (typeof value === 'string') {
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw error(400, 'VALIDATION_ERROR');
    return value.replace(/\r\n/g, '\n');
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
  return value;
}
function parseRaw(bytes) {
  if (!Buffer.isBuffer(bytes)) throw error(400, 'VALIDATION_ERROR');
  if (bytes.length > 32768) throw error(413, 'AI3_INPUT_TOO_LARGE');
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (_) { throw error(400, 'VALIDATION_ERROR'); }
}
function normalize(action, body) {
  let serialized;
  try { serialized = JSON.stringify(body); } catch (_) { throw error(400, 'VALIDATION_ERROR'); }
  if (typeof serialized !== 'string') throw error(400, 'VALIDATION_ERROR');
  if (Buffer.byteLength(serialized) > 32768) throw error(413, 'AI3_INPUT_TOO_LARGE');
  const value = clean(body);
  if (!validators[action]?.(value)) throw error(400, 'VALIDATION_ERROR');
  if (action === 'review') {
    if (value.decision === 'revise' ? !value.comment.trim() || value.evidenceSummary !== '' || value.masteryConfirmed
      || value.reviewReminderDate !== null : !value.evidenceSummary.trim() || value.reviewContextHash === null) throw error(400, 'VALIDATION_ERROR');
    if (value.reviewReminderDate !== null) {
      try { addLocalDateDays(value.reviewReminderDate, 0); } catch (_) { throw error(400, 'VALIDATION_ERROR'); }
    }
  }
  if (action === 'revise_content') {
    const tuple = [value.expectedContentId, value.expectedContentVersion, value.expectedContentHash];
    if (tuple.some(x => x === null) && !tuple.every(x => x === null)) throw error(400, 'VALIDATION_ERROR');
    if (value.content.exercises.some((q, i) => q.exerciseId !== `q${i + 1}`)) throw error(400, 'VALIDATION_ERROR');
    const strings = [value.content.instructions, ...value.content.exercises.flatMap(q => [q.questionText, q.answerForParent, q.rubricForParent])];
    const linkOrMarkup = /(?:[a-z][a-z0-9+.-]*:\/\/|\b(?:https?|ftp|file|data|javascript|vbscript|mailto|blob|wss?|tel|about):|\/\/\S|www\.|<\/?[a-z!])/i;
    if (strings.some(s => linkOrMarkup.test(s))) throw error(400, 'VALIDATION_ERROR');
  }
  return value;
}
const childSnapshot = c => ({ instructions: c.instructions, exercises: c.exercises.map(q => ({ exerciseId: q.exerciseId, questionText: q.questionText })) });
function generatedContent(raw, exerciseCount) {
  const c = parseRaw(Buffer.from(raw, 'utf8'));
  // Reject arbitrary JSON nesting before recursive normalization of the fixed Content shape.
  if (!validGeneratedContent(c)) throw error(400, 'VALIDATION_ERROR');
  const normalized = normalize('revise_content', { schemaVersion: 'ai3-min-v1', operationId: '00000000-0000-4000-8000-000000000000',
    expectedRoundVersion: 1, expectedContentId: null, expectedContentVersion: null, expectedContentHash: null,
    content: c, reason: 'Validate generated content' }).content;
  if (normalized.exercises.length !== exerciseCount) throw error(400, 'VALIDATION_ERROR');
  return normalized;
}
module.exports = { error, hash, normalize, parseRaw, childSnapshot, generatedContent,
  isId: v => typeof v === 'string' && /^[a-f0-9]{24}$/.test(v),
  requestHash: (action, path, body) => hash({ method: 'POST', path, endpointOperation: `ai3.${action}`, body }) };
