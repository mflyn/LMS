import { AI2_COMMAND_PREFIX, assertSessionCurrent, captureSession, loadChildSession } from './familySession';
import { registerChildScopeReset } from './childScope';
import { newTutorOperationId } from './tutorCommands';

const id = value => typeof value === 'string' && /^[0-9a-f]{24}$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const version = value => Number.isSafeInteger(value) && value >= 1;
const object = value => value !== null && typeof value === 'object'
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const closed = (value, fields) => object(value) && Reflect.ownKeys(value).length === fields.length
  && fields.every(field => {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor?.enumerable && Object.prototype.hasOwnProperty.call(descriptor, 'value');
  });
const text = (value, max, empty = false) => typeof value === 'string' && !/[\uD800-\uDFFF]/u.test(value)
  && [...value.replace(/\r\n/g, '\n')].length <= max && (empty || Boolean(value.trim()));
const common = ['schemaVersion', 'operationId'];
const validBody = (action, body) => {
  if (!object(body) || body.schemaVersion !== 'ai2-min-v1' || !uuid(body.operationId)) return false;
  if (action === 'publish') return closed(body, [...common, 'cycleId', 'expectedCycleStateVersion', 'artifactId',
    'artifactVersion', 'artifactContentHash', 'expectedArtifactReviewVersion', 'childSnapshotHash', 'childContentConfirmed'])
    && id(body.cycleId) && version(body.expectedCycleStateVersion) && id(body.artifactId) && version(body.artifactVersion)
    && hash(body.artifactContentHash) && version(body.expectedArtifactReviewVersion) && hash(body.childSnapshotHash)
    && body.childContentConfirmed === true;
  if (action === 'withdraw') return closed(body, [...common, 'expectedPackageVersion', 'reason'])
    && version(body.expectedPackageVersion) && text(body.reason, 500);
  if (action === 'submit') return closed(body, [...common, 'expectedPackageVersion', 'note', 'mediaIds'])
    && version(body.expectedPackageVersion) && text(body.note, 1000, true) && Array.isArray(body.mediaIds)
    && body.mediaIds.length >= 1 && body.mediaIds.length <= 10
    && Reflect.ownKeys(body.mediaIds).length === body.mediaIds.length + 1
    && Array.from(body.mediaIds).every(id) && new Set(body.mediaIds).size === body.mediaIds.length;
  return action === 'review' && closed(body, [...common, 'expectedPackageVersion', 'expectedAttemptVersion',
    'attemptPayloadHash', 'decision', 'comment']) && version(body.expectedPackageVersion) && version(body.expectedAttemptVersion)
    && hash(body.attemptPayloadHash) && ['approve', 'revise'].includes(body.decision)
    && text(body.comment, 1000, body.decision === 'approve');
};

export const validAi2Command = value => Boolean(closed(value, ['action', 'targetId', 'attemptId', 'body'])
  && ['publish', 'withdraw', 'submit', 'review'].includes(value.action)
  && (value.action === 'publish' ? value.targetId === null : id(value.targetId))
  && (value.action === 'review' ? id(value.attemptId) : value.attemptId === null)
  && validBody(value.action, value.body));
const allowed = (command, session) => validAi2Command(command)
  && (session.role === 'student' ? command.action === 'submit' : command.action !== 'submit');
const failure = code => Object.assign(new Error(code), { code });
const commandKey = (scope, session) => {
  assertSessionCurrent(session);
  if (!['parent', 'student'].includes(session.role) || ![session.actorId, scope?.familyId, scope?.childId].every(id)) {
    throw failure('AI2_SCOPE_INVALID');
  }
  if (session.role === 'student' && (scope.childId !== session.actorId || scope.familyId !== loadChildSession()?.child.familyId)) {
    throw failure('AI2_SCOPE_INVALID');
  }
  return AI2_COMMAND_PREFIX + JSON.stringify([session.role, session.actorId, scope.familyId, scope.childId]);
};

export const readAi2Command = (scope, session) => {
  const raw = sessionStorage.getItem(commandKey(scope, session));
  if (raw === null) return null;
  try { const value = JSON.parse(raw); return allowed(value, session) ? value : { corrupt: true }; }
  catch { return { corrupt: true }; }
};
export const saveAi2Command = (scope, command, session) => {
  const key = commandKey(scope, session);
  if (!allowed(command, session)) throw failure('AI2_COMMAND_INVALID');
  const serialized = JSON.stringify(command), previous = sessionStorage.getItem(key);
  if (previous !== null && previous !== serialized) throw failure('AI2_COMMAND_UNRESOLVED');
  sessionStorage.setItem(key, serialized);
  if (sessionStorage.getItem(key) !== serialized) throw failure('AI2_COMMAND_STORAGE_UNAVAILABLE');
  return JSON.parse(serialized);
};
export const finishAi2Command = (scope, operationId, session) => {
  const key = commandKey(scope, session), previous = readAi2Command(scope, session);
  if (previous && !previous.corrupt && previous.body.operationId === operationId) sessionStorage.removeItem(key);
};
export const newAi2OperationId = newTutorOperationId;

// Only canonical ownership keys can clear private text; corrupt bodies remain locked until an explicit exit.
registerChildScopeReset(({ previousChildId }) => {
  const session = captureSession('parent');
  if (!session || !previousChildId) return;
  try {
    const remove = [];
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(AI2_COMMAND_PREFIX)) continue;
      try {
        const parts = JSON.parse(key.slice(AI2_COMMAND_PREFIX.length));
        if (Array.isArray(parts) && parts.length === 4 && parts[0] === 'parent' && parts.slice(1).every(id)
          && parts[1] === session.actorId && parts[3] === previousChildId
          && key === AI2_COMMAND_PREFIX + JSON.stringify(parts)) remove.push(key);
      } catch { /* A malformed key cannot prove ownership. */ }
    }
    remove.forEach(key => sessionStorage.removeItem(key));
  } catch { /* Inaccessible storage is never used to dispatch a command. */ }
});
