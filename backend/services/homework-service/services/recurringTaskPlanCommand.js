const { createHash } = require('crypto');
const { canonicalize } = require('json-canonicalize');
const { assertLocalDate } = require('../../../common/utils/familyDate');
const { error, ID, UUID, matches } = require('./growthTaskCompletionCommand');

const invalid = () => error(400, 'VALIDATION_ERROR');
const fields = ['dimension', 'area', 'subject', 'title', 'taskType', 'description',
  'estimatedMinutes', 'targetAmount', 'unit', 'priority'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const allowed = (value, keys, required = keys) => {
  if (!object(value) || Object.keys(value).some(key => !keys.includes(key))
    || required.some(key => !Object.prototype.hasOwnProperty.call(value, key))) throw invalid();
};
const date = value => {
  if (typeof value !== 'string') throw invalid();
  try { assertLocalDate(value); } catch { throw invalid(); }
  return value;
};
const template = input => {
  allowed(input, fields, ['dimension', 'title', 'taskType']);
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (['estimatedMinutes', 'targetAmount'].includes(key)) {
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw invalid();
      result[key] = value;
    } else {
      if (value !== null && typeof value !== 'string') throw invalid();
      result[key] = typeof value === 'string' ? value.trim() : value;
    }
  }
  if (!['moral', 'academic', 'physical', 'artistic', 'labor'].includes(result.dimension)
    || !result.title || result.title.length > 100 || !result.taskType
    || result.priority != null && !['low', 'medium', 'high'].includes(result.priority)) throw invalid();
  return result;
};
const schedule = value => {
  if (value?.kind === 'daily') { allowed(value, ['kind']); return { kind: 'daily' }; }
  allowed(value, ['kind', 'weekdays']);
  if (value.kind !== 'weekly' || !Array.isArray(value.weekdays) || !value.weekdays.length
    || value.weekdays.length > 7 || Array.from(value.weekdays).some(day => !Number.isInteger(day) || day < 1 || day > 7)
    || new Set(value.weekdays).size !== value.weekdays.length) throw invalid();
  return { kind: 'weekly', weekdays: [...value.weekdays].sort((a, b) => a - b) };
};
const normalize = (action, body) => {
  if (!['create', 'patch', 'stop'].includes(action)) throw invalid();
  const keys = action === 'create' ? ['operationId', 'childId', 'startDate', 'endDate', 'schedule', 'template']
    : action === 'patch' ? ['operationId', 'expectedVersion', 'endDate', 'schedule', 'template']
      : ['operationId', 'expectedVersion'];
  allowed(body, keys);
  if (!matches(body.operationId, UUID)) throw invalid();
  const result = { operationId: body.operationId.toLowerCase() };
  if (action === 'create') {
    if (!matches(body.childId, ID)) throw invalid();
    Object.assign(result, { childId: body.childId.toLowerCase(), startDate: date(body.startDate) });
  } else {
    if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1
      || body.expectedVersion === Number.MAX_SAFE_INTEGER) throw invalid();
    result.expectedVersion = body.expectedVersion;
  }
  if (action !== 'stop') {
    Object.assign(result, { endDate: body.endDate === null ? null : date(body.endDate),
      schedule: schedule(body.schedule), template: template(body.template) });
    if (action === 'create' && result.endDate !== null && result.endDate < result.startDate) throw invalid();
  }
  return result;
};
const normalizeAbort = (operationId, body) => {
  allowed(body, ['childId', 'action', 'targetPlanId', 'requestDigest']);
  if (!matches(operationId, UUID) || !matches(body.childId, ID)
    || !['create', 'patch', 'stop'].includes(body.action)
    || (body.action === 'create' ? body.targetPlanId !== null : !matches(body.targetPlanId, ID))
    || !matches(body.requestDigest, /^[a-f0-9]{64}$/)) throw invalid();
  return { ...body, childId: body.childId.toLowerCase(), operationId: operationId.toLowerCase(),
    targetPlanId: body.targetPlanId?.toLowerCase() ?? null };
};
const digest = (scope, action, targetPlanId, body) => createHash('sha256').update(canonicalize({
  schemaVersion: 1, ...scope, operationId: body.operationId, action, targetPlanId, body
})).digest('hex');
const matchesDate = (value, rule) => rule.kind === 'daily'
  || rule.weekdays.includes(assertLocalDate(value).getUTCDay() || 7);
const countDays = (from, to, rule) => {
  if (from > to) return 0;
  const start = assertLocalDate(from), length = (assertLocalDate(to) - start) / 86400000 + 1;
  if (rule.kind === 'daily') return length;
  const first = start.getUTCDay() || 7;
  let count = Math.floor(length / 7) * rule.weekdays.length;
  for (let n = 0; n < length % 7; n++) if (rule.weekdays.includes((first - 1 + n) % 7 + 1)) count++;
  return count;
};
module.exports = { normalize, normalizeAbort, digest, countDays, matchesDate, fields, invalid };
