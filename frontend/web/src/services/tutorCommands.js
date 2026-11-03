import { assertSessionCurrent, captureSession, TUTOR_COMMAND_PREFIX } from './familySession';
import { registerChildScopeReset } from './childScope';

const id = value => typeof value === 'string' && /^[0-9a-f]{24}$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const actions = ['create', 'generate', 'recover', 'revise', 'review', 'close'];
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const closed = (value, fields) => object(value) && Object.keys(value).sort().join(',') === fields.slice().sort().join(',');
const text = (value, max, empty = false) => typeof value === 'string' && [...value].length <= max && (empty || Boolean(value.trim()));
const version = value => Number.isSafeInteger(value) && value >= 1;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const common = ['schemaVersion', 'operationId'];
const seen = ['artifactId', 'artifactVersion', 'artifactContentHash', 'expectedArtifactReviewVersion', 'expectedCycleStateVersion'];
const validBody = (action, body) => {
  if (!object(body) || body.schemaVersion !== 'ai1-min-v1' || !uuid(body.operationId)) return false;
  if (action === 'recover') return closed(body, common);
  if (action === 'create') return closed(body, [...common, 'childId', 'source', 'input', 'chapter', 'deidentifiedConfirmed'])
    && id(body.childId) && closed(body.source, ['type', 'id']) && ['task', 'mistake'].includes(body.source.type) && id(body.source.id)
    && closed(body.input, ['questionText', 'answerText', 'parentContext']) && text(body.input.questionText, 4000)
    && (body.input.answerText === null || text(body.input.answerText, 4000)) && text(body.input.parentContext, 500, true)
    && closed(body.chapter, ['provenance', 'subject', 'grade', 'term', 'textbookLabel', 'chapterLabel'])
    && body.chapter.provenance === 'parent_declared' && body.chapter.subject === 'math' && body.chapter.grade === 4
    && body.chapter.term === 'upper' && text(body.chapter.textbookLabel, 200)
    && body.chapter.chapterLabel === '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' && body.deidentifiedConfirmed === true;
  if (action === 'generate') return closed(body, [...common, 'expectedCycleStateVersion', 'generationInputHash',
    'modelProfileVersion', 'pricingProfileVersion', 'maxAuthorizedCostMicros', 'externalSendConfirmed'])
    && version(body.expectedCycleStateVersion) && hash(body.generationInputHash) && text(body.modelProfileVersion, 100)
    && text(body.pricingProfileVersion, 100) && Number.isSafeInteger(body.maxAuthorizedCostMicros)
    && body.maxAuthorizedCostMicros >= 0 && body.externalSendConfirmed === true;
  if (action === 'close') return closed(body, [...common, 'expectedCycleStateVersion', 'reason'])
    && version(body.expectedCycleStateVersion) && text(body.reason, 500);
  if (!id(body.artifactId) || !version(body.artifactVersion) || !hash(body.artifactContentHash)
    || !version(body.expectedArtifactReviewVersion) || !version(body.expectedCycleStateVersion)) return false;
  if (action === 'revise') return closed(body, [...common, ...seen, 'revisedText', 'revisionReason'])
    && text(body.revisedText, 12000) && text(body.revisionReason, 500);
  return action === 'review' && closed(body, [...common, ...seen, 'decision', 'comment', 'checks'])
    && ['approve', 'reject'].includes(body.decision) && text(body.comment, 500, body.decision === 'approve')
    && closed(body.checks, ['mathCorrect', 'gradeAppropriate', 'chapterAppropriate', 'wordingReviewed'])
    && Object.values(body.checks).every(value => typeof value === 'boolean' && (body.decision !== 'approve' || value));
};
const failure = code => Object.assign(new Error(code), { code });
export const tutorCommandKey = (scope, session) => {
  assertSessionCurrent(session);
  if (session.role !== 'parent' || ![session.actorId, scope?.familyId, scope?.childId].every(id)) throw failure('AI_SCOPE_INVALID');
  return TUTOR_COMMAND_PREFIX + JSON.stringify([session.actorId, scope.familyId, scope.childId]);
};
const valid = value => value && Object.keys(value).sort().join(',') === 'action,body,targetId'
  && actions.includes(value.action) && (value.action === 'create' ? value.targetId === null : id(value.targetId))
  && validBody(value.action, value.body);
export const readTutorCommand = (scope, session) => {
  const raw = sessionStorage.getItem(tutorCommandKey(scope, session));
  if (raw === null) return null;
  try { const value = JSON.parse(raw); return valid(value) ? value : { corrupt: true }; }
  catch { return { corrupt: true }; }
};
export const saveTutorCommand = (scope, command, session) => {
  const key = tutorCommandKey(scope, session);
  if (!valid(command)) throw failure('AI_COMMAND_INVALID');
  const serialized = JSON.stringify(command), previous = sessionStorage.getItem(key);
  if (previous !== null && previous !== serialized) throw failure('AI_COMMAND_UNRESOLVED');
  sessionStorage.setItem(key, serialized);
  if (sessionStorage.getItem(key) !== serialized) throw failure('AI_COMMAND_STORAGE_UNAVAILABLE');
  return JSON.parse(serialized);
};
export const finishTutorCommand = (scope, operationId, session) => {
  const key = tutorCommandKey(scope, session), previous = readTutorCommand(scope, session);
  if (previous && !previous.corrupt && previous.body.operationId === operationId) sessionStorage.removeItem(key);
};

export const newTutorOperationId = () => {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Child changes clear private local text; server lists remain the source of recovery discovery.
registerChildScopeReset(({ previousChildId }) => {
  const session = captureSession('parent');
  if (!session || !previousChildId) return;
  try {
    const keys = [];
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(TUTOR_COMMAND_PREFIX)) continue;
      try {
        const parts = JSON.parse(key.slice(TUTOR_COMMAND_PREFIX.length));
        if (Array.isArray(parts) && parts.length === 3 && parts.every(id) && parts[0] === session.actorId
          && parts[2] === previousChildId && key === TUTOR_COMMAND_PREFIX + JSON.stringify(parts)) keys.push(key);
      } catch { /* A malformed key cannot prove ownership. */ }
    }
    keys.forEach(key => sessionStorage.removeItem(key));
  } catch { /* Inaccessible storage is never used to dispatch a command. */ }
});
