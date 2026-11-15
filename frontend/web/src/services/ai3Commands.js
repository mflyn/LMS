import { AI3_COMMAND_PREFIX, assertSessionCurrent, captureSession, loadChildSession } from './familySession';
import { registerChildScopeReset } from './childScope';
import { newTutorOperationId } from './tutorCommands';

const id = value => typeof value === 'string' && /^[0-9a-f]{24}$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const version = value => Number.isSafeInteger(value) && value >= 1;
const text = (value, max, empty = false) => typeof value === 'string' && !/[\uD800-\uDFFF]/u.test(value)
  && [...value.replace(/\r\n/g, '\n')].length <= max && (empty || Boolean(value.trim()));
const object = value => value !== null && typeof value === 'object'
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const dataProperty = (value, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.enumerable && Object.prototype.hasOwnProperty.call(descriptor, 'value');
};
const closed = (value, keys) => object(value) && Reflect.ownKeys(value).length === keys.length && keys.every(key => dataProperty(value, key));
const dense = (values, min, max, check) => Array.isArray(values) && values.length >= min && values.length <= max
  && Reflect.ownKeys(values).length === values.length + 1
  && Array.from({ length: values.length }, (_, index) => index).every(index => dataProperty(values, index) && check(values[index], index));
const localDate = value => {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number), date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const plainText = (value, max) => text(value, max)
  && !/(?:[a-z][a-z0-9+.-]*:\/\/|\b(?:https?|ftp|file|data|javascript|vbscript|mailto|blob|wss?|tel|about):|\/\/\S|www\.|<\/?[a-z!])/i.test(value);
const content = value => closed(value, ['instructions', 'exercises']) && plainText(value.instructions, 500)
  && dense(value.exercises, 2, 3, (item, index) => closed(item, ['exerciseId', 'questionText', 'answerForParent', 'rubricForParent'])
    && item.exerciseId === `q${index + 1}` && [item.questionText, item.answerForParent, item.rubricForParent].every(value => plainText(value, 1000)));
const seen = { expectedRoundVersion: version, contentId: id, contentVersion: version, contentHash: hash };
const nullable = check => value => value === null || check(value);
const fields = {
  create: { sourcePackageId: id, expectedSourcePackageVersion: version, sourceAttemptId: id,
    expectedSourceAttemptVersion: version, sourceAttemptPayloadHash: hash, sourceReviewHash: hash,
    exerciseCount: value => [2, 3].includes(value), knowledgePointId: nullable(id) },
  revise_content: { expectedRoundVersion: version, expectedContentId: nullable(id), expectedContentVersion: nullable(version),
    expectedContentHash: nullable(hash), content, reason: value => text(value, 500) },
  reject_content: { ...seen, reason: value => text(value, 500) },
  publish: { ...seen, childSnapshotHash: hash, childContentConfirmed: value => value === true, answersChecked: value => value === true },
  cancel: { expectedRoundVersion: version, reason: value => text(value, 500) },
  withdraw: { expectedRoundVersion: version, reason: value => text(value, 500) },
  generate: { expectedRoundVersion: version, generationInputHash: hash,
    modelProfileVersion: value => text(value, 200), pricingProfileVersion: value => text(value, 200),
    maxAuthorizedCostMicros: value => Number.isSafeInteger(value) && value >= 0,
    externalSendConfirmed: value => value === true, deidentifiedConfirmed: value => value === true },
  submit: { expectedRoundVersion: version, contentId: id, contentVersion: version, childSnapshotHash: hash,
    note: value => text(value, 1000, true), mediaIds: value => dense(value, 1, 10, id) && new Set(value).size === value.length },
  review: { ...seen, expectedAttemptVersion: version, attemptPayloadHash: hash, decision: value => ['approve', 'revise'].includes(value),
    comment: value => text(value, 1000, true), evidenceSummary: value => text(value, 1000, true),
    masteryConfirmed: value => typeof value === 'boolean', reviewReminderDate: nullable(localDate), reviewContextHash: nullable(hash) }
};
const validBody = (action, body) => {
  const shape = fields[action];
  if (!shape || !closed(body, ['schemaVersion', 'operationId', ...Object.keys(shape)])
    || body.schemaVersion !== 'ai3-min-v1' || !uuid(body.operationId)
    || !Object.entries(shape).every(([key, check]) => check(body[key]))) return false;
  if (action === 'revise_content') {
    const tuple = [body.expectedContentId, body.expectedContentVersion, body.expectedContentHash];
    if (tuple.some(value => value === null) && !tuple.every(value => value === null)) return false;
  }
  if (action === 'review' && (body.decision === 'revise'
    ? !body.comment.trim() || body.evidenceSummary !== '' || body.masteryConfirmed || body.reviewReminderDate !== null
    : !body.evidenceSummary.trim() || body.reviewContextHash === null)) return false;
  return new Blob([JSON.stringify(body)]).size <= 32768;
};
export const validAi3Command = value => {
  try {
    return Boolean(closed(value, ['action', 'targetId', 'attemptId', 'body'])
      && Object.prototype.hasOwnProperty.call(fields, value.action)
      && (value.action === 'create' ? value.targetId === null : id(value.targetId))
      && (value.action === 'review' ? id(value.attemptId) : value.attemptId === null) && validBody(value.action, value.body));
  } catch { return false; }
};
const allowed = (value, session) => validAi3Command(value)
  && (session.role === 'student' ? value.action === 'submit' : value.action !== 'submit');
const failure = code => Object.assign(new Error(code), { code });
const commandKey = (scope, session) => {
  assertSessionCurrent(session);
  if (!['parent', 'student'].includes(session.role) || ![session.actorId, scope?.familyId, scope?.childId].every(id)) throw failure('AI3_SCOPE_INVALID');
  if (session.role === 'student' && (scope.childId !== session.actorId || scope.familyId !== loadChildSession()?.child.familyId)) throw failure('AI3_SCOPE_INVALID');
  return AI3_COMMAND_PREFIX + JSON.stringify([session.role, session.actorId, scope.familyId, scope.childId]);
};
export const readAi3Command = (scope, session) => {
  const raw = sessionStorage.getItem(commandKey(scope, session));
  if (raw === null) return null;
  try { const value = JSON.parse(raw); return allowed(value, session) ? value : { corrupt: true }; }
  catch { return { corrupt: true }; }
};
export const saveAi3Command = (scope, command, session) => {
  const key = commandKey(scope, session);
  if (!allowed(command, session)) throw failure('AI3_COMMAND_INVALID');
  const serialized = JSON.stringify(command), previous = sessionStorage.getItem(key);
  if (previous !== null && previous !== serialized) throw failure('AI3_COMMAND_UNRESOLVED');
  sessionStorage.setItem(key, serialized);
  if (sessionStorage.getItem(key) !== serialized) throw failure('AI3_COMMAND_STORAGE_UNAVAILABLE');
  return JSON.parse(serialized);
};
export const finishAi3Command = (scope, operationId, session) => {
  const key = commandKey(scope, session), previous = readAi3Command(scope, session);
  if (previous && !previous.corrupt && previous.body.operationId === operationId) sessionStorage.removeItem(key);
};
export const newAi3OperationId = newTutorOperationId;

registerChildScopeReset(({ previousChildId }) => {
  const session = captureSession('parent');
  if (!session || !previousChildId) return;
  try {
    const remove = [];
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(AI3_COMMAND_PREFIX)) continue;
      try {
        const parts = JSON.parse(key.slice(AI3_COMMAND_PREFIX.length));
        if (Array.isArray(parts) && parts.length === 4 && parts[0] === 'parent' && parts.slice(1).every(id)
          && parts[1] === session.actorId && parts[3] === previousChildId
          && key === AI3_COMMAND_PREFIX + JSON.stringify(parts)) remove.push(key);
      } catch { /* Body parsing is unnecessary: the canonical key proves ownership. */ }
    }
    remove.forEach(key => sessionStorage.removeItem(key));
  } catch { /* Inaccessible storage cannot supply a dispatchable command. */ }
});
