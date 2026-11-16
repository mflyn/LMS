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
const available = { writesEnabled: true, reason: null };
const failed = status => ({ response: { status, data: { error: { code: status === 403 ? 'CHILD_ACCESS_DENIED' : 'RECURRING_PLAN_WRITE_UNKNOWN' } } } });
beforeAll(() => { Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle }); globalThis.TextEncoder = TextEncoder; });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.resetAllMocks(); login(); useFamily.mockReturnValue(family());
  api.listRecurringPlans.mockResolvedValue({ availability: available, items: [], page: 1, pageSize: 20, total: 0 });
  api.getRecurringCommand.mockResolvedValue({ state: 'not_found' }); });

const pauseDigest = () => {
  let release, entered = false;
  const barrier = new Promise(resolve => { release = resolve; });
  const original = window.crypto.subtle.digest.bind(window.crypto.subtle);
  const spy = jest.spyOn(window.crypto.subtle, 'digest').mockImplementationOnce(async (...args) => {
    const bytes = await original(...args); entered = true; await barrier; return bytes;
  });
  return { release, entered: () => entered, restore: () => spy.mockRestore() };
};
const beginDraft = async action => {
  api.listRecurringPlans.mockResolvedValue({ availability: available, items: action === 'create' ? [] : [plan()], total: action === 'create' ? 0 : 1 });
  api.getRecurringPlan.mockResolvedValue(plan());
  const view = mount();
  const entry = action === 'create' ? '新建重复计划' : action === 'patch' ? '修改计划' : '停止计划';
  await enabled(entry); fireEvent.click(screen.getByRole('button', { name: entry }));
  const submit = action === 'stop' ? '确认停止' : '保存计划'; await enabled(submit);
  if (action === 'create') fireEvent.change(screen.getByLabelText('计划名称'), { target: { value: '合成摘要竞争' } });
  return { view, submit };
};

const chooseOption = (name, label) => {
  const field = screen.getByRole('combobox', { name, exact: true });
  const option = Array.from(field.options).find(o => o.textContent === label);
  expect(option).toBeDefined(); fireEvent.change(field, { target: { value: option.value } });
};
test.each(['任务类型', '具体项目', '学科'])('common options: empty other %s writes no request or marker and releases busy', async label => {
  await beginDraft('create'); chooseOption(label, '其他（手工输入）');
  fireEvent.change(screen.getByLabelText(`其他${label}`), { target: { value: '   ' } });
  fireEvent.submit(screen.getByRole('button', { name: '保存计划' }).closest('form'));
  await enabled('保存计划'); expect(screen.getByText(`请填写其他${label}。`)).toBeInTheDocument();
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toEqual([]);
  expect(Object.keys(sessionStorage).filter(k => k.includes('recurring-body'))).toEqual([]);
});
test('common options: custom strings survive an unknown result and exact original replay', async () => {
  api.sendRecurringCommand.mockRejectedValue(failed(503)); await beginDraft('create');
  for (const [label, value] of [['任务类型', '亲子活动'], ['具体项目', '社区观察'], ['学科', 'math']]) {
    chooseOption(label, '其他（手工输入）'); fireEvent.change(screen.getByLabelText(`其他${label}`), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: '保存计划' }));
  await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1));
  const original = JSON.parse(JSON.stringify(api.sendRecurringCommand.mock.calls[0][0]));
  expect(original.body.template).toMatchObject({ taskType: '亲子活动', area: '社区观察', subject: 'math' });
  expect(original.body.template).not.toHaveProperty('optionModes'); expect(original.body.template).not.toHaveProperty('optionErrors');
  const markers = { ...localStorage }; await enabled('重试原命令');
  fireEvent.click(screen.getByRole('button', { name: '重试原命令' }));
  await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(2));
  expect(api.sendRecurringCommand.mock.calls[1][0]).toEqual(original); expect({ ...localStorage }).toEqual(markers);
});
test('common options: future revision custom values are displayed and retained in the patch', async () => {
  const p = plan(); p.pendingRevision = { ...p.currentRevision,
    template: { ...p.currentRevision.template, taskType: 'other', area: 'custom', subject: 'Math' } };
  api.listRecurringPlans.mockResolvedValue({ availability: available, items: [p], total: 1 });
  api.getRecurringPlan.mockResolvedValue(p); api.sendRecurringCommand.mockRejectedValue(failed(503)); mount();
  await enabled('修改计划'); fireEvent.click(screen.getByRole('button', { name: '修改计划' })); await enabled('保存计划');
  expect(screen.getByLabelText('其他任务类型')).toHaveValue('other');
  expect(screen.getByLabelText('其他具体项目')).toHaveValue('custom'); expect(screen.getByLabelText('其他学科')).toHaveValue('Math');
  fireEvent.click(screen.getByRole('button', { name: '保存计划' }));
  await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1));
  expect(api.sendRecurringCommand.mock.calls[0][0].body).toMatchObject({ expectedVersion: p.version,
    template: { taskType: 'other', area: 'custom', subject: 'Math' } });
});

test.each([{}, { area: null, subject: '' }, { area: '', subject: null }])('common options: old command optional fields %j bypass new-form validation unchanged', async optional => {
  const input = body(); input.template = { ...input.template, taskType: 'custom', ...optional };
  const original = await prepareRecurringCommand(scope, 'create', null, input, captureSession('parent'));
  api.sendRecurringCommand.mockRejectedValue(failed(503)); mount();
  await enabled('重试原命令'); fireEvent.click(screen.getByRole('button', { name: '重试原命令' }));
  await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1));
  expect(api.sendRecurringCommand.mock.calls[0][0]).toEqual(original);
  for (const field of ['area', 'subject']) {
    expect(Object.hasOwn(api.sendRecurringCommand.mock.calls[0][0].body.template, field)).toBe(Object.hasOwn(optional, field));
    if (Object.hasOwn(optional, field)) expect(api.sendRecurringCommand.mock.calls[0][0].body.template[field]).toBe(optional[field]);
  }
});

const unavailableDraftCases = ['create', 'patch', 'stop'].flatMap(action =>
  ['RECURRING_TASKS_DISABLED', 'RECURRING_TASKS_NOT_READY'].map(reason => [action, reason]));
test.each(unavailableDraftCases)('digest %s: refreshed %s rejects before marker persistence and any write', async (action, reason) => {
  const { view, submit } = await beginDraft(action), hold = pauseDigest();
  try {
    fireEvent.click(screen.getByRole('button', { name: submit }));
    await waitFor(() => expect(hold.entered()).toBe(true));
    api.listRecurringPlans.mockResolvedValue({ items: action === 'create' ? [] : [plan()], total: action === 'create' ? 0 : 1,
      availability: { writesEnabled: false, reason } });
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(reason === 'RECURRING_TASKS_DISABLED' ? '暂未启用' : '尚未就绪'));
    await act(async () => hold.release());
    expect(api.sendRecurringCommand).not.toHaveBeenCalled(); expect(api.abortRecurringCommand).not.toHaveBeenCalled();
    expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toEqual([]);
    expect(Object.keys(sessionStorage).filter(k => k.includes('recurring-body'))).toEqual([]);
    expect(screen.queryByText('有一项计划操作待核对')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent(reason === 'RECURRING_TASKS_DISABLED' ? '暂未启用' : '尚未就绪');
    if (action !== 'stop') expect(screen.getByLabelText('计划名称')).toHaveValue(action === 'create' ? '合成摘要竞争' : '私有旧任务');
  } finally { await act(async () => hold.release()); hold.restore(); view.unmount(); }
});

test.each(['create', 'patch', 'stop'])('digest %s: in-flight availability rejects before storage and releases busy for later retry', async action => {
  const { view, submit } = await beginDraft(action), hold = pauseDigest(); let finishRead;
  const fresh = { items: action === 'create' ? [] : [plan()], total: action === 'create' ? 0 : 1, availability: available };
  try {
    fireEvent.click(screen.getByRole('button', { name: submit })); await waitFor(() => expect(hold.entered()).toBe(true));
    api.listRecurringPlans.mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(api.listRecurringPlans).toHaveBeenCalledTimes(2));
    expect(screen.getByText('正在读取计划…')).toBeVisible();
    await act(async () => hold.release());
    expect(api.sendRecurringCommand).not.toHaveBeenCalled();
    expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toEqual([]);
    expect(Object.keys(sessionStorage).filter(k => k.includes('recurring-body'))).toEqual([]);
    expect(screen.getByRole('dialog')).toHaveTextContent('尚未就绪');
    await act(async () => finishRead(fresh));
    await enabled(submit);
    expect(screen.queryByText('有一项计划操作待核对')).not.toBeInTheDocument();
    expect(api.sendRecurringCommand).not.toHaveBeenCalled();
  } finally {
    await act(async () => { hold.release(); finishRead?.(fresh); }); hold.restore(); view.unmount();
  }
});

test.each(['create', 'patch', 'stop'])('digest %s: a fresh enabled result permits one original write and preserves an unknown marker', async action => {
  api.sendRecurringCommand.mockRejectedValue(failed(503));
  const { view, submit } = await beginDraft(action), hold = pauseDigest();
  try {
    fireEvent.click(screen.getByRole('button', { name: submit })); await waitFor(() => expect(hold.entered()).toBe(true));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(api.listRecurringPlans).toHaveBeenCalledTimes(2));
    await act(async () => hold.release());
    await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1));
    const command = api.sendRecurringCommand.mock.calls[0][0];
    expect(command.marker.action).toBe(action);
    expect(command.body.operationId).toBe(command.marker.operationId);
    const saved = { ...localStorage };
    expect(Object.keys(saved).filter(k => k.includes('recurring-marker'))).toHaveLength(1);
    await enabled('重试原命令');
    api.listRecurringPlans.mockResolvedValue({ items: [], total: 0,
      availability: { writesEnabled: false, reason: 'RECURRING_TASKS_DISABLED' } });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(api.listRecurringPlans).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: '重试原命令' })).toBeDisabled();
    await waitFor(() => expect(screen.getAllByRole('alert')[0]).toHaveTextContent('请求未能确认'));
    expect({ ...localStorage }).toEqual(saved); expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1);
  } finally { await act(async () => hold.release()); hold.restore(); view.unmount(); }
});

test('digest rejection preserves a marker saved by another tab while this draft was waiting', async () => {
  const { view, submit } = await beginDraft('create'), hold = pauseDigest();
  try {
    fireEvent.click(screen.getByRole('button', { name: submit })); await waitFor(() => expect(hold.entered()).toBe(true));
    await act(async () => { await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent')); });
    const saved = { ...localStorage }, privateSaved = { ...sessionStorage };
    api.listRecurringPlans.mockResolvedValue({ items: [], total: 0,
      availability: { writesEnabled: false, reason: 'RECURRING_TASKS_DISABLED' } });
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('暂未启用'));
    await act(async () => hold.release());
    expect({ ...localStorage }).toEqual(saved); expect({ ...sessionStorage }).toEqual(privateSaved);
    expect(api.sendRecurringCommand).not.toHaveBeenCalled(); expect(api.abortRecurringCommand).not.toHaveBeenCalled();
  } finally { await act(async () => hold.release()); hold.restore(); view.unmount(); }
});

test('digest completion after actor switch writes neither marker nor private body', async () => {
  const { view, submit } = await beginDraft('create'), hold = pauseDigest();
  try {
    fireEvent.click(screen.getByRole('button', { name: submit })); await waitFor(() => expect(hold.entered()).toBe(true));
    act(() => login('444444444444444444444444'));
    await act(async () => hold.release());
    expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toEqual([]);
    expect(Object.keys(sessionStorage).filter(k => k.includes('recurring-body'))).toEqual([]);
    expect(api.sendRecurringCommand).not.toHaveBeenCalled(); expect(screen.queryByDisplayValue('合成摘要竞争')).not.toBeInTheDocument();
  } finally { await act(async () => hold.release()); hold.restore(); view.unmount(); }
});

test.each(['RECURRING_TASKS_DISABLED', 'RECURRING_TASKS_NOT_READY'])('unavailable %s explains zero-write creation without saving a marker', async reason => {
  api.listRecurringPlans.mockResolvedValue({ items: [], total: 0, availability: { writesEnabled: false, reason } });
  mount(); await screen.findByText('暂无重复计划');
  expect(screen.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent(reason === 'RECURRING_TASKS_DISABLED' ? '暂未启用' : '尚未就绪');
  fireEvent.click(screen.getByRole('button', { name: '新建重复计划' }));
  expect(screen.queryByLabelText('计划名称')).not.toBeInTheDocument();
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toEqual([]);
});

test('missing availability fails closed instead of assuming an old server can accept writes', async () => {
  api.listRecurringPlans.mockResolvedValue({ items: [], total: 0 }); mount();
  await screen.findByText('暂无重复计划');
  expect(screen.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('尚未就绪');
});

test('disabled pending survives relogin and not_found; explicit verified abort does not enable creation', async () => {
  const command = await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent'));
  clearParentSession(); login();
  api.listRecurringPlans.mockResolvedValue({ items: [], total: 0,
    availability: { writesEnabled: false, reason: 'RECURRING_TASKS_DISABLED' } });
  api.abortRecurringCommand.mockImplementation(async marker => ({ state: 'aborted',
    identity: Object.fromEntries(Object.entries(marker).filter(([k]) => k !== 'schemaVersion')),
    command: null, result: null, settledAt: '2026-11-16T04:00:00Z' }));
  mount(); await screen.findByText('有一项计划操作待核对');
  expect(screen.getByRole('alert')).toHaveTextContent('暂未启用');
  expect(screen.getByText(/为避免重复创建/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '核对原命令' }));
  await screen.findByText('暂未查到终态，原命令仍受保护。');
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '终止未确定命令' }));
  fireEvent.click(screen.getByRole('button', { name: '确认终止' }));
  await waitFor(() => expect(screen.queryByText('有一项计划操作待核对')).not.toBeInTheDocument());
  expect(api.abortRecurringCommand).toHaveBeenCalledWith(command.marker, expect.anything());
  expect(screen.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
});

test('POST disabled after an available list retains exact marker, focuses visible failure and never auto retries', async () => {
  api.sendRecurringCommand.mockRejectedValue({ response: { status: 503, data: { error: { code: 'RECURRING_TASKS_DISABLED' } } } });
  const view = mount(); await enabled('新建重复计划');
  fireEvent.click(screen.getByRole('button', { name: '新建重复计划' })); await enabled('保存计划');
  fireEvent.change(screen.getByLabelText('计划名称'), { target: { value: '合成关闭竞争' } });
  fireEvent.click(screen.getByRole('button', { name: '保存计划' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus());
  expect(screen.getByRole('alert')).toHaveTextContent('暂未启用');
  expect(screen.getByRole('button', { name: '重试原命令' })).toBeDisabled();
  const before = { ...localStorage }, command = api.sendRecurringCommand.mock.calls[0][0];
  api.listRecurringPlans.mockResolvedValue({ items: [], total: 0,
    availability: { writesEnabled: false, reason: 'RECURRING_TASKS_DISABLED' } });
  view.unmount(); mount(); await screen.findByText('有一项计划操作待核对');
  expect(screen.getByRole('alert')).toHaveTextContent('暂未启用');
  expect(screen.getByText(/为避免重复创建/)).toBeVisible();
  expect({ ...localStorage }).toEqual(before);
  fireEvent.click(screen.getByRole('button', { name: '核对原命令' }));
  await screen.findByText('暂未查到终态，原命令仍受保护。');
  expect(api.getRecurringCommand).toHaveBeenCalledWith(command.marker.operationId, scope.childId, expect.anything());
  expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1);
});

test('refresh keeps original retry locked until fresh availability, and a 503 abort never clears the marker', async () => {
  await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent'));
  mount(); await enabled('重试原命令'); let finish;
  api.listRecurringPlans.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: /重新加载计划/ }));
  expect(screen.getByRole('button', { name: '重试原命令' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '重试原命令' }));
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
  await act(async () => finish({ items: [], total: 0, availability: { writesEnabled: false, reason: 'RECURRING_TASKS_NOT_READY' } }));
  const before = { ...localStorage };
  api.abortRecurringCommand.mockRejectedValue({ response: { status: 503, data: { error: { code: 'RECURRING_TASKS_NOT_READY' } } } });
  fireEvent.click(screen.getByRole('button', { name: '终止未确定命令' }));
  fireEvent.click(screen.getByRole('button', { name: '确认终止' }));
  await waitFor(() => expect(api.abortRecurringCommand).toHaveBeenCalledTimes(1));
  await enabled('确认终止');
  expect(screen.getByRole('dialog')).toHaveTextContent('尚未就绪');
  expect({ ...localStorage }).toEqual(before);
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
});

test.each(['actor', 'child', 'family'])('late disabled abort cannot clear the old marker after %s switch', async kind => {
  const old = await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent')); let late;
  api.listRecurringPlans.mockResolvedValue({ items: [], total: 0, availability: { writesEnabled: false, reason: 'RECURRING_TASKS_DISABLED' } });
  api.abortRecurringCommand.mockImplementationOnce(() => new Promise(resolve => { late = resolve; }));
  const view = mount(); await screen.findByText('有一项计划操作待核对');
  fireEvent.click(screen.getByRole('button', { name: '终止未确定命令' })); fireEvent.click(screen.getByRole('button', { name: '确认终止' }));
  await waitFor(() => expect(api.abortRecurringCommand).toHaveBeenCalledTimes(1));
  if (kind === 'actor') act(() => login('444444444444444444444444'));
  else { const next = family();
    if (kind === 'child') { next.selectedChildId = '444444444444444444444444'; next.selectedChild = { childId: next.selectedChildId, name: '另一个孩子' }; next.childScopeVersion = 1; }
    else next.family = { ...next.family, familyId: '444444444444444444444444' };
    useFamily.mockReturnValue(next); view.rerender(<MemoryRouter><RecurringPlansPage /></MemoryRouter>);
  }
  await act(async () => late({ state: 'aborted', identity: Object.fromEntries(Object.entries(old.marker).filter(([k]) => k !== 'schemaVersion')),
    command: null, result: null, settledAt: '2026-11-16T04:00:00Z' }));
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toHaveLength(1);
  expect(screen.queryByText('有一项计划操作待核对')).not.toBeInTheDocument();
});

test('disabled abort receipt in flight cannot settle a replacement marker from another tab', async () => {
  const session = captureSession('parent'), first = await prepareRecurringCommand(scope, 'create', null, body(), session);
  const receipt = { state: 'aborted', identity: Object.fromEntries(Object.entries(first.marker).filter(([k]) => k !== 'schemaVersion')),
    command: null, result: null, settledAt: '2026-11-16T04:00:00Z' };
  let finish;
  api.listRecurringPlans.mockResolvedValue({ items: [], total: 0, availability: { writesEnabled: false, reason: 'RECURRING_TASKS_DISABLED' } });
  api.abortRecurringCommand.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount(); await screen.findByText('有一项计划操作待核对');
  fireEvent.click(screen.getByRole('button', { name: '终止未确定命令' })); fireEvent.click(screen.getByRole('button', { name: '确认终止' }));
  await waitFor(() => expect(api.abortRecurringCommand).toHaveBeenCalledTimes(1));
  await act(async () => {
    await settleRecurringCommand(scope, first.marker, receipt, session);
    await prepareRecurringCommand(scope, 'create', null, { ...body(), operationId: '22222222-2222-4222-8222-222222222222' }, session);
  });
  const replacement = { ...localStorage };
  await act(async () => finish(receipt));
  expect({ ...localStorage }).toEqual(replacement);
  expect(screen.getByText('有一项计划操作待核对')).toBeVisible();
  expect(screen.getByRole('button', { name: '新建重复计划' })).toBeDisabled();
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
});

test('disabled abort 403 clears private state and rejects an earlier list success without clearing the marker', async () => {
  await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent'));
  api.listRecurringPlans.mockResolvedValueOnce({ availability: { writesEnabled: false, reason: 'RECURRING_TASKS_DISABLED' }, items: [plan()], total: 1 });
  let finish;
  api.listRecurringPlans.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  api.abortRecurringCommand.mockRejectedValue(failed(403)); mount(); await screen.findByText('私有旧任务');
  act(() => window.dispatchEvent(new Event('focus'))); await waitFor(() => expect(api.listRecurringPlans).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: '终止未确定命令' })); fireEvent.click(screen.getByRole('button', { name: '确认终止' }));
  await waitFor(() => expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument());
  await act(async () => finish({ availability: available, items: [plan()], total: 1 }));
  expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('有一项计划操作待核对')).not.toBeInTheDocument();
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toHaveLength(1);
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
});

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
  await enabled('重试原命令');
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
  api.listRecurringPlans.mockResolvedValueOnce({ availability: available, items: [plan()], total: 1 }); mount();
  await screen.findByText('私有旧任务');
  fireEvent.click(screen.getByRole('button', { name: '新建重复计划' })); await enabled('保存计划');
  fireEvent.change(screen.getByLabelText('计划名称'), { target: { value: '未提交的私有草稿' } }); let late;
  chooseOption('学科', '其他（手工输入）');
  fireEvent.change(screen.getByLabelText('其他学科'), { target: { value: 'Private custom subject' } });
  api.listRecurringPlans.mockImplementationOnce(() => new Promise(resolve => { late = resolve; })).mockRejectedValueOnce(failed(403));
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(api.listRecurringPlans).toHaveBeenCalledTimes(2));
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument());
  expect(screen.queryByDisplayValue('未提交的私有草稿')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('Private custom subject')).not.toBeInTheDocument();
  await act(async () => late({ availability: available, items: [plan()], total: 1 }));
  expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument(); expect(api.sendRecurringCommand).not.toHaveBeenCalled();
  act(() => { clearParentSession(); login(); });
  await enabled('新建重复计划'); fireEvent.click(screen.getByRole('button', { name: '新建重复计划' }));
  await enabled('保存计划'); expect(screen.queryByLabelText('其他学科')).not.toBeInTheDocument();
  chooseOption('学科', '其他（手工输入）'); expect(screen.getByLabelText('其他学科')).toHaveValue('');
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
  api.listRecurringPlans.mockResolvedValue({ availability: available, items: [plan()], total: 1 });
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
  api.listRecurringPlans.mockResolvedValue({ availability: available, items: [plan()], total: 1 }); api.sendRecurringCommand.mockRejectedValue(failed(503));
  mount(); await screen.findByText('私有旧任务'); fireEvent.click(screen.getByRole('button', { name: '停止计划' }));
  expect(api.sendRecurringCommand).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: '确认停止' }));
  await waitFor(() => expect(api.sendRecurringCommand).toHaveBeenCalledTimes(1));
  expect(api.sendRecurringCommand.mock.calls[0][0]).toMatchObject({ marker: { action: 'stop', targetPlanId: plan().id }, body: { expectedVersion: 1 } });
});

test('stopped row and its scheduled rule are readonly and never advertised as generating tomorrow', async () => {
  api.listRecurringPlans.mockResolvedValue({ availability: available, items: [{ ...plan(), status: 'stopped', pendingRevision: {
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
  api.listRecurringPlans.mockResolvedValue({ availability: available, items: [{ ...plan(), currentRevision: { ...plan().currentRevision, template: { ...body().template, title: '当前计划' } } }], total: 1 });
  api.getRecurringCommand.mockResolvedValue({ state: 'succeeded', identity: Object.fromEntries(Object.entries(original.marker).filter(([k]) => k !== 'schemaVersion')),
    command: original.body, result: { httpStatus: 201, data: { operationId: original.marker.operationId, plan: plan() } }, settledAt: '2026-11-16T04:00:00Z' });
  mount(); await screen.findByText('有一项计划操作待核对'); fireEvent.click(screen.getByRole('button', { name: '核对原命令' }));
  await waitFor(() => expect(screen.queryByText('有一项计划操作待核对')).not.toBeInTheDocument());
  expect(screen.getByText('当前计划')).toBeInTheDocument(); expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument();
  expect(api.sendRecurringCommand).not.toHaveBeenCalled();
});

test('403 during recovery clears private view but preserves marker, even after a late earlier list success', async () => {
  await prepareRecurringCommand(scope, 'create', null, body(), captureSession('parent'));
  api.listRecurringPlans.mockResolvedValueOnce({ availability: available, items: [plan()], total: 1 }); let finish;
  api.listRecurringPlans.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  api.getRecurringCommand.mockRejectedValue(failed(403)); mount(); await screen.findByText('私有旧任务');
  act(() => window.dispatchEvent(new Event('focus'))); await waitFor(() => expect(api.listRecurringPlans).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: '核对原命令' }));
  await waitFor(() => expect(screen.queryByText('私有旧任务')).not.toBeInTheDocument());
  await act(async () => finish({ availability: available, items: [plan()], total: 1 }));
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
