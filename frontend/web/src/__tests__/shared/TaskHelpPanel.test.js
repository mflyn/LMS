import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskHelpPanel from '../../components/family/TaskHelpPanel';
import * as childApi from '../../services/childApi';
import * as familyApi from '../../services/familyApi';
import { saveChildSession, saveParentSession, clearChildSession } from '../../services/familySession';

jest.mock('../../services/childApi');
jest.mock('../../services/familyApi');
const id = n => String(n).padStart(24, '0');
const task = (extra = {}) => ({ taskId: id(3), familyId: id(4), childId: id(2), title: '合成求助任务',
  status: 'pending', helpVersion: 0, helpRequest: null, ...extra });
const help = { status: 'pending', helpType: 'stuck_midway', note: '卡在第二步',
  requestedByActor: { id: id(2), role: 'student' }, requestedAt: '2026-10-25T01:00:00Z' };
const pending = (version = 1) => task({ helpVersion: version, helpRequest: help });
const resolved = () => task({ helpVersion: 2, helpRequest: { ...help, status: 'resolved', parentResponse: '先画图',
  resolvedByActor: { id: id(1), role: 'parent' }, resolvedAt: '2026-10-25T02:00:00Z' } });
const failure = status => Object.assign(Error('synthetic failure'), { response: { status, data: { error: { code: status === 409 ? 'VERSION_CONFLICT' : 'DENIED' } } } });
const childLogin = (n = 2) => saveChildSession({ token: `synthetic-${n}`, child: { childId: id(n), familyId: id(4), name: '合成孩子' } });
const show = props => render(<TaskHelpPanel role="student" taskId={id(3)} familyId={id(4)} childId={id(2)} {...props} />);
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); childLogin();
  saveParentSession({ token: 'synthetic-parent', user: { id: id(1), name: '合成家长', role: 'parent' } });
  childApi.getOwnTask.mockResolvedValue({ task: task() }); familyApi.getGrowthTask.mockResolvedValue({ task: pending() });
});

test('child requests independently and can read a response then request again', async () => {
  const user = userEvent.setup(); childApi.updateOwnTaskHelp.mockResolvedValue({ task: pending() });
  const view = show(); await user.click(await screen.findByRole('button', { name: '我需要帮助' }));
  await user.selectOptions(screen.getByLabelText('哪里需要帮助'), 'stuck_midway');
  await user.type(screen.getByLabelText('补充说明（可不填）'), ' 卡在第二步 ');
  await user.click(screen.getByRole('button', { name: '发送求助' }));
  await screen.findByText('等待家长帮助');
  expect(childApi.updateOwnTaskHelp.mock.calls[0][1]).toEqual({ action: 'request', expectedHelpVersion: 0, helpType: 'stuck_midway', note: '卡在第二步' });
  expect(childApi.completeOwnTask).not.toHaveBeenCalled();
  view.unmount(); childApi.getOwnTask.mockResolvedValue({ task: resolved() }); show();
  await screen.findByText('先画图'); expect(screen.getByRole('button', { name: '再次求助' })).toBeEnabled();
});

test('parent resolves the viewed help version without confirming or awarding', async () => {
  const user = userEvent.setup(); familyApi.updateTaskHelp.mockResolvedValue({ task: resolved() }); show({ role: 'parent' });
  await screen.findByText('卡在第二步'); await user.type(screen.getByLabelText('给孩子的回应（可不填）'), '先画图');
  await user.click(screen.getByRole('button', { name: '标记已处理' })); await screen.findByText('先画图');
  expect(familyApi.updateTaskHelp.mock.calls[0][1]).toEqual({ action: 'resolve', expectedHelpVersion: 1, parentResponse: '先画图' });
  expect(familyApi.confirmGrowthTask).not.toHaveBeenCalled();
});

test('child can replace a pending question with a new difficulty at the viewed version', async () => {
  const user = userEvent.setup(); childApi.getOwnTask.mockResolvedValue({ task: pending() });
  childApi.updateOwnTaskHelp.mockResolvedValue({ task: task({ helpVersion: 2,
    helpRequest: { ...help, helpType: 'uncertain_result', note: '现在不确定答案' } }) });
  show(); await user.click(await screen.findByRole('button', { name: '更新求助', exact: true }));
  await user.selectOptions(screen.getByLabelText('哪里需要帮助'), 'uncertain_result');
  await user.type(screen.getByLabelText('补充说明（可不填）'), '现在不确定答案');
  await user.click(screen.getByRole('button', { name: '发送求助' }));
  await screen.findByText('现在不确定答案');
  expect(childApi.updateOwnTaskHelp.mock.calls[0][1]).toEqual({ action: 'request', expectedHelpVersion: 1,
    helpType: 'uncertain_result', note: '现在不确定答案' });
});

test('resolve conflict reads the new request without automatically resolving or retaining old response', async () => {
  const user = userEvent.setup(); familyApi.updateTaskHelp.mockImplementation(async () => {
    familyApi.getGrowthTask.mockResolvedValue({ task: pending(3) }); throw failure(409);
  }); show({ role: 'parent' }); await screen.findByText('卡在第二步');
  await user.type(screen.getByLabelText('给孩子的回应（可不填）'), '旧回应');
  await user.click(screen.getByRole('button', { name: '标记已处理' }));
  await screen.findByText(/状态已变化/); await waitFor(() => expect(screen.getByLabelText('给孩子的回应（可不填）')).toHaveValue(''));
  expect(familyApi.updateTaskHelp).toHaveBeenCalledTimes(1);
});

test('unknown response retains exact request and prevents double click or editing until explicit retry', async () => {
  const user = userEvent.setup(); let fail;
  childApi.updateOwnTaskHelp.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject; }))
    .mockResolvedValue({ task: pending() }); show();
  await user.click(await screen.findByRole('button', { name: '我需要帮助' }));
  await user.dblClick(screen.getByRole('button', { name: '发送求助' }));
  expect(childApi.updateOwnTaskHelp).toHaveBeenCalledTimes(1);
  await act(async () => fail(Error('lost response')));
  await user.click(await screen.findByRole('button', { name: '重试原求助操作' }));
  await screen.findByText('等待家长帮助');
  expect(childApi.updateOwnTaskHelp.mock.calls[1][1]).toEqual(childApi.updateOwnTaskHelp.mock.calls[0][1]);
});

test.each(['success', 'lost'])('write takes ownership from a slow initial read: %s and late read', async outcome => {
  const user = userEvent.setup(); let finishRead, finishWrite;
  childApi.getOwnTask.mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
  childApi.updateOwnTaskHelp.mockImplementationOnce(() => new Promise((resolve, reject) => {
    finishWrite = () => outcome === 'success' ? resolve({ task: pending() }) : reject(Error('Synthetic lost response'));
  })).mockResolvedValue({ task: pending() });
  const view = show();
  await waitFor(() => expect(childApi.getOwnTask).toHaveBeenCalledTimes(1));
  view.rerender(<TaskHelpPanel role="student" taskId={id(3)} familyId={id(4)} childId={id(2)} taskSnapshot={{ task: task() }} />);
  await user.click(await screen.findByRole('button', { name: '我需要帮助', exact: true }));
  await user.type(screen.getByLabelText('补充说明（可不填）'), '原求助正文');
  await user.dblClick(screen.getByRole('button', { name: '发送求助' }));
  const original = childApi.updateOwnTaskHelp.mock.calls[0][1];
  expect(childApi.updateOwnTaskHelp).toHaveBeenCalledTimes(1);
  expect(childApi.getOwnTask.mock.calls[0][1].aborted).toBe(true);
  expect(screen.getByRole('button', { name: '重试原求助操作' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '读取最新求助' })).toBeDisabled();
  // Even a transport ignoring abort must not finish the write or restore stale help.
  await act(async () => finishRead({ task: pending(99) }));
  expect(screen.getByRole('button', { name: '重试原求助操作' })).toBeDisabled();
  await act(async () => finishWrite());
  expect(screen.queryByText('正在读取求助…')).not.toBeInTheDocument();
  if (outcome === 'lost') {
    expect(screen.getByRole('button', { name: '重试原求助操作' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '读取最新求助' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '重试原求助操作' }));
    await screen.findByText('求助已发送。');
    expect(childApi.updateOwnTaskHelp).toHaveBeenCalledTimes(2);
    expect(childApi.updateOwnTaskHelp.mock.calls[1][1]).toBe(original);
  } else expect(childApi.updateOwnTaskHelp).toHaveBeenCalledTimes(1);
  // A subsequent edit still starts from the published version, not the late version 99.
  await user.click(screen.getByRole('button', { name: '更新求助', exact: true }));
  await user.click(screen.getByRole('button', { name: '发送求助' }));
  expect(childApi.updateOwnTaskHelp.mock.calls.at(-1)[1].expectedHelpVersion).toBe(1);
  expect(childApi.completeOwnTask).not.toHaveBeenCalled();
});

test('slow initial read without a snapshot remains loading until its own response', async () => {
  let finish;
  childApi.getOwnTask.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  show(); expect(screen.getByText('正在读取求助…')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '我需要帮助', exact: true })).not.toBeInTheDocument();
  await act(async () => finish({ task: task() }));
  expect(screen.queryByText('正在读取求助…')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '我需要帮助', exact: true })).toBeEnabled();
});

test.each([401, 403])('authorization failure %s removes private content and controls', async status => {
  const user = userEvent.setup(); familyApi.updateTaskHelp.mockRejectedValue(failure(status)); show({ role: 'parent' });
  await screen.findByText('卡在第二步'); await user.click(screen.getByRole('button', { name: '标记已处理' }));
  await screen.findByRole('alert'); expect(screen.queryByText('卡在第二步')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '标记已处理' })).not.toBeInTheDocument();
});

test('logout and late request success cannot restore private help', async () => {
  const user = userEvent.setup(); let finish; childApi.updateOwnTaskHelp.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  show(); await user.click(await screen.findByRole('button', { name: '我需要帮助' }));
  await user.click(screen.getByRole('button', { name: '发送求助' }));
  act(() => clearChildSession()); await act(async () => finish({ task: pending() }));
  expect(screen.queryByText('卡在第二步')).not.toBeInTheDocument(); expect(screen.queryByText('等待家长帮助')).not.toBeInTheDocument();
});

test('child scope replacement ignores late detail and does not display old note', async () => {
  let finish; childApi.getOwnTask.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue({ task: task({ childId: id(5) }) });
  const view = show(); act(() => childLogin(5));
  view.rerender(<TaskHelpPanel role="student" taskId={id(3)} familyId={id(4)} childId={id(5)} />);
  await screen.findByRole('button', { name: '我需要帮助' }); await act(async () => finish({ task: pending() }));
  expect(screen.queryByText('卡在第二步')).not.toBeInTheDocument();
});

test.each(['completed', 'confirmed', 'cancelled', 'archived'])('%s child cannot create a new request', async status => {
  childApi.getOwnTask.mockResolvedValue({ task: task({ status, helpRequest: resolved().helpRequest, helpVersion: 2 }) });
  show(); await screen.findByText('先画图'); expect(screen.queryByRole('button', { name: /求助/ })).not.toBeInTheDocument();
});

test.each(['completed', 'confirmed'])('parent can resolve a pending help on %s', async status => {
  familyApi.getGrowthTask.mockResolvedValue({ task: { ...pending(), status } }); show({ role: 'parent' });
  expect(await screen.findByRole('button', { name: '标记已处理' })).toBeEnabled();
});

test('rejects mismatched detail instead of displaying private text', async () => {
  childApi.getOwnTask.mockResolvedValue({ task: { ...pending(), childId: id(9) } }); show();
  await screen.findByRole('alert'); expect(screen.queryByText('卡在第二步')).not.toBeInTheDocument();
});

test('a successful explicit reread clears a previous transport error', async () => {
  const user = userEvent.setup(); childApi.getOwnTask.mockRejectedValueOnce(Error('offline')).mockResolvedValue({ task: task() });
  show(); await screen.findByRole('alert'); await user.click(screen.getByRole('button', { name: '重试读取' }));
  await screen.findByRole('button', { name: '我需要帮助', exact: true });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('normalizes text and counts unicode code points rather than UTF16 units', async () => {
  const user = userEvent.setup(); childApi.updateOwnTaskHelp.mockResolvedValue({ task: pending() }); show();
  await user.click(await screen.findByRole('button', { name: '我需要帮助' }));
  await user.type(screen.getByLabelText('补充说明（可不填）'), '😀'.repeat(201));
  await user.click(screen.getByRole('button', { name: '发送求助' })); expect(childApi.updateOwnTaskHelp).not.toHaveBeenCalled();
  await screen.findByText(/最多 200 字/); await user.clear(screen.getByLabelText('补充说明（可不填）'));
  await user.type(screen.getByLabelText('补充说明（可不填）'), '😀'.repeat(200));
  await user.click(screen.getByRole('button', { name: '发送求助' })); await screen.findByText('等待家长帮助');
  expect(childApi.updateOwnTaskHelp.mock.calls[0][1].note).toBe('😀'.repeat(200));
});
