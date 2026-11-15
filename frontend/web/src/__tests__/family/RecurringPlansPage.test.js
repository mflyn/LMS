import React from 'react';
import { webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RecurringPlansPage from '../../pages/family/RecurringPlansPage';
import * as api from '../../services/familyApi';
import { useFamily } from '../../contexts/FamilyContext';
import { captureSession, saveParentSession, clearParentSession } from '../../services/familySession';
import { prepareRecurringCommand, settleRecurringCommand } from '../../services/recurringCommands';
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: jest.fn() }));
jest.mock('../../services/familyApi', () => ({ listRecurringPlans: jest.fn(), getRecurringPlan: jest.fn(),
  getRecurringCommand: jest.fn(), sendRecurringCommand: jest.fn(), abortRecurringCommand: jest.fn() }));
const scope = { familyId: '111111111111111111111111', childId: '222222222222222222222222' };
const actor = '333333333333333333333333';
const family = () => ({ family: { familyId: scope.familyId, timezone: 'Asia/Shanghai' }, selectedChildId: scope.childId,
  selectedChild: { childId: scope.childId, name: '合成孩子' }, childScopeVersion: 0 });
const login = (id = actor) => saveParentSession({ token: 'synthetic', user: { id, role: 'parent' } });
const body = () => ({ operationId: '11111111-1111-4111-8111-111111111111', childId: scope.childId, startDate: '2026-11-16',
  endDate: null, schedule: { kind: 'daily' }, template: { title: '私有旧任务', taskType: 'exercise', dimension: 'physical' } });
const plan = () => ({ id: '555555555555555555555555', childId: scope.childId, timezone: 'Asia/Shanghai', status: 'active',
  startDate: '2026-11-16', version: 1, currentRevision: { template: body().template, schedule: { kind: 'daily' }, endDate: null },
  generationHealth: { lastEvaluatedDate: null, skippedOccurrenceCount: 0 } });
const mount = () => render(<MemoryRouter><RecurringPlansPage /></MemoryRouter>);
const enabled = async name => waitFor(() => expect(screen.getByRole('button', { name })).toBeEnabled());
const failed = status => ({ response: { status, data: { error: { code: status === 403 ? 'CHILD_ACCESS_DENIED' : 'RECURRING_PLAN_WRITE_UNKNOWN' } } } });
beforeAll(() => { Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle }); globalThis.TextEncoder = TextEncoder; });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.resetAllMocks(); login(); useFamily.mockReturnValue(family());
  api.listRecurringPlans.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
  api.getRecurringCommand.mockResolvedValue({ state: 'not_found' }); });

test('creates a weekday plan, preserves unknown command and retries exact ID/body, never another POST on refresh', async () => {
  api.sendRecurringCommand.mockRejectedValue(failed(503)); mount();
  await waitFor(() => expect(screen.getByRole('button', { name: '新建重复计划' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '新建重复计划' }));
  fireEvent.change(screen.getByLabelText('计划名称'), { target: { value: '每天跳绳' } });
  await waitFor(() => expect(screen.getByRole('button', { name: '保存计划' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '保存计划' }));
  await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1));
  const command = api.sendRecurringCommand.mock.calls[0][0];
  expect(command.body.schedule).toEqual({ kind: 'weekly', weekdays: [1, 2, 3, 4, 5] });
  await waitFor(() => expect(screen.getByRole('button', { name: /重新加载计划/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /重新加载计划/ }));
  await waitFor(() => expect(api.listRecurringPlans).toHaveBeenCalledTimes(2));
  expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '重试原命令' }));
  await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(2));
  expect(api.sendRecurringCommand.mock.calls[1][0]).toEqual(command);
});

test('same actor relogin discovers marker without private body; not_found stays locked, explicit abort clears matching terminal', async () => {
  const command = await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent'));
  clearParentSession(); login();
  api.abortRecurringCommand.mockImplementation(async marker => ({ state: 'aborted',
    identity: Object.fromEntries(Object.entries(marker).filter(([k]) => k !== 'schemaVersion')), command: null, result: null,
    settledAt: '2026-11-16T04:00:00Z' }));
  mount(); await screen.findByText('有一项计划操作待核对');
  expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重试原命令' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '核对原命令' }));
  await waitFor(() => expect(api.getRecurringCommand).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
  await waitFor(() => expect(screen.getByRole('button', { name: '终止未确定命令' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '终止未确定命令' }));
  fireEvent.click(screen.getByRole('button', { name: '确认终止' }));
  await waitFor(() => expect(api.abortRecurringCommand).toHaveBeenCalledWith(command.marker, expect.anything()));
  await waitFor(() => expect(screen.queryByText('有一项计划操作待核对')).not.toBeInTheDocument());
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
});

test('abort confirmation cannot silently retarget a replacement command from another tab', async () => {
  const s = captureSession('parent'), first = await prepareRecurringCommand(scope, 'create', null, body(), s);
  mount(); await screen.findByText('有一项计划操作待核对');
  fireEvent.click(screen.getByRole('button', { name: '终止未确定命令' }));
  await act(async () => {
    await settleRecurringCommand(scope, first.marker, { state: 'aborted',
      identity: Object.fromEntries(Object.entries(first.marker).filter(([k]) => k !== 'schemaVersion')),
      command: null, result: null, settledAt: '2026-11-16T04:00:00Z' }, s);
    await prepareRecurringCommand(scope, 'create', null, { ...body(), operationId: '22222222-2222-4222-8222-222222222222' }, s);
  });
  fireEvent.click(screen.getByRole('button', { name: '确认终止' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '确认终止' })).toBeEnabled());
  expect(api.abortRecurringCommand).not.toHaveBeenCalled();
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toHaveLength(1);
});

test('403 clears private plan and draft; an earlier late success cannot restore them', async () => {
  api.listRecurringPlans.mockResolvedValueOnce({ items: [plan()], total: 1 }); mount();
  await screen.findByText('私有旧任务');
  fireEvent.click(screen.getByRole('button', { name: '新建重复计划' })); await enabled('保存计划');
  fireEvent.change(screen.getByLabelText('计划名称'), { target: { value: '未提交的私有草稿' } }); let late;
  api.listRecurringPlans.mockImplementationOnce(() => new Promise(resolve => { late = resolve; })).mockRejectedValueOnce(failed(403));
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(api.listRecurringPlans).toHaveBeenCalledTimes(2));
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument());
  expect(screen.queryByDisplayValue('未提交的私有草稿')).not.toBeInTheDocument();
  await act(async () => late({ items: [plan()], total: 1 }));
  expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument(); expect(api.sendRecurringCommand).not.toHaveBeenCalled();
});

test('account switch and late command success cannot clear original actor marker', async () => {
  const original = await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent')); let late;
  api.getRecurringCommand.mockImplementationOnce(() => new Promise(resolve => { late = resolve; }));
  mount(); await screen.findByText('有一项计划操作待核对'); fireEvent.click(screen.getByRole('button', { name: '核对原命令' }));
  act(() => login('444444444444444444444444'));
  await act(async () => late({ state: 'aborted', identity: Object.fromEntries(Object.entries(original.marker).filter(([k]) => k !== 'schemaVersion')),
    command: null, result: null, settledAt: '2026-11-16T04:00:00Z' }));
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toHaveLength(1);
  expect(screen.queryByText('有一项计划操作待核对')).not.toBeInTheDocument();
});

test('editing fetches the viewed version; version conflict keeps exact original command and does not auto overwrite', async () => {
  api.listRecurringPlans.mockResolvedValue({ items: [plan()], total: 1 });
  api.getRecurringPlan.mockResolvedValue({ ...plan(), version: 4 });
  api.sendRecurringCommand.mockRejectedValue({ response: { status: 409, data: { error: { code: 'RECURRING_PLAN_VERSION_CONFLICT' } } } });
  mount(); await screen.findByText('私有旧任务'); fireEvent.click(screen.getByRole('button', { name: '修改计划' }));
  await screen.findByLabelText('计划名称'); await enabled('保存计划');
  expect(screen.getByLabelText('开始日期')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('计划名称'), { target: { value: '新规则' } }); fireEvent.click(screen.getByRole('button', { name: '保存计划' }));
  await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1));
  expect(api.sendRecurringCommand.mock.calls[0][0]).toMatchObject({ marker: { action: 'patch', targetPlanId: plan().id }, body: { expectedVersion: 4 } });
  await enabled('重试原命令'); expect(screen.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
  expect(api.getRecurringPlan).toHaveBeenCalledTimes(1);
});

test('stop requires confirmation and preserves seen version', async () => {
  api.listRecurringPlans.mockResolvedValue({ items: [plan()], total: 1 }); api.sendRecurringCommand.mockRejectedValue(failed(503));
  mount(); await screen.findByText('私有旧任务'); fireEvent.click(screen.getByRole('button', { name: '停止计划' }));
  expect(api.sendRecurringCommand).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: '确认停止' }));
  await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1));
  expect(api.sendRecurringCommand.mock.calls[0][0]).toMatchObject({ marker: { action: 'stop', targetPlanId: plan().id }, body: { expectedVersion: 1 } });
});

test('stopped row and its scheduled rule are readonly and never advertised as generating tomorrow', async () => {
  api.listRecurringPlans.mockResolvedValue({ items: [{ ...plan(), status: 'stopped', pendingRevision: {
    effectiveFrom: '2099-01-01', template: { title: '停止前的安排' }
  } }], total: 1 });
  mount(); await screen.findByText('私有旧任务');
  expect(screen.getByRole('button', { name: '修改计划' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '停止计划' })).toBeDisabled();
  expect(screen.getByText('停止前设置的规则（不再生成）：停止前的安排')).toBeInTheDocument();
  expect(screen.queryByText(/新规则于/)).not.toBeInTheDocument();
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
});

test('successful historical terminal does not overwrite current plan fetched after settlement', async () => {
  const original = await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent'));
  api.listRecurringPlans.mockResolvedValue({ items: [{ ...plan(), currentRevision: { ...plan().currentRevision, template: { ...body().template, title: '当前计划' } } }], total: 1 });
  api.getRecurringCommand.mockResolvedValue({ state: 'succeeded', identity: Object.fromEntries(Object.entries(original.marker).filter(([k]) => k !== 'schemaVersion')),
    command: original.body, result: { httpStatus: 201, data: { operationId: original.marker.operationId, plan: plan() } }, settledAt: '2026-11-16T04:00:00Z' });
  mount(); await screen.findByText('有一项计划操作待核对'); fireEvent.click(screen.getByRole('button', { name: '核对原命令' }));
  await waitFor(() => expect(screen.queryByText('有一项计划操作待核对')).not.toBeInTheDocument());
  expect(screen.getByText('当前计划')).toBeInTheDocument(); expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument();
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
});

test('403 during recovery clears private view but preserves marker, even after a late earlier list success', async () => {
  await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent'));
  api.listRecurringPlans.mockResolvedValueOnce({ items: [plan()], total: 1 }); let finish;
  api.listRecurringPlans.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  api.getRecurringCommand.mockRejectedValue(failed(403)); mount(); await screen.findByText('私有旧任务');
  act(() => window.dispatchEvent(new Event('focus'))); await waitFor(() => expect(api.listRecurringPlans).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: '核对原命令' }));
  await waitFor(() => expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument());
  await act(async () => finish({ items: [plan()], total: 1 }));
  expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument();
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toHaveLength(1);
});

test('switching child during original command query retains marker and rejects late result', async () => {
  const original = await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent')); let finish;
  api.getRecurringCommand.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); await screen.findByText('有一项计划操作待核对'); fireEvent.click(screen.getByRole('button', { name: '核对原命令' }));
  useFamily.mockReturnValue({ ...family(), selectedChildId: '666666666666666666666666', childScopeVersion: 1, selectedChild: { name: '另一个孩子' } });
  view.rerender(<MemoryRouter><RecurringPlansPage /></MemoryRouter>);
  await act(async () => finish({ state: 'aborted', identity: Object.fromEntries(Object.entries(original.marker).filter(([k]) => k !== 'schemaVersion')),
    command: null, result: null, settledAt: '2026-11-16T04:00:00Z' }));
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toHaveLength(1);
  expect(screen.queryByText('有一项计划操作待核对')).not.toBeInTheDocument();
});

test('submitted form closes but unresolved POST remains locked; child switch denies its late success and followup GET', async () => {
  let finish; api.sendRecurringCommand.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); await enabled('新建重复计划'); fireEvent.click(screen.getByRole('button', { name: '新建重复计划' }));
  await enabled('保存计划'); fireEvent.change(screen.getByLabelText('计划名称'), { target: { value: '在途的私有草稿' } });
  fireEvent.click(screen.getByRole('button', { name: '保存计划' }));
  await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1));
  expect(screen.queryByLabelText('计划名称')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
  const keys = Object.keys(localStorage).filter(k => k.includes('recurring-marker'));
  useFamily.mockReturnValue({ ...family(), selectedChildId: '666666666666666666666666', childScopeVersion: 1, selectedChild: { name: '另一个孩子' } });
  view.rerender(<MemoryRouter><RecurringPlansPage /></MemoryRouter>);
  await act(async () => finish({ plan: plan() }));
  expect(api.getRecurringCommand).not.toHaveBeenCalled();
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toEqual(keys);
  expect(screen.queryByText('在途的私有草稿')).not.toBeInTheDocument();
});

test('partial numeric entry rejects before marker or POST while normal focus refresh preserves form', async () => {
  mount(); await enabled('新建重复计划'); fireEvent.click(screen.getByRole('button', { name: '新建重复计划' })); await enabled('保存计划');
  fireEvent.change(screen.getByLabelText('计划名称'), { target: { value: '跳绳' } });
  fireEvent.change(screen.getByLabelText('预计分钟'), { target: { value: '1.' } });
  act(() => window.dispatchEvent(new Event('focus'))); await waitFor(() => expect(api.listRecurringPlans).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('预计分钟')).toHaveValue('1.'); fireEvent.click(screen.getByRole('button', { name: '保存计划' }));
  expect(api.sendRecurringCommand).not.toHaveBeenCalled(); expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toEqual([]);
});
