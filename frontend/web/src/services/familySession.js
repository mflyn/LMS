export const PARENT_SESSION_KEY = 'family-growth.parent-session.v1';
export const CHILD_SESSION_KEY = 'family-growth.child-session.v1';
export const PARENT_SESSION_EXPIRED_EVENT = 'family-growth:parent-session-expired';
export const CHILD_SESSION_EXPIRED_EVENT = 'family-growth:child-session-expired';

const toParentSession = (value) => {
  if (!value || typeof value.token !== 'string' || !value.token.trim()) return null;
  if (!value.user || value.user.role !== 'parent' || !nonEmptyString(value.user.id)) return null;

  return {
    token: value.token,
    user: {
      id: value.user.id,
      name: value.user.name,
      role: 'parent'
    }
  };
};

const nonEmptyString = (value) => typeof value === 'string' && Boolean(value.trim());

const toChildSession = (value) => {
  if (!value || !nonEmptyString(value.token) || !value.child || typeof value.child !== 'object') {
    return null;
  }
  if (!nonEmptyString(value.child.childId)
    || !nonEmptyString(value.child.familyId)
    || !nonEmptyString(value.child.name)) {
    return null;
  }

  return {
    token: value.token,
    child: {
      childId: value.child.childId,
      familyId: value.child.familyId,
      name: value.child.name
    }
  };
};

const keys = { parent: PARENT_SESSION_KEY, student: CHILD_SESSION_KEY };
const changeKey = role => `family-growth.session-change.v1:${role}`;
const exitKey = (role, actorId) => `family-growth.session-exit.v1:${role}:${actorId}`;
const COMMAND_PREFIX = 'family-growth.completion-command.v1:';
const observers = new Set();
const observed = new Map();
const deniedRaw = new Map();
const snapshots = new WeakSet();
let sequence = 0;
// A revision is an invalidation nonce, never an authentication credential.
const revision = () => `${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`;
const parse = raw => { try { return JSON.parse(raw); } catch { return null; } };
const stored = key => { try { return localStorage.getItem(key); } catch { return null; } };
const actor = (role, session) => role === 'parent' ? session?.user.id : session?.child.childId;

const clearCommands = (role, actorId) => {
  if (!actorId) return;
  try {
    const remove = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(COMMAND_PREFIX)) continue;
      const suffix = key.slice(COMMAND_PREFIX.length), parts = parse(suffix);
      // Canonical keys own their entries, even if the body is damaged or claims another actor.
      const validKey = Array.isArray(parts) && parts.length === 6 && JSON.stringify(parts) === suffix
        && [0, 2, 3, 4].every(position => typeof parts[position] === 'string' && /^[0-9a-f]{24}$/.test(parts[position]))
        && ['parent', 'student'].includes(parts[1]) && ['complete', 'confirm'].includes(parts[5])
        && (parts[1] !== 'student' || (parts[0] === parts[3] && parts[5] === 'complete'));
      const scope = Array.isArray(parts)
        ? (validKey ? { actorId: parts[0], role: parts[1] } : null)
        : parse(sessionStorage.getItem(key))?.scope;
      if (scope?.actorId === actorId && scope.role === role) remove.push(key);
    }
    remove.forEach(key => sessionStorage.removeItem(key));
    return true;
  } catch { return false; }
};

// Persistent non-secret exit markers let a suspended tab clear its own command store on resume.
const reconcileExit = (role, actorId) => {
  if (!actorId) return;
  const marker = stored(exitKey(role, actorId));
  if (!marker) return;
  try {
    const seen = `family-growth.session-exit-seen.v1:${role}:${actorId}`;
    if (sessionStorage.getItem(seen) !== marker) {
      if (clearCommands(role, actorId)) sessionStorage.setItem(seen, marker);
    }
  } catch { clearCommands(role, actorId); }
};

const read = role => {
  if (!keys[role]) throw new TypeError('Session role must be parent or student');
  const raw = stored(keys[role]), value = parse(raw);
  const session = deniedRaw.has(role) && deniedRaw.get(role) === raw ? null
    : (role === 'parent' ? toParentSession : toChildSession)(value);
  const previous = observed.get(role);
  const change = parse(stored(changeKey(role)));
  const previousActor = previous?.snapshot?.actorId;
  if (session && previousActor && previousActor !== actor(role, session)) clearCommands(role, previousActor);
  reconcileExit(role, previous?.snapshot?.actorId);
  reconcileExit(role, change?.previousActorId);
  reconcileExit(role, change?.actorId);
  reconcileExit(role, actor(role, session));
  if (raw && !session) { try { localStorage.removeItem(keys[role]); } catch { /* Unavailable storage is anonymous. */ } }
  if (previous?.raw === raw && Boolean(previous.session) === Boolean(session)) return previous;
  const snapshot = session ? Object.freeze({ role, actorId: actor(role, session),
    revision: nonEmptyString(value.revision) ? value.revision : revision(), token: session.token }) : null;
  if (snapshot) snapshots.add(snapshot);
  const result = { raw, session, snapshot };
  observed.set(role, result);
  return result;
};

export const captureSession = role => read(role).snapshot;
export const isSessionCurrent = snapshot => Boolean(snapshot && snapshots.has(snapshot)
  && captureSession(snapshot.role) === snapshot);
export const assertSessionCurrent = snapshot => {
  if (!isSessionCurrent(snapshot)) throw Object.assign(new Error('Session changed'), { code: 'SESSION_CHANGED' });
  return snapshot;
};
export const subscribeSessionChanges = callback => {
  observers.add(callback);
  return () => observers.delete(callback);
};
const notify = (role, reason, previousActorId) => {
  const current = captureSession(role);
  const event = Object.freeze({ role, reason, previousActorId: previousActorId || null,
    actorId: current?.actorId || null, revision: current?.revision || null });
  observers.forEach(callback => callback(event));
};
const recordExit = (role, actorId, reason) => {
  if (!actorId) return;
  clearCommands(role, actorId);
  try {
    localStorage.setItem(exitKey(role, actorId), JSON.stringify({ revision: revision(), reason }));
  } catch { /* Sign-out must remain possible when storage becomes unavailable. */ }
  reconcileExit(role, actorId);
};
const save = (role, value) => {
  const session = (role === 'parent' ? toParentSession : toChildSession)(value);
  if (!session) throw new Error(role === 'parent'
    ? 'Only parent sessions can be persisted in the parent session store'
    : 'Only child sessions can be persisted in the child session store');
  const previous = captureSession(role);
  const lastActor = previous?.actorId || parse(stored(changeKey(role)))?.actorId;
  const nextActor = actor(role, session), nextRevision = revision();
  const switched = lastActor && lastActor !== nextActor;
  if (switched) recordExit(role, lastActor, 'account_switch');
  localStorage.setItem(changeKey(role), JSON.stringify({ revision: nextRevision,
    reason: switched ? 'account_switch' : 'authenticated', actorId: nextActor, previousActorId: lastActor || null }));
  localStorage.setItem(keys[role], JSON.stringify({ ...session, revision: nextRevision }));
  notify(role, switched ? 'account_switch' : 'authenticated', lastActor);
  return session;
};
const clear = (role, reason, expected) => {
  if (expected !== undefined && !isSessionCurrent(expected)) return false;
  const current = captureSession(role);
  const actorId = current?.actorId || parse(stored(changeKey(role)))?.actorId;
  if (reason === 'explicit_logout' || reason === 'account_switch') recordExit(role, actorId, reason);
  deniedRaw.set(role, stored(keys[role]));
  try {
    localStorage.setItem(changeKey(role), JSON.stringify({ revision: revision(), reason, actorId, previousActorId: actorId }));
  } catch { /* Other tabs may only observe an unclassified removal. */ }
  try { localStorage.removeItem(keys[role]); } catch { /* Keep the local credential denied. */ }
  notify(role, reason, actorId);
  return true;
};
export const loadParentSession = () => read('parent').session;
export const loadChildSession = () => read('student').session;
export const saveParentSession = value => save('parent', value);
export const saveChildSession = value => save('student', value);
export const clearParentSession = () => clear('parent', 'explicit_logout');
export const clearChildSession = () => clear('student', 'explicit_logout');
const expire = (role, expected) => {
  if (!clear(role, 'expired', expected)) return;
  const name = role === 'parent' ? PARENT_SESSION_EXPIRED_EVENT : CHILD_SESSION_EXPIRED_EVENT;
  window.dispatchEvent(new CustomEvent(name, { detail: { handled: true } }));
};
export const expireParentSession = expected => expire('parent', expected);
export const expireChildSession = expected => expire('student', expected);

window.addEventListener('storage', event => {
  if (event.storageArea && event.storageArea !== localStorage) return;
  for (const role of Object.keys(keys)) {
    if (event.key !== null && event.key !== keys[role] && event.key !== changeKey(role)
      && !event.key?.startsWith(`family-growth.session-exit.v1:${role}:`)) continue;
    const previousActor = observed.get(role)?.snapshot?.actorId;
    const change = parse(stored(changeKey(role)));
    const current = captureSession(role);
    // Unknown external removal is not evidence of an explicit user sign-out.
    const matchingChange = change && (current ? current.revision === change.revision
      : ['expired', 'explicit_logout', 'account_switch'].includes(change.reason));
    const reason = matchingChange ? change.reason : 'external_change';
    notify(role, reason || 'external_change', previousActor || change?.previousActorId || change?.actorId);
  }
});

const refreshVisibleSessions = () => {
  for (const role of Object.keys(keys)) notify(role, 'external_change', observed.get(role)?.snapshot?.actorId);
};
window.addEventListener('pageshow', refreshVisibleSessions);
window.addEventListener('focus', refreshVisibleSessions);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshVisibleSessions();
});

export const sessionRequestOptions = (signalOrOptions, expectedSession) => {
  const options = signalOrOptions && ('session' in signalOrOptions || 'signal' in signalOrOptions)
    ? signalOrOptions : { signal: signalOrOptions };
  if (expectedSession !== undefined && options.session !== undefined && expectedSession !== options.session) {
    throw Object.assign(new Error('Conflicting session scope'), { code: 'SESSION_CHANGED' });
  }
  return { ...options, session: expectedSession === undefined ? options.session : expectedSession };
};

export const requestWithSession = async (role, request, options = {}) => {
  const snapshot = options.session === undefined ? captureSession(role) : options.session;
  if (options.session !== undefined) {
    assertSessionCurrent(snapshot);
    if (snapshot.role !== role) throw Object.assign(new Error('Session role changed'), { code: 'SESSION_CHANGED' });
  }
  if (!snapshot) {
    throw Object.assign(new Error('Session is required'), {
      response: { status: 401, data: { error: { code: 'UNAUTHENTICATED' } } }
    });
  }
  assertSessionCurrent(snapshot);
  const config = { headers: { ...options.headers, Authorization: `Bearer ${snapshot.token}` } };
  if (options.signal) config.signal = options.signal;
  try {
    const result = await request(config, snapshot);
    assertSessionCurrent(snapshot);
    return result;
  } catch (error) {
    if (!isSessionCurrent(snapshot)) {
      throw Object.assign(new Error('Session changed'), { code: 'SESSION_CHANGED', response: error?.response });
    }
    if (error?.response?.status === 401) expire(role, snapshot);
    throw error;
  }
};
