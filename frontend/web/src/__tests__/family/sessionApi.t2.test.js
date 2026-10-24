import axios from 'axios';
import * as sessions from '../../services/familySession';
import * as parent from '../../services/familyApi';
import * as child from '../../services/childApi';

const save = (role, actor = 'a', token = actor) => role === 'parent'
  ? sessions.saveParentSession({ token, user: { id: actor, name: actor, role } })
  : sessions.saveChildSession({ token, child: { childId: actor, familyId: 'family', name: actor } });
const command = (actorId, role) => {
  const key = `family-growth.completion-command.v1:${role}:${actorId}`;
  sessionStorage.setItem(key, JSON.stringify({ scope: { actorId, role }, body: { childNote: 'synthetic' } }));
  return key;
};
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); });

test.each(['parent', 'student'])('%s recovery list sends only pagination with the captured identity', async role => {
  save(role); const snapshot = sessions.captureSession(role);
  axios.get.mockResolvedValue({ data: { success: true, data: { items: [], page: 2, hasMore: false } } });
  const list = role === 'parent' ? parent.listCompletionRecoveries : child.listOwnCompletionRecoveries;
  await list({ page: 2, pageSize: 20, actorId: 'other', familyId: 'other', childId: 'other' }, undefined, snapshot);
  expect(axios.get.mock.calls[0][0]).toBe('/api/growth-tasks/completion-recoveries?page=2&pageSize=20');
  save(role, 'new');
  await expect(list({ page: 1 }, undefined, snapshot)).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(axios.get).toHaveBeenCalledTimes(1);
});

describe.each(['parent', 'student'])('T2 %s session isolation', role => {
  const get = () => role === 'parent' ? parent.getMyFamily() : child.getOwnProfile();
  const expire = snapshot => role === 'parent' ? sessions.expireParentSession(snapshot) : sessions.expireChildSession(snapshot);
  const clear = () => role === 'parent' ? sessions.clearParentSession() : sessions.clearChildSession();

  test('immutable snapshot rejects same-actor relogin and ABA, not just changed token', () => {
    save(role);
    const first = sessions.captureSession(role);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first).toMatchObject({ role, actorId: 'a', token: 'a' });
    expect(sessions.isSessionCurrent(first)).toBe(true);
    save(role, 'a', 'a');
    expect(sessions.isSessionCurrent(first)).toBe(false);
    expect(() => sessions.assertSessionCurrent(first)).toThrow();
  });

  test('late ordinary success and late 401 cannot affect a newer session', async () => {
    save(role); const old = deferred(); axios.get.mockReturnValueOnce(old.promise);
    const request = get(); save(role, 'b');
    old.resolve({ data: { data: { private: 'old' } } });
    await expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    const denied = deferred(); axios.get.mockReturnValueOnce(denied.promise);
    const stale = get(); save(role, 'c');
    const response = { status: 401, data: { error: { code: 'STALE_TOKEN' } } };
    denied.reject({ response });
    await expect(stale).rejects.toMatchObject({ code: 'SESSION_CHANGED', response });
    expect(sessions.captureSession(role).actorId).toBe('c');
  });

  test('current 401 preserves original error and command, explicit logout removes only its actor', async () => {
    save(role); const own = command('a', role), other = command('other', role), otherRole = command('a', role === 'parent' ? 'student' : 'parent');
    const error = { response: { status: 401, data: { error: { code: 'UNAUTHENTICATED' } } } };
    axios.get.mockRejectedValueOnce(error);
    await expect(get()).rejects.toBe(error);
    expect(sessions.captureSession(role)).toBeNull();
    expect(sessionStorage.getItem(own)).not.toBeNull();
    save(role); clear();
    expect(sessionStorage.getItem(own)).toBeNull();
    expect(sessionStorage.getItem(other)).not.toBeNull();
    expect(sessionStorage.getItem(otherRole)).not.toBeNull();
  });

  test('Gateway UNAUTHENTICATED expires only the current session, preserves command on same-actor relogin, and leaves business 403 authenticated', async () => {
    save(role); const own = command('a', role);
    const name = role === 'parent' ? sessions.PARENT_SESSION_EXPIRED_EVENT : sessions.CHILD_SESSION_EXPIRED_EVENT;
    const listener = jest.fn(); window.addEventListener(name, listener);
    try {
      const forbidden = { response: { status: 403, data: { error: { code: 'CHILD_ACCESS_DENIED' } } } };
      axios.get.mockRejectedValueOnce(forbidden);
      await expect(get()).rejects.toBe(forbidden);
      expect(sessions.captureSession(role).actorId).toBe('a');
      expect(listener).not.toHaveBeenCalled();
      const expired = { response: { status: 401, data: { error: { code: 'UNAUTHENTICATED' } } } };
      axios.get.mockRejectedValueOnce(expired);
      await expect(get()).rejects.toBe(expired);
      expect(sessions.captureSession(role)).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem(own)).not.toBeNull();
      save(role, 'a', 'renewed');
      expect(sessionStorage.getItem(own)).not.toBeNull();
      const delayed = deferred(); axios.get.mockReturnValueOnce(delayed.promise);
      const oldRequest = get(); save(role, 'a', 'newer');
      delayed.reject(expired);
      await expect(oldRequest).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
      expect(sessions.captureSession(role).token).toBe('newer');
      expect(listener).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener(name, listener); }
  });

  test('account switch clears former actor even following expiry; old expiry cannot clear new actor', () => {
    save(role); const own = command('a', role), first = sessions.captureSession(role);
    expire(first); save(role, 'b');
    expect(sessionStorage.getItem(own)).toBeNull();
    expire(first);
    expect(sessions.captureSession(role).actorId).toBe('b');
  });

  test('explicit expected scope prevents HTTP even before storage event arrives', async () => {
    save(role); const session = sessions.captureSession(role);
    const key = role === 'parent' ? sessions.PARENT_SESSION_KEY : sessions.CHILD_SESSION_KEY;
    const replacement = role === 'parent' ? { token: 'b', user: { id: 'b', role: 'parent' } }
      : { token: 'b', child: { childId: 'b', familyId: 'family', name: 'b' } };
    localStorage.setItem(key, JSON.stringify(replacement));
    const request = role === 'parent' ? parent.getPrivateMediaAccess('m', { session }) : child.getOwnPrivateMediaAccess('m', { session });
    await expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(axios.get).not.toHaveBeenCalled();
  });
});

test('session subscriptions expose reasons without credentials and unsubscribe', () => {
  const changed = jest.fn(), unsubscribe = sessions.subscribeSessionChanges(changed);
  save('parent'); sessions.expireParentSession(); save('parent'); sessions.clearParentSession();
  expect(changed.mock.calls.map(([event]) => event.reason)).toEqual(expect.arrayContaining(['expired', 'explicit_logout']));
  expect(changed.mock.calls.every(([event]) => !Object.hasOwn(event, 'token') && !Object.hasOwn(event, 'session'))).toBe(true);
  unsubscribe(); const count = changed.mock.calls.length; save('parent'); expect(changed).toHaveBeenCalledTimes(count);
});

const body = { operationId: 'original', expectedCompletionVersion: 0, expectedChecklistVersion: 2,
  checkedItemIds: [], completionMediaIds: ['one', 'two'], actualMinutes: 0, actualAmount: 0,
  difficulty: 'easy', needsHelp: false, childNote: '' };
test.each(['parent', 'student'])('T2 %s complete and recovery preserve fields, errors and scope', async role => {
  save(role); const snapshot = sessions.captureSession(role), signal = new AbortController().signal;
  axios.patch.mockResolvedValue({ data: { data: { task: {} } } });
  axios.get.mockResolvedValue({ data: { data: { recovery: {} } } });
  axios.post.mockResolvedValue({ data: { data: { task: {} } } });
  const complete = role === 'parent' ? parent.completeGrowthTask : child.completeOwnTask;
  const discover = role === 'parent' ? parent.getCompletionRecovery : child.getOwnCompletionRecovery;
  const recover = role === 'parent' ? parent.recoverTaskCompletion : child.recoverOwnTaskCompletion;
  await complete('task/a', { ...body, remoteOperationId: 'secret', actorId: 'other', parentFeedback: 'no' }, signal, snapshot);
  expect(axios.patch).toHaveBeenLastCalledWith('/api/growth-tasks/task%2Fa/complete', body, { headers: { Authorization: 'Bearer a' }, signal });
  await discover('task/a', signal, snapshot);
  expect(axios.get).toHaveBeenLastCalledWith('/api/growth-tasks/task%2Fa/completion-recovery', { headers: { Authorization: 'Bearer a' }, signal });
  await recover('task/a', 'op/a', signal, snapshot);
  expect(axios.post).toHaveBeenLastCalledWith('/api/growth-tasks/task%2Fa/completion-operations/op%2Fa/recover', {}, { headers: { Authorization: 'Bearer a' }, signal });
  const error = { response: { status: 409, data: { success: false, error: { code: 'VERSION_CONFLICT', details: ['kept'] } } } };
  axios.patch.mockRejectedValueOnce(error);
  await expect(complete('task', body, signal, snapshot)).rejects.toBe(error);
  save(role, 'b');
  await expect(recover('task', 'original', signal, snapshot)).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(axios.post).toHaveBeenCalledTimes(1);
});

test('parent confirm sends only the actually supplied version and feedback', async () => {
  save('parent'); axios.patch.mockResolvedValue({ data: {} });
  const signal = new AbortController().signal, session = sessions.captureSession('parent');
  await parent.confirmGrowthTask('t', { expectedCompletionVersion: 3, parentFeedback: '', operationId: 'no', completionMediaIds: ['no'] }, signal, session);
  expect(axios.patch).toHaveBeenCalledWith('/api/growth-tasks/t/confirm', { expectedCompletionVersion: 3, parentFeedback: '' }, { headers: { Authorization: 'Bearer a' }, signal });
});

test.each(['parent', 'student'])('%s suspended tab reconciles exit markers before sending after same-actor relogin', role => {
  save(role); const own = command('a', role);
  (role === 'parent' ? sessions.clearParentSession : sessions.clearChildSession)();
  save(role);
  // Model another tab's retained sessionStorage, which has not consumed the marker yet.
  command('a', role);
  sessionStorage.removeItem(`family-growth.session-exit-seen.v1:${role}:a`);
  sessions.captureSession(role);
  expect(sessionStorage.getItem(own)).toBeNull();
  const next = command('a', role);
  sessions.captureSession(role);
  expect(sessionStorage.getItem(next)).not.toBeNull();
});

test('parent GET supports both the original signal position and the shared fourth-position scope', async () => {
  save('parent'); const session = sessions.captureSession('parent'), signal = new AbortController().signal;
  axios.get.mockResolvedValue({ data: {} });
  await parent.getGrowthTask('t', undefined, signal, session);
  await parent.getGrowthTask('t', undefined, signal);
  await parent.getGrowthTask('t', signal, session);
  expect(axios.get.mock.calls.every(([, config]) => config.signal === signal)).toBe(true);
});

test.each(['parent', 'student'])('%s explicit logout is not prevented by a marker write failure', role => {
  save(role); const own = command('a', role);
  const original = Storage.prototype.setItem;
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function set(key, value) {
    if (this === localStorage && key.startsWith('family-growth.session-')) throw new Error('unavailable');
    return original.call(this, key, value);
  });
  try {
    expect(() => (role === 'parent' ? sessions.clearParentSession : sessions.clearChildSession)()).not.toThrow();
    expect(sessions.captureSession(role)).toBeNull();
    expect(sessionStorage.getItem(own)).toBeNull();
  } finally { spy.mockRestore(); }
});

test.each(['parent', 'student'])('%s observes a legacy cross-tab account replacement and clears only the old actor', role => {
  save(role); const old = command('a', role), next = command('b', role);
  const key = role === 'parent' ? sessions.PARENT_SESSION_KEY : sessions.CHILD_SESSION_KEY;
  localStorage.setItem(key, JSON.stringify(role === 'parent'
    ? { token: 'b', user: { id: 'b', role: 'parent' } }
    : { token: 'b', child: { childId: 'b', familyId: 'family', name: 'b' } }));
  expect(sessions.captureSession(role).actorId).toBe('b');
  expect(sessionStorage.getItem(old)).toBeNull();
  expect(sessionStorage.getItem(next)).not.toBeNull();
});

test.each(['parent', 'student'])('%s rejects an expected session of the other role without HTTP', async role => {
  save('parent'); save('student');
  const snapshot = sessions.captureSession(role === 'parent' ? 'student' : 'parent');
  const request = role === 'parent' ? parent.completeGrowthTask('t', body, undefined, snapshot)
    : child.completeOwnTask('t', body, undefined, snapshot);
  await expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(axios.patch).not.toHaveBeenCalled();
});

test('current session error contracts retain the original response for every shared verb', async () => {
  save('parent'); save('student');
  const error = { response: { status: 503, data: { error: { code: 'MEDIA_REFERENCE_PENDING', details: [] } } } };
  axios.get.mockRejectedValue(error); axios.patch.mockRejectedValue(error); axios.post.mockRejectedValue(error); axios.delete.mockRejectedValue(error);
  for (const invoke of [() => parent.listGrowthTasks(), () => parent.createGrowthTask({}),
    () => parent.updateGrowthTask('t', {}), () => parent.deletePrivateMedia('m'),
    () => child.listOwnTasks(), () => child.createOwnMistake({}),
    () => child.reviewOwnMistake('m', {}), () => child.deleteOwnPrivateMedia('m')]) {
    await expect(invoke()).rejects.toBe(error);
  }
});

test.each(['parent', 'student'])('%s media APIs honor the third snapshot before upload, access and delete', async role => {
  save(role, 'a'); const session = sessions.captureSession(role), signal = new AbortController().signal;
  save(role, 'b');
  axios.post.mockResolvedValue({ data: {} }); axios.get.mockResolvedValue({ data: {} }); axios.delete.mockResolvedValue({ data: {} });
  const input = { file: new File(['synthetic'], 'work.png', { type: 'image/png' }), purpose: 'task_completion', childId: 'a' };
  const requests = role === 'student'
    ? [() => child.uploadOwnPrivateMedia(input, signal, session), () => child.getOwnPrivateMediaAccess('m', signal, session),
      () => child.deleteOwnPrivateMedia('m', signal, session)]
    : [() => parent.uploadPrivateMedia(input, signal, session), () => parent.getPrivateMediaAccess('m', signal, session),
      () => parent.deletePrivateMedia('m', signal, session)];
  for (const invoke of requests) await expect(invoke()).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(axios.post).not.toHaveBeenCalled(); expect(axios.get).not.toHaveBeenCalled(); expect(axios.delete).not.toHaveBeenCalled();
});
