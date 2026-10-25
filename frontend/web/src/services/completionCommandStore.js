const PREFIX = 'family-growth.completion-command.v1:';
const ID = /^[0-9a-f]{24}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCOPE_FIELDS = ['actorId', 'role', 'familyId', 'childId', 'taskId'];
const COMPLETE_FIELDS = ['operationId', 'expectedCompletionVersion', 'expectedChecklistVersion', 'checkedItemIds', 'completionMediaIds'];
const OPTIONAL_FIELDS = ['actualMinutes', 'actualAmount', 'difficulty', 'needsHelp', 'childNote'];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plain = value => value !== null && typeof value === 'object'
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fail = (code = 'COMPLETION_COMMAND_INVALID') => { throw Object.assign(new Error(code), { code }); };
const assert = condition => { if (!condition) fail(); };
const matches = (value, regex, length) => typeof value === 'string' && value.length === length && regex.test(value);
const validId = value => matches(value, ID, 24);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const exact = (value, required, optional = []) => plain(value) && required.every(key => own(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const same = (left, right) => {
  if (left === right) return true;
  if (Array.isArray(left)) return Array.isArray(right) && left.length === right.length && left.every((value, index) => same(value, right[index]));
  return plain(left) && plain(right) && Object.keys(left).length === Object.keys(right).length
    && Object.keys(left).every(key => own(right, key) && same(left[key], right[key]));
};
const freeze = value => {
  Object.values(value).forEach(item => { if (item !== null && typeof item === 'object') freeze(item); });
  return Object.freeze(value);
};
const ids = (value, max, valid, fold = false) => {
  assert(Array.isArray(value) && value.length <= max);
  const result = Array.from(value, item => { assert(valid(item)); return fold ? item.toLowerCase() : item; });
  assert(new Set(result).size === result.length); return result;
};

export const normalizeCompletionBody = input => {
  assert(plain(input) && COMPLETE_FIELDS.every(key => own(input, key)));
  assert(matches(input.operationId, UUID, 36) && integer(input.expectedCompletionVersion)
    && input.expectedCompletionVersion < Number.MAX_SAFE_INTEGER && integer(input.expectedChecklistVersion));
  const body = { operationId: input.operationId.toLowerCase(), expectedCompletionVersion: input.expectedCompletionVersion,
    expectedChecklistVersion: input.expectedChecklistVersion,
    checkedItemIds: ids(input.checkedItemIds, 5, value => typeof value === 'string' && value.length > 0 && value.length <= 100).sort(),
    completionMediaIds: ids(input.completionMediaIds, 10, validId, true) };
  for (const key of OPTIONAL_FIELDS) {
    if (!own(input, key) || input[key] === undefined) continue;
    const value = input[key];
    if (key === 'actualMinutes' || key === 'actualAmount') {
      if (typeof value === 'string' && value.trim() === '') continue;
      assert(typeof value === 'number' && Number.isFinite(value) && value >= 0);
    } else if (key === 'difficulty') assert(['easy', 'normal', 'hard'].includes(value));
    else if (key === 'needsHelp') assert(typeof value === 'boolean');
    else assert(typeof value === 'string');
    body[key] = typeof value === 'string' ? value.trim() : value;
  }
  return body;
};

export const normalizeConfirmationBody = input => {
  assert(plain(input) && own(input, 'expectedCompletionVersion') && integer(input.expectedCompletionVersion));
  const body = { expectedCompletionVersion: input.expectedCompletionVersion };
  if (own(input, 'parentFeedback') && input.parentFeedback !== undefined) {
    assert(typeof input.parentFeedback === 'string'); body.parentFeedback = input.parentFeedback.trim();
  }
  return body;
};

const normalizeScope = value => {
  assert(exact(value, SCOPE_FIELDS) && ['parent', 'student'].includes(value.role));
  const scope = Object.fromEntries(SCOPE_FIELDS.map(key => {
    if (key === 'role') return [key, value[key]];
    assert(validId(value[key])); return [key, value[key].toLowerCase()];
  }));
  assert(scope.role !== 'student' || scope.actorId === scope.childId); return scope;
};
const keyFor = (scope, action) => {
  assert(['complete', 'confirm'].includes(action) && (action !== 'confirm' || scope.role === 'parent'));
  return PREFIX + JSON.stringify([...SCOPE_FIELDS.map(key => scope[key]), action]);
};
const validateEnvelope = value => {
  assert(exact(value, ['schemaVersion', 'scope', 'action', 'body', 'uncertain']) && value.schemaVersion === 1
    && typeof value.uncertain === 'boolean');
  const scope = normalizeScope(value.scope); assert(same(scope, value.scope)); keyFor(scope, value.action);
  const body = value.action === 'complete' ? normalizeCompletionBody(value.body) : normalizeConfirmationBody(value.body);
  // Stored commands must already be canonical. Never repair a possibly-sent body.
  assert(same(body, value.body));
  return freeze({ schemaVersion: 1, scope, action: value.action, body, uncertain: value.uncertain });
};
const storage = work => {
  try { return work(window.sessionStorage); }
  catch (cause) {
    if (['COMPLETION_COMMAND_INVALID', 'COMPLETION_COMMAND_PENDING'].includes(cause?.code)) throw cause;
    fail('COMPLETION_COMMAND_STORAGE_UNAVAILABLE');
  }
};
const decode = (raw, scope, action) => {
  let value; try { value = JSON.parse(raw); } catch (_) { fail(); }
  const envelope = validateEnvelope(value);
  assert(same(scope, envelope.scope) && action === envelope.action); return envelope;
};

export const loadCompletionCommand = (inputScope, action = 'complete') => {
  const scope = normalizeScope(inputScope), key = keyFor(scope, action);
  return storage(store => {
    const raw = store.getItem(key); return raw === null ? null : decode(raw, scope, action);
  });
};

export const saveCompletionCommand = input => {
  const envelope = validateEnvelope(input), key = keyFor(envelope.scope, envelope.action);
  return storage(store => {
    const raw = store.getItem(key);
    if (raw !== null) {
      const previous = decode(raw, envelope.scope, envelope.action);
      if (!same(previous.body, envelope.body) || (previous.uncertain && !envelope.uncertain)) fail('COMPLETION_COMMAND_PENDING');
    }
    store.setItem(key, JSON.stringify(envelope));
    const saved = decode(store.getItem(key), envelope.scope, envelope.action);
    assert(same(saved, envelope)); return saved;
  });
};

const newOperationId = () => {
  const crypto = window.crypto;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID().toLowerCase();
  assert(typeof crypto?.getRandomValues === 'function');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const createCompletionCommand = (inputScope, input) => {
  const scope = normalizeScope(inputScope); assert(plain(input) && !own(input, 'operationId'));
  // Validate before consuming randomness; an existing command must be explicitly resolved.
  const body = normalizeCompletionBody({ ...input, operationId: '00000000-0000-4000-8000-000000000000' });
  if (loadCompletionCommand(scope)) fail('COMPLETION_COMMAND_PENDING');
  body.operationId = newOperationId();
  return saveCompletionCommand({ schemaVersion: 1, scope, action: 'complete', body, uncertain: false });
};

export const clearCompletionCommand = (inputScope, action = 'complete') => {
  const scope = normalizeScope(inputScope), key = keyFor(scope, action);
  storage(store => { store.removeItem(key); if (store.getItem(key) !== null) fail('COMPLETION_COMMAND_STORAGE_UNAVAILABLE'); });
};

const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validMedia = value => Array.isArray(value) && value.length <= 10
  && Array.from(value).every(item => validId(item) && item === item.toLowerCase()) && new Set(value).size === value.length;
const TASK_FIELDS = ['taskId', 'status', 'checklistVersion', 'completionVersion', 'completionMediaIds', 'completionMediaReferenceState', 'parentConfirmed'];
const validTask = (task, envelope) => task.taskId === envelope.scope.taskId && integer(task.checklistVersion)
  && integer(task.completionVersion) && validMedia(task.completionMediaIds) && task.completionMediaReferenceState === 'stable';

// API callers pass unwrapped data, not an Axios response or a raw HTTP envelope.
export const validateCompletionResult = (payload, inputEnvelope) => {
  try {
    const envelope = validateEnvelope(inputEnvelope), task = payload?.task;
    return envelope.action === 'complete' && exact(payload, ['task']) && exact(task, [...TASK_FIELDS, 'completedAt'])
      && validTask(task, envelope) && task.status === 'completed' && task.parentConfirmed === false
      && task.completionVersion === envelope.body.expectedCompletionVersion + 1
      && task.checklistVersion === envelope.body.expectedChecklistVersion
      && same(task.completionMediaIds, envelope.body.completionMediaIds) && time(task.completedAt);
  } catch (_) { return false; }
};

export const validateConfirmationResult = (payload, inputEnvelope) => {
  try {
    const envelope = validateEnvelope(inputEnvelope), task = payload?.task;
    if (envelope.action !== 'confirm' || !exact(payload, ['task'], ['starAward'])
      || !exact(task, [...TASK_FIELDS, 'confirmedByParentId', 'confirmedAt', 'starAwardState'], ['parentFeedback', 'completedAt'])
      || !validTask(task, envelope) || task.status !== 'confirmed' || task.parentConfirmed !== true
      || task.completionVersion !== envelope.body.expectedCompletionVersion || task.starAwardState !== 'awarded'
      || !validId(task.confirmedByParentId) || !time(task.confirmedAt)
      || (own(task, 'parentFeedback') && typeof task.parentFeedback !== 'string')
      || (task.completedAt != null && !time(task.completedAt))) return false;
    // Awarded retries omit starAward and preserve the first parent's feedback/audit.
    if (!own(payload, 'starAward')) return true;
    const award = payload.starAward;
    return exact(award, ['awarded', 'ledgerEntryId', 'starBalance']) && typeof award.awarded === 'boolean'
      && typeof award.ledgerEntryId === 'string' && award.ledgerEntryId.length > 0 && integer(award.starBalance);
  } catch (_) { return false; }
};

export const classifyCompletionError = (error, { uncertain = false } = {}) => {
  const status = error?.response?.status, payload = error?.response?.data, detail = payload?.error;
  if (!Number.isInteger(status) || !exact(payload, ['success', 'error'], ['requestId']) || payload.success !== false
    || (own(payload, 'requestId') && (typeof payload.requestId !== 'string' || !payload.requestId))
    || !exact(detail, ['code', 'message', 'details']) || typeof detail.code !== 'string'
    || typeof detail.message !== 'string' || !Array.isArray(detail.details)) return 'uncertain';
  const code = detail.code;
  if (status === 401 && ['UNAUTHENTICATED', 'INVALID_IDENTITY_ENVELOPE', 'INVALID_SERVICE_CREDENTIAL',
    'STALE_CHILD_TOKEN', 'IDENTITY_ENVELOPE_EXPIRED', 'IDENTITY_ENVELOPE_REPLAYED'].includes(code)) return 'awaiting_auth';
  if (status === 403 && ['CHILD_ACCESS_DENIED', 'ACCESS_DENIED', 'FIELD_ACCESS_DENIED'].includes(code)) return 'awaiting_auth';
  if (status === 409 && code === 'IDEMPOTENCY_KEY_REUSED') return 'blocked';
  if ((status === 409 && ['MEDIA_OPERATION_EXPIRED', 'MEDIA_OPERATION_ABORTED', 'VERSION_CONFLICT', 'TASK_STATE_CONFLICT'].includes(code))
    || (status === 404 && code === 'RESOURCE_NOT_FOUND')) return 'terminal';
  if (status === 400 && ['VALIDATION_ERROR', 'CHECKLIST_ITEM_INVALID', 'MEDIA_ATTACHMENT_LIMIT_EXCEEDED', 'CLIENT_UPGRADE_REQUIRED'].includes(code)) {
    return uncertain ? 'blocked' : 'terminal';
  }
  return 'uncertain';
};
