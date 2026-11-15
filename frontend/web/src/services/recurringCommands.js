import { assertSessionCurrent, captureSession, RECURRING_BODY_PREFIX } from './familySession';
import { registerChildScopeReset } from './childScope';
import { newTutorOperationId } from './tutorCommands';

export const RECURRING_MARKER_PREFIX = 'family-growth.recurring-marker.v1:';
const id = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const fields = ['dimension', 'area', 'subject', 'title', 'taskType', 'description', 'estimatedMinutes', 'targetAmount', 'unit', 'priority'];
const markerFields = ['schemaVersion', 'familyId', 'actorId', 'childId', 'operationId', 'action', 'targetPlanId', 'requestDigest'];
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fail = (code = 'RECURRING_COMMAND_INVALID') => { throw Object.assign(new Error(code), { code }); };
const check = value => { if (!value) fail(); };
const keys = (value, required, optional = []) => check(plain(value) && required.every(k => Object.hasOwn(value, k))
  && Object.keys(value).every(k => required.includes(k) || optional.includes(k)));
// Canonical JSON for the closed JSON-only command structure; checked against the server's canonicalizer.
export const recurringCanonical = value => JSON.stringify(value, function canonical(key, item) {
  return plain(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item;
});
const same = (a, b) => recurringCanonical(a) === recurringCanonical(b);
const date = value => { check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value); return value; };
export const normalizeRecurringBody = (action, body) => {
  check(['create', 'patch', 'stop'].includes(action));
  keys(body, action === 'create' ? ['operationId', 'childId', 'startDate', 'endDate', 'schedule', 'template']
    : action === 'patch' ? ['operationId', 'expectedVersion', 'endDate', 'schedule', 'template'] : ['operationId', 'expectedVersion']);
  check(typeof body.operationId === 'string' && uuid(body.operationId.toLowerCase()));
  const result = { operationId: body.operationId.toLowerCase() };
  if (action === 'create') {
    check(typeof body.childId === 'string' && id(body.childId.toLowerCase()));
    Object.assign(result, { childId: body.childId.toLowerCase(), startDate: date(body.startDate) });
  } else {
    check(Number.isSafeInteger(body.expectedVersion) && body.expectedVersion > 0 && body.expectedVersion < Number.MAX_SAFE_INTEGER);
    result.expectedVersion = body.expectedVersion;
  }
  if (action !== 'stop') {
    result.endDate = body.endDate === null ? null : date(body.endDate);
    if (action === 'create') check(result.endDate === null || result.endDate >= result.startDate);
    if (body.schedule?.kind === 'daily') { keys(body.schedule, ['kind']); result.schedule = { kind: 'daily' }; }
    else {
      keys(body.schedule, ['kind', 'weekdays']); const days = body.schedule.weekdays;
      check(body.schedule.kind === 'weekly' && Array.isArray(days) && days.length > 0 && days.length <= 7
        && Array.from(days).every(d => Number.isInteger(d) && d >= 1 && d <= 7) && new Set(days).size === days.length);
      result.schedule = { kind: 'weekly', weekdays: [...days].sort((a, b) => a - b) };
    }
    keys(body.template, ['title', 'dimension', 'taskType'], fields);
    result.template = {};
    for (const [key, value] of Object.entries(body.template)) {
      check(['estimatedMinutes', 'targetAmount'].includes(key) ? value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
        : value === null || typeof value === 'string');
      result.template[key] = typeof value === 'string' ? value.trim() : value;
    }
    const t = result.template;
    check(t.title && t.title.length <= 100 && t.taskType && ['moral', 'academic', 'physical', 'artistic', 'labor'].includes(t.dimension)
      && (t.priority == null || ['low', 'medium', 'high'].includes(t.priority)));
  }
  return result;
};
const suffix = (scope, session, operationId) => {
  assertSessionCurrent(session); check(session.role === 'parent' && [scope?.familyId, scope?.childId, session.actorId].every(id));
  if (operationId !== undefined) check(uuid(operationId));
  return JSON.stringify([session.actorId, scope.familyId, scope.childId, ...(operationId ? [operationId] : [])]);
};
const validMarker = value => {
  try {
    keys(value, markerFields); check(value.schemaVersion === 1 && [value.actorId, value.childId, value.familyId].every(id)
      && uuid(value.operationId) && ['create', 'patch', 'stop'].includes(value.action)
      && (value.action === 'create' ? value.targetPlanId === null : id(value.targetPlanId))
      && typeof value.requestDigest === 'string' && /^[a-f0-9]{64}$/.test(value.requestDigest)); return true;
  } catch { return false; }
};
const hash = async value => {
  if (!window.crypto?.subtle) fail('RECURRING_CRYPTO_UNAVAILABLE');
  const bytes = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(recurringCanonical(value)));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
};
const digest = (marker, body) => {
  const { requestDigest: _requestDigest, ...identity } = marker; return hash({ ...identity, body });
};
const markerKeys = (scope, session) => {
  const identity = JSON.parse(suffix(scope, session));
  return Object.keys(localStorage).filter(key => {
    if (!key.startsWith(RECURRING_MARKER_PREFIX)) return false;
    try { const parts = JSON.parse(key.slice(RECURRING_MARKER_PREFIX.length));
      return Array.isArray(parts) && identity.every((part, index) => parts[index] === part);
    } catch { return false; }
  }).sort();
};
// Each UUID owns a separate slot: interleaved tabs may create two intents, but cannot erase either.
export const readRecurringCommand = (scope, session, operationId) => {
  const keys = markerKeys(scope, session);
  const fullKey = operationId ? RECURRING_MARKER_PREFIX + suffix(scope, session, operationId) : keys[0];
  if (!fullKey) return null;
  const raw = localStorage.getItem(fullKey);
  if (raw === null) return null;
  try {
    const marker = JSON.parse(raw);
    if (!validMarker(marker) || marker.actorId !== session.actorId || marker.familyId !== scope.familyId || marker.childId !== scope.childId
      || fullKey !== RECURRING_MARKER_PREFIX + suffix(scope, session, marker.operationId)) return { corrupt: true };
    let body = null;
    try {
      const entry = JSON.parse(sessionStorage.getItem(RECURRING_BODY_PREFIX + suffix(scope, session, marker.operationId)));
      if (entry?.revision === session.revision && same(entry.marker, marker)
        && same(normalizeRecurringBody(marker.action, entry.body), entry.body)) body = entry.body;
    } catch { /* A damaged private body cannot be retried; the minimal marker still supports query/abort. */ }
    return { marker, body };
  } catch { return { corrupt: true }; }
};
export const prepareRecurringCommand = async (scope, action, targetPlanId, input, session, isCurrent = () => true) => {
  check(isCurrent());
  suffix(scope, session);
  if (readRecurringCommand(scope, session)) fail('RECURRING_COMMAND_PENDING');
  const body = normalizeRecurringBody(action, input);
  check(action === 'create' ? targetPlanId === null && body.childId === scope.childId : id(targetPlanId));
  const marker = { schemaVersion: 1, familyId: scope.familyId, actorId: session.actorId, childId: scope.childId,
    operationId: body.operationId, action, targetPlanId };
  marker.requestDigest = await digest(marker, body);
  assertSessionCurrent(session);
  check(isCurrent());
  if (readRecurringCommand(scope, session)) fail('RECURRING_COMMAND_PENDING');
  const key = suffix(scope, session, marker.operationId);
  const encoded = JSON.stringify(marker);
  localStorage.setItem(RECURRING_MARKER_PREFIX + key, encoded);
  if (localStorage.getItem(RECURRING_MARKER_PREFIX + key) !== encoded) fail('RECURRING_STORAGE_UNAVAILABLE');
  sessionStorage.setItem(RECURRING_BODY_PREFIX + key, JSON.stringify({ marker, body, revision: session.revision }));
  const saved = readRecurringCommand(scope, session, marker.operationId);
  check(saved?.body && same(saved.marker, marker) && same(saved.body, body));
  return saved;
};
export const assertRecurringCommand = async (scope, command, session) => {
  const current = readRecurringCommand(scope, session, command.marker.operationId);
  check(current && !current.corrupt && same(current.marker, command.marker) && command.body
    && same(normalizeRecurringBody(command.marker.action, command.body), command.body));
  check(await digest(command.marker, command.body) === command.marker.requestDigest);
  assertSessionCurrent(session);
  check(same(readRecurringCommand(scope, session, command.marker.operationId)?.marker, command.marker));
};
export const settleRecurringCommand = async (scope, marker, receipt, session, isCurrent = () => true) => {
  check(isCurrent());
  const key = suffix(scope, session, marker.operationId);
  if (receipt?.state === 'not_found') return false;
  check(['succeeded', 'aborted'].includes(receipt?.state) && validMarker(marker));
  const { schemaVersion: _schemaVersion, ...identity } = marker;
  check(same(receipt.identity, identity) && typeof receipt.settledAt === 'string' && Number.isFinite(Date.parse(receipt.settledAt)));
  if (receipt.state === 'succeeded') {
    check(same(normalizeRecurringBody(marker.action, receipt.command), receipt.command)
      && await digest(marker, receipt.command) === marker.requestDigest
      && receipt.result?.data?.operationId === marker.operationId
      && receipt.result?.httpStatus === (marker.action === 'create' ? 201 : 200)
      && id(receipt.result?.data?.plan?.id) && receipt.result.data.plan.childId === marker.childId
      && (marker.action === 'create' || receipt.result.data.plan.id === marker.targetPlanId));
  } else check(receipt.command === null && receipt.result === null);
  assertSessionCurrent(session);
  check(isCurrent());
  check(same(readRecurringCommand(scope, session, marker.operationId)?.marker, marker));
  localStorage.removeItem(RECURRING_MARKER_PREFIX + key);
  if (localStorage.getItem(RECURRING_MARKER_PREFIX + key) !== null) fail('RECURRING_STORAGE_UNAVAILABLE');
  sessionStorage.removeItem(RECURRING_BODY_PREFIX + key); return true;
};
export const newRecurringOperationId = newTutorOperationId;
registerChildScopeReset(({ previousChildId }) => {
  const session = captureSession('parent'); if (!session) return;
  try { for (const key of Object.keys(sessionStorage)) {
    if (!key.startsWith(RECURRING_BODY_PREFIX)) continue;
    try { const p = JSON.parse(key.slice(RECURRING_BODY_PREFIX.length));
      if (Array.isArray(p) && p.length === 4 && p.slice(0, 3).every(id) && uuid(p[3]) && key === RECURRING_BODY_PREFIX + JSON.stringify(p)
        && p[0] === session.actorId && p[2] === previousChildId) sessionStorage.removeItem(key);
    } catch { /* Never infer ownership from a damaged key. */ }
  } } catch { /* Session/scope guards still refuse old callbacks when storage is unavailable. */ }
});
