import { act, renderHook, waitFor } from '@testing-library/react';
import { useTaskCompletion } from '../../hooks/useTaskCompletion';
import { saveChildSession, captureSession } from '../../services/familySession';

const id = value => String(value).padStart(24, '0');
const scope = { role: 'student', actorId: id(2), childId: id(2), familyId: id(1), taskId: id(3) };
const task = (overrides = {}) => ({ taskId: id(3), childId: id(2), familyId: id(1), title: '合成任务',
  status: 'pending', checklistSnapshot: [], checklistVersion: 0, checkedItemIds: [],
  completionVersion: 0, completionMediaIds: [], completionMediaReferenceState: 'stable', ...overrides });
const result = body => ({ task: { taskId: id(3), status: 'completed', checklistVersion: body.expectedChecklistVersion,
  completionVersion: body.expectedCompletionVersion + 1, completionMediaIds: body.completionMediaIds,
  completionMediaReferenceState: 'stable', parentConfirmed: false, completedAt: '2026-10-24T01:00:00.000Z' } });
const pending = () => Object.assign(new Error('pending'), { response: { status: 503,
  data: { success: false, error: { code: 'MEDIA_REFERENCE_PENDING', message: 'pending', details: null } } } });
let api, session;
afterEach(() => jest.restoreAllMocks());
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  saveChildSession({ token: 'synthetic', child: { childId: id(2), familyId: id(1), name: '合成孩子' } });
  session = captureSession('student');
  api = { getTask: jest.fn().mockResolvedValue({ task: task() }), complete: jest.fn(),
    discover: jest.fn().mockResolvedValue({ recovery: { state: 'none', operationId: null, targetCompletionVersion: null } }),
    recover: jest.fn(), confirm: jest.fn() };
});
const mount = () => renderHook(props => useTaskCompletion(props), { initialProps: { scope, session, api } });

test('freezes one persisted command before HTTP and retries its exact body after lost response', async () => {
  api.complete.mockImplementationOnce(async (_id, body) => {
    expect(sessionStorage.length).toBe(1);
    expect(JSON.parse(sessionStorage.getItem(sessionStorage.key(0))).body).toEqual(body);
    throw pending();
  }).mockImplementationOnce(async (_id, body) => result(body));
  const h = mount(); await waitFor(() => expect(h.result.current.state).toBe('ready'));
  await act(async () => h.result.current.submit({ completionMediaIds: [id(4)], checkedItemIds: [], actualMinutes: 0 }));
  expect(h.result.current.state).toBe('uncertain');
  await act(async () => h.result.current.submit({ completionMediaIds: [] }));
  expect(api.complete).toHaveBeenCalledTimes(1);
  await act(async () => h.result.current.retry());
  expect(api.complete.mock.calls[1][1]).toEqual(api.complete.mock.calls[0][1]);
  expect(sessionStorage.length).toBe(0);
});

test('refresh restores a local command but never automatically resends it', async () => {
  api.complete.mockRejectedValue(pending());
  const h = mount(); await waitFor(() => expect(h.result.current.state).toBe('ready'));
  await act(async () => h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }));
  h.unmount();
  const restored = mount(); await waitFor(() => expect(restored.result.current.state).toBe('uncertain'));
  expect(api.complete).toHaveBeenCalledTimes(1);
  expect(restored.result.current.command.body.operationId).toBe(api.complete.mock.calls[0][1].operationId);
});

test('missing local command uses readonly discovery and only explicit original-actor recovery', async () => {
  const operationId = '00000000-0000-4000-8000-000000000001';
  api.getTask.mockResolvedValue({ task: task({ completionMediaReferenceState: 'pending_recovery' }) });
  api.discover.mockResolvedValue({ recovery: { state: 'recoverable', operationId, targetCompletionVersion: 1 } });
  api.recover.mockResolvedValue(result({ expectedChecklistVersion: 0, expectedCompletionVersion: 0, completionMediaIds: [] }));
  const h = mount(); await waitFor(() => expect(h.result.current.recovery?.state).toBe('recoverable'));
  expect(api.recover).not.toHaveBeenCalled(); expect(api.complete).not.toHaveBeenCalled();
  await act(async () => h.result.current.recover());
  expect(api.recover).toHaveBeenCalledWith(scope.taskId, operationId, expect.anything(), session);
  expect(api.complete).not.toHaveBeenCalled();
});

test('storage failure prevents HTTP', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).toBe('ready'));
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  await act(async () => h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }));
  spy.mockRestore(); expect(api.complete).not.toHaveBeenCalled();
  expect(h.result.current.error).toBeTruthy();
});

test.each(['lost', '404', 'malformed'])('recovery %s keeps the durable operation id and blocks a new completion', async failure => {
  const operationId = '00000000-0000-4000-8000-000000000001';
  api.getTask.mockResolvedValue({ task: task({ completionMediaReferenceState: 'pending_recovery' }) });
  api.discover.mockResolvedValue({ recovery: { state: 'recoverable', operationId, targetCompletionVersion: 1 } });
  if (failure === 'malformed') api.recover.mockResolvedValueOnce({ task: { taskId: scope.taskId, completionVersion: 99 } });
  else api.recover.mockRejectedValueOnce(failure === 'lost' ? Error('lost') : { response: { status: 404 } });
  const h = mount(); await waitFor(() => expect(h.result.current.recovery?.state).toBe('recoverable'));
  await act(async () => h.result.current.recover());
  expect(h.result.current.state).toBe('recovery'); expect(h.result.current.editable).toBe(false);
  await act(async () => h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }));
  expect(api.complete).not.toHaveBeenCalled();
  api.recover.mockResolvedValueOnce(result({ expectedChecklistVersion: 0, expectedCompletionVersion: 0, completionMediaIds: [] }));
  await act(async () => h.result.current.recover());
  expect(api.recover).toHaveBeenCalledTimes(2);
  expect(api.recover.mock.calls.map(call => call[1])).toEqual([operationId, operationId]);
});

test('second persistence failure retains the original command for explicit retry without reload', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).toBe('ready'));
  const realSet = Storage.prototype.setItem; let commandWrites = 0;
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key.startsWith('family-growth.completion-command.v1:') && ++commandWrites === 2) throw Error('quota');
    return realSet.call(this, key, value);
  });
  await act(async () => h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }));
  const saved = JSON.parse(sessionStorage.getItem(Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i))
    .find(key => key.startsWith('family-growth.completion-command.v1:'))));
  expect(api.complete).not.toHaveBeenCalled();
  expect(h.result.current.command?.body).toEqual(saved.body);
  spy.mockRestore(); api.complete.mockImplementation(async (_id, body) => result(body));
  await act(async () => h.result.current.retry());
  expect(api.complete).toHaveBeenCalledTimes(1); expect(api.complete.mock.calls[0][1]).toEqual(saved.body);
});

test('successful first write with failed readback offers a verified original record after storage recovers', async () => {
  const h = mount(); await waitFor(() => expect(h.result.current.state).toBe('ready'));
  const realGet = Storage.prototype.getItem, realSet = Storage.prototype.setItem; let written = false;
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key.startsWith('family-growth.completion-command.v1:')) written = true;
    return realSet.call(this, key, value);
  });
  const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (written && key.startsWith('family-growth.completion-command.v1:')) throw Error('readback unavailable');
    return realGet.call(this, key);
  });
  await act(async () => h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }));
  expect(api.complete).not.toHaveBeenCalled();
  get.mockRestore(); set.mockRestore();
  await act(async () => h.result.current.refresh());
  expect(h.result.current.command).not.toBeNull();
  api.complete.mockImplementation(async (_id, body) => result(body));
  await act(async () => h.result.current.retry()); expect(api.complete).toHaveBeenCalledTimes(1);
});

test('the first render for B never exposes A task, command, or editing permission', async () => {
  const frames = [];
  const h = renderHook(props => {
    const controller = useTaskCompletion(props);
    frames.push({ scope: props.scope.taskId, task: controller.task?.taskId, editable: controller.editable });
    return controller;
  }, { initialProps: { scope, session, api } });
  await waitFor(() => expect(h.result.current.task?.taskId).toBe(id(3)));
  api.getTask.mockImplementation(() => new Promise(() => {}));
  h.rerender({ scope: { ...scope, taskId: id(9) }, session, api });
  const bFrames = frames.filter(frame => frame.scope === id(9));
  expect(bFrames.length).toBeGreaterThan(0);
  expect(bFrames.every(frame => frame.task === undefined && !frame.editable)).toBe(true);
});

test('a current session for B cannot load or send a stale A scope before the storage event arrives', async () => {
  saveChildSession({ token: 'synthetic-b', child: { childId: id(8), familyId: id(1), name: '另一个合成孩子' } });
  session = captureSession('student');
  const h = mount();
  await waitFor(() => expect(h.result.current.state).not.toBe('loading'));
  expect(api.getTask).not.toHaveBeenCalled();
  await act(async () => h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }));
  expect(api.complete).not.toHaveBeenCalled(); expect(h.result.current.task).toBeNull();
});

test('old task success and finally cannot populate a different task scope', async () => {
  let resolve; api.complete.mockImplementation(() => new Promise(done => { resolve = done; }));
  const h = mount(); await waitFor(() => expect(h.result.current.state).toBe('ready'));
  let promise; act(() => { promise = h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }); });
  const oldBody = api.complete.mock.calls[0][1];
  api.getTask.mockResolvedValue({ task: task({ taskId: id(9) }) });
  h.rerender({ scope: { ...scope, taskId: id(9) }, session, api });
  await waitFor(() => expect(h.result.current.task?.taskId).toBe(id(9)));
  await act(async () => { resolve(result(oldBody)); await promise; });
  expect(h.result.current.task.taskId).toBe(id(9)); expect(h.result.current.message).toBe('');
});

test('malformed success remains uncertain with original command', async () => {
  api.complete.mockResolvedValue({ task: task({ status: 'completed', completionVersion: 99 }) });
  const h = mount(); await waitFor(() => expect(h.result.current.state).toBe('ready'));
  await act(async () => h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }));
  expect(h.result.current.state).toBe('uncertain'); expect(sessionStorage.length).toBe(1);
});

test('missing protocol versions do not become editable historical version zero', async () => {
  api.getTask.mockResolvedValue({ task: { taskId: id(3), childId: id(2), status: 'pending' } });
  const h = mount(); await waitFor(() => expect(h.result.current.state).toBe('error'));
  await act(async () => h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }));
  expect(api.complete).not.toHaveBeenCalled();
});

test('successful submission followed by failed GET is not a new submission opportunity', async () => {
  api.complete.mockImplementation(async (_id, body) => result(body));
  const h = mount(); await waitFor(() => expect(h.result.current.state).toBe('ready'));
  api.getTask.mockRejectedValue(Error('offline'));
  await act(async () => h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }));
  expect(h.result.current.state).toBe('error'); expect(h.result.current.message).toMatch(/已确认/);
  await act(async () => h.result.current.submit({ completionMediaIds: [], checkedItemIds: [] }));
  expect(api.complete).toHaveBeenCalledTimes(1);
});
