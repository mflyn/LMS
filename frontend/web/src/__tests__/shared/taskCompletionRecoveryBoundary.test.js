import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTaskCompletion } from '../../hooks/useTaskCompletion';
import TaskCompletionEvidence from '../../components/family/TaskCompletionEvidence';
import * as sessions from '../../services/familySession';
import { saveCompletionCommand, loadCompletionCommand } from '../../services/completionCommandStore';

const id = number => String(number).padStart(24, '0');
const operationId = '00000000-0000-4000-8000-000000000001';
const scopeFor = role => ({ actorId: id(role === 'parent' ? 4 : 2), role,
  familyId: id(1), childId: id(2), taskId: id(3) });
const keyFor = (scope, action = 'complete') => 'family-growth.completion-command.v1:'
  + JSON.stringify([scope.actorId, scope.role, scope.familyId, scope.childId, scope.taskId, action]);
const login = scope => {
  if (scope.role === 'parent') sessions.saveParentSession({ token: 'synthetic-parent', user: { id: scope.actorId, role: 'parent' } });
  else sessions.saveChildSession({ token: 'synthetic-child', child: { childId: scope.childId, familyId: scope.familyId, name: 'Synthetic' } });
  return sessions.captureSession(scope.role);
};
const logout = role => (role === 'parent' ? sessions.clearParentSession : sessions.clearChildSession)();
const denied = () => ({ response: { status: 403,
  data: { success: false, error: { code: 'CHILD_ACCESS_DENIED', message: 'Denied', details: [] } } } });
const pendingTask = scope => ({ taskId: scope.taskId, childId: scope.childId, familyId: scope.familyId,
  status: 'pending', completionVersion: 0, checklistVersion: 0, checklistSnapshot: [],
  completionMediaIds: [id(5)], completionMediaReferenceState: 'pending_recovery', childNote: 'Synthetic private note',
  parentFeedback: 'Synthetic private feedback' });
const makeApi = scope => ({ getTask: jest.fn().mockResolvedValue({ task: pendingTask(scope) }),
  discover: jest.fn().mockResolvedValue({ recovery: { state: 'recoverable', operationId, targetCompletionVersion: 1 } }),
  recover: jest.fn(), complete: jest.fn(), confirm: jest.fn() });
const mediaApi = { getPrivateMediaAccess: jest.fn(), uploadPrivateMedia: jest.fn(), deletePrivateMedia: jest.fn() };
let controller;
const Harness = props => {
  controller = useTaskCompletion(props);
  return <TaskCompletionEvidence controller={controller} scopeKey={JSON.stringify([props.scope, props.session.revision])}
    childId={props.scope.childId} mediaApi={mediaApi} />;
};
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); });

test.each(['parent', 'student'])('%s recovery 403 clears private evidence without retiring the original intent', async role => {
  const scope = scopeFor(role), session = login(scope), api = makeApi(scope);
  // A parent may have an unresolved confirmation while discovering another completion.
  if (role === 'parent') saveCompletionCommand({ schemaVersion: 1, scope, action: 'confirm', uncertain: true,
    body: { expectedCompletionVersion: 0, parentFeedback: 'Original confirmation' } });
  const saved = sessionStorage.getItem(keyFor(scope, 'confirm'));
  api.recover.mockRejectedValueOnce(denied());
  render(<Harness {...{ scope, session, api }} />);
  expect(await screen.findByText('Synthetic private note')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: '继续上次提交' }));
  await waitFor(() => expect(controller.state).toBe('awaiting_auth'));
  expect(controller.task).toBeNull();
  expect(screen.queryByText('Synthetic private note')).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic private feedback')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('完成图片 1')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '继续上次提交' })).not.toBeInTheDocument();
  expect(controller.recovery.operationId).toBe(operationId);
  expect(sessionStorage.getItem(keyFor(scope, 'confirm'))).toBe(saved);
  expect(sessions.isSessionCurrent(session)).toBe(true);
  await act(async () => { await controller.recover(); await controller.submit({}); });
  expect(api.recover).toHaveBeenCalledTimes(1);
  expect(api.complete).not.toHaveBeenCalled(); expect(api.confirm).not.toHaveBeenCalled();
  expect(api.getTask).toHaveBeenCalledTimes(1); expect(api.discover).toHaveBeenCalledTimes(1);
});

test.each(['parent', 'student'])('%s late recovery 403 cannot clear the next identity or its private view', async role => {
  const scope = scopeFor(role), session = login(scope), api = makeApi(scope);
  let reject;
  api.recover.mockImplementation(() => new Promise((_resolve, no) => { reject = no; }));
  const view = render(<Harness {...{ scope, session, api }} />);
  await screen.findByRole('button', { name: '继续上次提交' });
  let request; act(() => { request = controller.recover(); });
  const next = { ...scope, actorId: id(8), childId: role === 'student' ? id(8) : scope.childId };
  let nextSession; act(() => { nextSession = login(next); });
  const nextApi = makeApi(next);
  nextApi.getTask.mockResolvedValue({ task: { ...pendingTask(next), completionMediaReferenceState: 'stable',
    status: 'confirmed', childNote: 'New identity evidence' } });
  view.rerender(<Harness scope={next} session={nextSession} api={nextApi} />);
  await screen.findByText('New identity evidence');
  await act(async () => { reject(denied()); await request; });
  expect(controller.state).toBe('ready');
  expect(screen.getByText('New identity evidence')).toBeInTheDocument();
  expect(screen.queryByText('Synthetic private note')).not.toBeInTheDocument();
  expect(sessions.isSessionCurrent(nextSession)).toBe(true);
  expect(nextApi.recover).not.toHaveBeenCalled();
});

const corruptions = ['{broken', JSON.stringify({ body: { childNote: 'private' } }),
  JSON.stringify({ scope: { actorId: id(99), role: 'parent' }, body: { childNote: 'private' } })];
describe.each(['parent', 'student'])('%s damaged command recovery', role => {
  test.each(corruptions)('explicit logout removes damaged scoped entry %s and relogin discovers original operation', async raw => {
    const scope = scopeFor(role), session = login(scope), api = makeApi(scope), key = keyFor(scope);
    sessionStorage.setItem(key, raw);
    const view = render(<Harness {...{ scope, session, api }} />);
    await waitFor(() => expect(controller.state).toBe('blocked'));
    expect(api.getTask).not.toHaveBeenCalled();
    act(() => logout(role));
    expect(sessionStorage.getItem(key)).toBeNull();
    let relogged; act(() => { relogged = login(scope); });
    view.rerender(<Harness scope={scope} session={relogged} api={api} />);
    await screen.findByRole('button', { name: '继续上次提交' });
    expect(api.recover).not.toHaveBeenCalled(); expect(api.complete).not.toHaveBeenCalled();
    expect(loadCompletionCommand(scope)).toBeNull();
    api.recover.mockImplementation(async () => {
      const task = { ...pendingTask(scope), status: 'completed', completionVersion: 1, parentConfirmed: false,
        completedAt: '2026-10-24T01:00:00.000Z', completionMediaReferenceState: 'stable' };
      api.getTask.mockResolvedValue({ task }); return { task };
    });
    fireEvent.click(screen.getByRole('button', { name: '继续上次提交' }));
    await waitFor(() => expect(controller.state).toBe('ready'));
    expect(controller.task.completionVersion).toBe(1);
    expect(api.recover).toHaveBeenCalledTimes(1);
    expect(api.recover).toHaveBeenCalledWith(scope.taskId, operationId, expect.anything(), relogged);
    expect(api.complete).not.toHaveBeenCalled(); expect(loadCompletionCommand(scope)).toBeNull();
  });

  test('expiry preserves damaged commands; switching clears only the canonical old actor keys', () => {
    const scope = scopeFor(role), session = login(scope), own = keyFor(scope);
    const other = keyFor({ ...scope, actorId: id(9), childId: role === 'student' ? id(9) : scope.childId });
    const otherRole = keyFor({ ...scope, role: role === 'parent' ? 'student' : 'parent', childId: scope.actorId });
    sessionStorage.setItem(own, '{broken');
    // A wrong body must not make another actor's canonical key ours.
    const forgedBody = JSON.stringify({ scope, body: { childNote: 'Synthetic' } });
    sessionStorage.setItem(other, forgedBody); sessionStorage.setItem(otherRole, forgedBody);
    sessionStorage.setItem('unrelated', 'keep');
    (role === 'parent' ? sessions.expireParentSession : sessions.expireChildSession)(session);
    expect(sessionStorage.getItem(own)).toBe('{broken');
    login({ ...scope, actorId: id(8), childId: role === 'student' ? id(8) : scope.childId });
    expect(sessionStorage.getItem(own)).toBeNull();
    expect(sessionStorage.getItem(other)).toBe(forgedBody);
    expect(sessionStorage.getItem(otherRole)).toBe(forgedBody);
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
  });

  test('a suspended tab clears damaged entries once when consuming an explicit exit marker', () => {
    const scope = scopeFor(role), key = keyFor(scope);
    login(scope); logout(role); login(scope);
    sessionStorage.setItem(key, '{broken');
    sessionStorage.removeItem(`family-growth.session-exit-seen.v1:${role}:${scope.actorId}`);
    window.dispatchEvent(new Event('pageshow'));
    expect(sessionStorage.getItem(key)).toBeNull();
    sessionStorage.setItem(key, 'new draft');
    window.dispatchEvent(new Event('pageshow'));
    expect(sessionStorage.getItem(key)).toBe('new draft');
  });
});
