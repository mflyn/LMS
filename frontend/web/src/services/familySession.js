export const PARENT_SESSION_KEY = 'family-growth.parent-session.v1';
export const CHILD_SESSION_KEY = 'family-growth.child-session.v1';
export const PARENT_SESSION_EXPIRED_EVENT = 'family-growth:parent-session-expired';
export const CHILD_SESSION_EXPIRED_EVENT = 'family-growth:child-session-expired';
export const TUTOR_COMMAND_PREFIX = 'family-growth.ai1-command.v1:';
export const AI2_COMMAND_PREFIX = 'family-growth.ai2-command.v1:';
export const AI3_COMMAND_PREFIX = 'family-growth.ai3-command.v1:';

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
      name: value.child.name,
      ...(Number.isInteger(value.child.grade) && value.child.grade >= 1 && value.child.grade <= 6
        ? { grade: value.child.grade } : {})
    }
  };
};

const keys = { parent: PARENT_SESSION_KEY, student: CHILD_SESSION_KEY };
const changeKey = role => `family-growth.session-change.v1:${role}`;
const exitKey = (role, actorId) => `family-growth.session-exit.v1:${role}:${actorId}`;
const ai3ExpiryKey = (role, actorId) => `family-growth.ai3-session-expiry.v1:${role}:${actorId}`;
const COMMAND_PREFIX = 'family-growth.completion-command.v1:';
const observers = new Set();
const observed = new Map();
const deniedRaw = new Map();
const snapshots = new WeakSet();
let sequence = 0;
// A revision is an invalidation nonce, never an authentication credential.
const revision = () => `${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`;
const parse = raw => { try { return JSON.parse(raw); } catch { return null; } };
const sessionStore = role => role === 'student' ? sessionStorage : localStorage;
const stored = (key, role = 'parent') => { try { return sessionStore(role).getItem(key); } catch { return null; } };
const actor = (role, session) => role === 'parent' ? session?.user.id : session?.child.childId;

const canonicalLoginId = value => typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value)
  ? value.toLowerCase() : value;
const readChildLoginExit = actorId => {
  try { return localStorage.getItem(exitKey('student', actorId)); }
  catch {
    throw Object.assign(new Error('Child login marker unavailable'), { code: 'CHILD_SESSION_STORAGE_UNAVAILABLE' });
  }
};
// Anonymous tabs have no session snapshot; bind invalidation to the requested actor before sending PIN.
export const captureChildLogin = credentials => {
  const actorId = canonicalLoginId(credentials.childId);
  return Object.freeze({ actorId, familyId: canonicalLoginId(credentials.familyId),
    exitRevision: readChildLoginExit(actorId) });
};
export const assertChildLoginCurrent = (login, session) => {
  if (readChildLoginExit(login.actorId) !== login.exitRevision
    || (session && (canonicalLoginId(session.child.childId) !== login.actorId
      || canonicalLoginId(session.child.familyId) !== login.familyId))) {
    throw Object.assign(new Error('Child login changed'), { code: 'CHILD_LOGIN_CHANGED' });
  }
};

const clearCommands = (role, actorId, ai3Only = false) => {
  if (!actorId) return;
  try {
    const remove = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (ai3Only && !key?.startsWith(AI3_COMMAND_PREFIX)) continue;
      const aiPrefix = [AI2_COMMAND_PREFIX, AI3_COMMAND_PREFIX].find(prefix => key?.startsWith(prefix));
      if (aiPrefix) {
        const suffix = key.slice(aiPrefix.length), parts = parse(suffix);
        if (Array.isArray(parts) && parts.length === 4 && JSON.stringify(parts) === suffix
          && ['parent', 'student'].includes(parts[0])
          && parts.slice(1).every(value => typeof value === 'string' && /^[0-9a-f]{24}$/.test(value))
          && (parts[0] !== 'student' || parts[1] === parts[3])
          && parts[0] === role && parts[1] === actorId) remove.push(key);
        continue;
      }
      if (role === 'parent' && key?.startsWith(TUTOR_COMMAND_PREFIX)) {
        const suffix = key.slice(TUTOR_COMMAND_PREFIX.length), parts = parse(suffix);
        if (Array.isArray(parts) && parts.length === 3 && JSON.stringify(parts) === suffix
          && parts.every(value => typeof value === 'string' && /^[0-9a-f]{24}$/.test(value))
          && parts[0] === actorId) remove.push(key);
        continue;
      }
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
const reconcileExit = (role, actorId, ai3Only = false) => {
  if (!actorId) return;
  const marker = stored((ai3Only ? ai3ExpiryKey : exitKey)(role, actorId));
  if (!marker) return;
  try {
    const seen = ai3Only ? `family-growth.ai3-session-expiry-seen.v1:${role}:${actorId}`
      : `family-growth.session-exit-seen.v1:${role}:${actorId}`;
    if (sessionStorage.getItem(seen) !== marker) {
      if (clearCommands(role, actorId, ai3Only)) sessionStorage.setItem(seen, marker);
    }
  } catch { clearCommands(role, actorId, ai3Only); }
};

const read = role => {
  if (!keys[role]) throw new TypeError('Session role must be parent or student');
  // Shared legacy child credentials are never imported into a new tab.
  if (role === 'student') { try { localStorage.removeItem(CHILD_SESSION_KEY); } catch { /* Never fall back to shared credentials. */ } }
  let raw = stored(keys[role], role);
  const value = parse(raw);
  let session = deniedRaw.has(role) && deniedRaw.get(role) === raw ? null
    : (role === 'parent' ? toParentSession : toChildSession)(value);
  if (role === 'student' && session
    && (value.exitRevision ?? null) !== stored(exitKey(role, session.child.childId))) {
    const actorId = session.child.childId, marker = parse(stored(exitKey(role, actorId)));
    reconcileExit(role, actorId);
    deniedRaw.set(role, raw);
    try {
      sessionStorage.setItem(changeKey(role), JSON.stringify({ revision: revision(), actorId,
        reason: ['explicit_logout', 'account_switch'].includes(marker?.reason) ? marker.reason : 'external_change' }));
      sessionStorage.removeItem(keys[role]);
    } catch { /* The in-memory denial still invalidates the captured credential. */ }
    session = null;
    raw = stored(keys[role], role);
  }
  const previous = observed.get(role);
  const change = parse(stored(changeKey(role), role));
  const previousActor = previous?.snapshot?.actorId;
  if (session && previousActor && previousActor !== actor(role, session)) clearCommands(role, previousActor);
  for (const actorId of new Set([previousActor, change?.previousActorId, change?.actorId, actor(role, session)])) {
    reconcileExit(role, actorId);
    reconcileExit(role, actorId, true);
  }
  if (raw && !session) { try { sessionStore(role).removeItem(keys[role]); } catch { /* Unavailable storage is anonymous. */ } }
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
  const ai3Only = reason === 'expired';
  clearCommands(role, actorId, ai3Only);
  try {
    // Expiry must not overwrite a prior explicit-exit marker or change older command recovery policies.
    localStorage.setItem((ai3Only ? ai3ExpiryKey : exitKey)(role, actorId), JSON.stringify({ revision: revision(), reason }));
  } catch { /* Sign-out must remain possible when storage becomes unavailable. */ }
  reconcileExit(role, actorId, ai3Only);
};
const save = (role, value, login) => {
  const session = (role === 'parent' ? toParentSession : toChildSession)(value);
  if (!session) throw new Error(role === 'parent'
    ? 'Only parent sessions can be persisted in the parent session store'
    : 'Only child sessions can be persisted in the child session store');
  if (login) assertChildLoginCurrent(login, session);
  const previous = captureSession(role);
  const lastActor = previous?.actorId || parse(stored(changeKey(role), role))?.actorId;
  const nextActor = actor(role, session), nextRevision = revision();
  const switched = lastActor && lastActor !== nextActor;
  if (switched) recordExit(role, lastActor, 'account_switch');
  if (login) assertChildLoginCurrent(login, session);
  const serialized = JSON.stringify({ ...session, revision: nextRevision,
    ...(role === 'student' ? { exitRevision: login ? login.exitRevision : stored(exitKey(role, nextActor)) } : {}) });
  try {
    sessionStore(role).setItem(changeKey(role), JSON.stringify({ revision: nextRevision,
      reason: switched ? 'account_switch' : 'authenticated', actorId: nextActor, previousActorId: lastActor || null }));
    sessionStore(role).setItem(keys[role], serialized);
    if (role === 'student' && stored(keys[role], role) !== serialized) throw new Error('Session storage write failed');
  } catch (error) {
    if (role !== 'student') throw error;
    clear(role, 'storage_unavailable');
    throw Object.assign(new Error('Child session storage unavailable'), { code: 'CHILD_SESSION_STORAGE_UNAVAILABLE' });
  }
  if (login) {
    try { assertChildLoginCurrent(login, session); }
    catch (error) {
      deniedRaw.set(role, serialized);
      // Roll back only this attempted credential, never a newer session or its commands.
      try { if (sessionStore(role).getItem(keys[role]) === serialized) sessionStore(role).removeItem(keys[role]); }
      catch { /* The in-memory denial remains effective if storage becomes unavailable. */ }
      throw error;
    }
  }
  notify(role, switched ? 'account_switch' : 'authenticated', lastActor);
  return session;
};
const clear = (role, reason, expected) => {
  if (expected !== undefined && !isSessionCurrent(expected)) return false;
  const current = captureSession(role);
  const actorId = current?.actorId || parse(stored(changeKey(role), role))?.actorId;
  if (['explicit_logout', 'account_switch', 'expired'].includes(reason)) recordExit(role, actorId, reason);
  deniedRaw.set(role, stored(keys[role], role));
  try {
    sessionStore(role).setItem(changeKey(role), JSON.stringify({ revision: revision(), reason, actorId, previousActorId: actorId }));
  } catch { /* Other tabs may only observe an unclassified removal. */ }
  try { sessionStore(role).removeItem(keys[role]); } catch { /* Keep the local credential denied. */ }
  notify(role, reason, actorId);
  return true;
};
export const loadParentSession = () => read('parent').session;
export const loadChildSession = () => read('student').session;
// A reload can follow an already handled 401; retain only its non-private explanation.
export const wasChildSessionExpired = () => !captureSession('student')
  && parse(stored(changeKey('student'), 'student'))?.reason === 'expired';
export const saveParentSession = value => save('parent', value);
export const saveChildSession = (value, login) => save('student', value, login);
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
  for (const role of Object.keys(keys)) {
    if (role === 'student') {
      const actorId = observed.get(role)?.snapshot?.actorId || parse(stored(changeKey(role), role))?.actorId;
      const localEvent = event.storageArea === sessionStorage;
      if (localEvent ? event.key !== null && event.key !== keys[role] && event.key !== changeKey(role)
        : !actorId || (event.key !== exitKey(role, actorId) && event.key !== ai3ExpiryKey(role, actorId))) continue;
    } else if (event.storageArea && event.storageArea !== localStorage) continue;
    if (event.key !== null && event.key !== keys[role] && event.key !== changeKey(role)
      && !event.key?.startsWith(`family-growth.session-exit.v1:${role}:`)
      && !event.key?.startsWith(`family-growth.ai3-session-expiry.v1:${role}:`)) continue;
    const previousActor = observed.get(role)?.snapshot?.actorId;
    const current = captureSession(role);
    // Anonymous tabs can retain an unrelated last actor. PIN attempts validate their target marker on settlement.
    if (role === 'student' && !previousActor && !current) continue;
    const change = parse(stored(changeKey(role), role));
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
