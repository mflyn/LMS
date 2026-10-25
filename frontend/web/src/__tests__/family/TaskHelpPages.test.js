import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TasksPage from '../../pages/family/TasksPage';
import * as api from '../../services/familyApi';
import { saveParentSession } from '../../services/familySession';
import { loadCompletionCommand, saveCompletionCommand } from '../../services/completionCommandStore';

jest.mock('../../services/familyApi');
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => ({ family: { familyId: 'family' },
  selectedChildId: 'child', selectedChild: { childId: 'child', name: '合成孩子' }, childScopeVersion: 1 }) }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'parent' } }) }));
const task = { taskId: 'task', familyId: 'family', childId: 'child', title: '上周的任务', area: '合成活动',
  dimension: 'academic', status: 'completed', dueDate: '2026-01-01', helpVersion: 1,
  helpRequest: { status: 'pending', helpType: 'cannot_start', note: '不知道先做什么' } };
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveParentSession({ token: 'synthetic', user: { id: 'parent', name: '合成家长', role: 'parent' } });
  api.listGrowthTasks.mockResolvedValue({ items: [task], total: 21, page: 1, pageSize: 20 });
  api.getGrowthTask.mockResolvedValue({ task }); api.listCompletionRecoveries.mockResolvedValue({ items: [] });
});
const show = (url = '/app/tasks') => render(<MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TasksPage /></MemoryRouter>);

test.each([401, 403])('parent list %s after a successful reply clears the private help dialog', async status => {
  const user = userEvent.setup(); show();
  await user.click(await screen.findByRole('button', { name: `求助 ${task.title}` }));
  await screen.findByText(task.helpRequest.note);
  api.updateTaskHelp.mockResolvedValue({ task: { ...task, helpVersion: 2,
    helpRequest: { ...task.helpRequest, status: 'resolved', parentResponse: '私有回应' } } });
  api.listGrowthTasks.mockRejectedValueOnce({ response: { status } });
  await user.type(screen.getByLabelText('给孩子的回应（可不填）'), '私有回应');
  await user.click(screen.getByRole('button', { name: '标记已处理' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: '任务求助' })).not.toBeInTheDocument());
  expect(screen.queryByText(task.helpRequest.note)).not.toBeInTheDocument();
  expect(screen.queryByText('私有回应')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test.each(['read', 'write'])('list denial unmounts help and ignores a late %s without clearing persisted T2 commands', async kind => {
  const user = userEvent.setup(); show();
  await user.click(await screen.findByRole('button', { name: `求助 ${task.title}` }));
  await screen.findByText(task.helpRequest.note);
  const commandScope = { role: 'parent', actorId: '000000000000000000000001', familyId: '000000000000000000000002',
    childId: '000000000000000000000003', taskId: '000000000000000000000004' };
  const originalCompletion = saveCompletionCommand({ schemaVersion: 1, scope: commandScope, action: 'complete', uncertain: true,
    body: { operationId: '00000000-0000-4000-8000-000000000001', expectedCompletionVersion: 0,
      expectedChecklistVersion: 0, completionMediaIds: [], checkedItemIds: [] } });
  const originalConfirmation = saveCompletionCommand({ schemaVersion: 1, scope: { ...commandScope, taskId: '000000000000000000000005' },
    action: 'confirm', uncertain: true, body: { expectedCompletionVersion: 1, parentFeedback: 'synthetic retained feedback' } });
  const saved = { ...sessionStorage }; let finish;
  const held = new Promise(resolve => { finish = resolve; });
  api.updateTaskHelp.mockImplementationOnce(() => kind === 'write' ? held : Promise.reject(Error('lost')));
  await user.click(screen.getByRole('button', { name: '标记已处理' }));
  let signal = api.updateTaskHelp.mock.calls[0][2];
  if (kind === 'read') {
    api.getGrowthTask.mockImplementationOnce(() => held);
    await user.click(screen.getByRole('button', { name: '读取最新求助' }));
    signal = api.getGrowthTask.mock.calls.at(-1)[1];
  }
  api.listGrowthTasks.mockRejectedValueOnce({ response: { status: 403 } });
  // Exercise the list resource independently while the modal's own request is in flight.
  fireEvent.change(screen.getByLabelText('求助状态'), { target: { value: 'pending' } });
  await waitFor(() => expect(screen.queryByRole('region', { name: '任务求助' })).not.toBeInTheDocument());
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ task: { ...task, helpVersion: 2,
    helpRequest: { ...task.helpRequest, status: 'resolved', parentResponse: '迟到私有回应' } } }));
  expect(screen.queryByText(task.helpRequest.note)).not.toBeInTheDocument();
  expect(screen.queryByText('迟到私有回应')).not.toBeInTheDocument();
  expect({ ...sessionStorage }).toEqual(saved);
  expect(loadCompletionCommand(commandScope)).toEqual(originalCompletion);
  expect(loadCompletionCommand(originalConfirmation.scope, 'confirm')).toEqual(originalConfirmation);
  // Clearing the list's error on a later reload must not resurrect the old modal.
  fireEvent.change(screen.getByLabelText('求助状态'), { target: { value: 'resolved' } });
  await screen.findByText(task.title);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.updateTaskHelp).toHaveBeenCalledTimes(1);
});

test.each(['success', 'network', '503'])('list refresh %s retains an unknown original help reply', async outcome => {
  const user = userEvent.setup(); show();
  await user.click(await screen.findByRole('button', { name: `求助 ${task.title}` }));
  await screen.findByText(task.helpRequest.note);
  api.updateTaskHelp.mockRejectedValueOnce(Error('lost')).mockResolvedValue({ task: { ...task, helpVersion: 2,
    helpRequest: { ...task.helpRequest, status: 'resolved', parentResponse: '原回应' } } });
  await user.type(screen.getByLabelText('给孩子的回应（可不填）'), '原回应');
  await user.click(screen.getByRole('button', { name: '标记已处理' }));
  const original = api.updateTaskHelp.mock.calls[0][1]; let finish;
  api.listGrowthTasks.mockImplementationOnce(() => new Promise((resolve, reject) => {
    finish = () => outcome === 'success' ? resolve({ items: [task], total: 1 })
      : reject(outcome === 'network' ? Error('offline') : { response: { status: 503 } });
  }));
  fireEvent.change(screen.getByLabelText('求助状态'), { target: { value: 'pending' } });
  await waitFor(() => expect(finish).toBeDefined());
  expect(screen.getByRole('button', { name: '重试原求助操作' })).toBeEnabled();
  await act(async () => finish());
  expect(screen.getByRole('button', { name: '重试原求助操作' })).toBeEnabled();
  expect(api.updateTaskHelp).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: '重试原求助操作' }));
  await screen.findByText('原回应');
  expect(api.updateTaskHelp.mock.calls[1][1]).toBe(original);
  expect(original).toEqual({ action: 'resolve', expectedHelpVersion: 1, parentResponse: '原回应' });
});

test('pending-help entry includes old completed tasks and paginates without narrowing to today', async () => {
  const user = userEvent.setup(); show('/app/tasks?helpStatus=pending');
  await screen.findByText('上周的任务');
  expect(api.listGrowthTasks).toHaveBeenLastCalledWith(expect.objectContaining({ childId: 'child', helpStatus: 'pending', scope: '', status: '', page: 1, pageSize: 20 }), expect.any(AbortSignal));
  await user.click(screen.getByRole('button', { name: '下一页任务' }));
  await waitFor(() => expect(api.listGrowthTasks).toHaveBeenLastCalledWith(expect.objectContaining({ helpStatus: 'pending', page: 2 }), expect.any(AbortSignal)));
  await user.selectOptions(screen.getByLabelText('求助状态'), 'resolved');
  await waitFor(() => expect(api.listGrowthTasks).toHaveBeenLastCalledWith(expect.objectContaining({ helpStatus: 'resolved', page: 1 }), expect.any(AbortSignal)));
});

test('selecting help filter clears earlier date/status constraints and opens actual task help', async () => {
  const user = userEvent.setup(); show(); await screen.findByText('上周的任务');
  await user.selectOptions(screen.getByLabelText('时间范围'), 'today');
  await user.selectOptions(screen.getByLabelText('任务状态'), 'pending');
  await user.selectOptions(screen.getByLabelText('求助状态'), 'pending');
  await waitFor(() => expect(api.listGrowthTasks).toHaveBeenLastCalledWith(expect.objectContaining({ scope: '', status: '', helpStatus: 'pending' }), expect.any(AbortSignal)));
  await user.click(screen.getByRole('button', { name: '求助 上周的任务' }));
  const dialog = screen.getByRole('dialog', { name: '合成孩子的求助' });
  await within(dialog).findByText('不知道先做什么');
  const next = { ...task, helpVersion: 2, helpRequest: { ...task.helpRequest, status: 'resolved', parentResponse: '先读第一行' } };
  api.updateTaskHelp.mockResolvedValue({ task: next });
  api.listGrowthTasks.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  await user.type(within(dialog).getByLabelText('给孩子的回应（可不填）'), '先读第一行');
  await user.click(within(dialog).getByRole('button', { name: '标记已处理' }));
  await within(dialog).findByText('先读第一行');
  await screen.findByText('暂无成长任务');
  expect(api.confirmGrowthTask).not.toHaveBeenCalled();
});

test.each(['pending', 'completed'])('cancel/archive %s removes excluded help and returns from an empty last page', async status => {
  const user = userEvent.setup(), item = { ...task, status };
  api.listGrowthTasks.mockResolvedValue({ items: [item], total: 21, page: 1, pageSize: 20 });
  show('/app/tasks?helpStatus=pending'); await screen.findByText(task.title);
  await user.click(screen.getByRole('button', { name: '下一页任务' }));
  await waitFor(() => expect(api.listGrowthTasks).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal)));
  const action = status === 'pending' ? '取消' : '归档';
  await user.click(screen.getByRole('button', { name: `${action} ${task.title}` }));
  api.cancelOrArchiveGrowthTask.mockResolvedValue({ task: { ...item, status: status === 'pending' ? 'cancelled' : 'archived' } });
  api.listGrowthTasks.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 20 });
  await user.click(screen.getByRole('button', { name: `确认${action}` }));
  await screen.findByText('暂无成长任务'); expect(screen.queryByText(task.title)).not.toBeInTheDocument();
  await waitFor(() => expect(api.listGrowthTasks).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, helpStatus: 'pending' }), expect.any(AbortSignal)));
  expect(screen.getByText('第 1 页 · 共 0 项')).toBeInTheDocument();
});
