import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TasksPage from '../../pages/family/TasksPage';
import { useFamily } from '../../contexts/FamilyContext';
import * as api from '../../services/familyApi';
import { saveParentSession, clearParentSession, captureSession } from '../../services/familySession';

jest.mock('../../contexts/FamilyContext', () => ({ useFamily: jest.fn() }));
jest.mock('../../services/familyApi', () => ({ listGrowthTasks: jest.fn(), getGrowthTask: jest.fn(),
  createGrowthTask: jest.fn(), updateGrowthTask: jest.fn(), cancelOrArchiveGrowthTask: jest.fn(),
  getCompletionRecovery: jest.fn(), getPrivateMediaAccess: jest.fn(), deletePrivateMedia: jest.fn() }));
const childId = '222222222222222222222222', actorId = '333333333333333333333333';
const family = id => ({ family: { familyId: '111111111111111111111111' }, selectedChildId: id,
  selectedChild: { childId: id, name: 'Synthetic child' }, childScopeVersion: 1 });
const task = extra => ({ taskId: '444444444444444444444444', childId, title: 'Synthetic task', status: 'pending',
  dimension: 'academic', subject: 'math', area: 'Old area', taskType: 'Old type', dueDate: '2026-11-20',
  attachmentMediaIds: [], ...extra });
const view = () => <MemoryRouter><TasksPage /></MemoryRouter>;
const change = (name, value) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
const select = (name, label) => {
  const field = screen.getByRole('combobox', { name, exact: true });
  const option = Array.from(field.options).find(o => o.textContent === label);
  expect(option).toBeDefined(); fireEvent.change(field, { target: { value: option.value } });
};
const submit = () => fireEvent.submit(screen.getByRole('button', { name: '保存任务' }).closest('form'));
const create = async () => {
  const rendered = render(view()); await screen.findByText('暂无成长任务');
  fireEvent.click(screen.getByRole('button', { name: '新建任务' }));
  change('任务标题', 'Synthetic new task'); change('截止日期', '2026-11-20');
  select('具体项目', '计算练习');
  return rendered;
};
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveParentSession({ token: 'synthetic', user: { id: actorId, role: 'parent' } });
  useFamily.mockReturnValue(family(childId)); api.listGrowthTasks.mockResolvedValue({ items: [], total: 0 });
  api.createGrowthTask.mockResolvedValue({ task: task() }); api.updateGrowthTask.mockResolvedValue({ task: task() });
});

test.each(['', '   ', 'Private subject'])('OPT-05A hidden subject %j does not block or enter a new request', async text => {
  await create(); select('学科', '其他（手工输入）'); change('其他学科', text);
  select('成长维度', '体育'); expect(screen.queryByLabelText('其他学科')).not.toBeInTheDocument();
  submit(); await waitFor(() => expect(api.createGrowthTask).toHaveBeenCalledTimes(1));
  const body = api.createGrowthTask.mock.calls[0][0]; expect(body).not.toHaveProperty('subject');
  expect(body).toMatchObject({ dimension: 'physical', area: '计算练习', taskType: 'practice' });
  expect(body).not.toHaveProperty('optionModes'); expect(body).not.toHaveProperty('optionErrors');
});

test.each(['', '   '])('OPT-05B restored other mode %j rejects direct submit then accepts a correction', async text => {
  await create(); select('学科', '其他（手工输入）'); change('其他学科', text);
  select('成长维度', '体育'); select('成长维度', '智育');
  expect(screen.getByLabelText('其他学科')).toHaveValue(text); submit();
  expect(api.createGrowthTask).not.toHaveBeenCalled(); expect(api.updateGrowthTask).not.toHaveBeenCalled();
  expect(screen.getByText('请填写其他学科。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存任务' })).toBeEnabled();
  change('其他学科', '自定义学科'); submit();
  await waitFor(() => expect(api.createGrowthTask).toHaveBeenCalledTimes(1));
  expect(api.createGrowthTask.mock.calls[0][0].subject).toBe('自定义学科');
});

test('OPT-02 editing an unrelated field preserves legacy custom values and the math alias', async () => {
  api.listGrowthTasks.mockResolvedValue({ items: [task()], total: 1 }); render(view());
  fireEvent.click(await screen.findByRole('button', { name: '编辑 Synthetic task' }));
  expect(screen.getByLabelText('其他学科')).toHaveValue('math');
  expect(screen.getByLabelText('其他具体项目')).toHaveValue('Old area');
  expect(screen.getByLabelText('其他任务类型')).toHaveValue('Old type');
  change('任务标题', 'Edited title'); submit();
  await waitFor(() => expect(api.updateGrowthTask).toHaveBeenCalledTimes(1));
  expect(api.updateGrowthTask.mock.calls[0][1]).toMatchObject({ subject: 'math', area: 'Old area', taskType: 'Old type' });
});

test.each(['', '   ', 'Private subject'])('OPT-05A editing non-academic omits hidden subject %j without clearing the original field', async text => {
  api.listGrowthTasks.mockResolvedValue({ items: [task()], total: 1 }); render(view());
  fireEvent.click(await screen.findByRole('button', { name: '编辑 Synthetic task' }));
  change('其他学科', text); select('成长维度', '体育'); submit();
  await waitFor(() => expect(api.updateGrowthTask).toHaveBeenCalledTimes(1));
  expect(api.updateGrowthTask.mock.calls[0][1]).not.toHaveProperty('subject');
  expect(api.updateGrowthTask.mock.calls[0][1].dimension).toBe('physical');
});

test('OPT-05B refresh while hidden preserves unfinished other mode and rejects on return', async () => {
  await create(); select('学科', '其他（手工输入）'); change('其他学科', '   '); select('成长维度', '体育');
  change('求助状态', 'pending');
  await waitFor(() => expect(api.listGrowthTasks).toHaveBeenCalledTimes(2));
  select('成长维度', '智育'); expect(screen.getByLabelText('其他学科')).toHaveValue('   ');
  submit(); expect(screen.getByText('请填写其他学科。')).toBeInTheDocument();
  expect(api.createGrowthTask).not.toHaveBeenCalled();
});

test('OPT-08A list denial clears hidden custom fields and fences a late successful save', async () => {
  let finish;
  api.createGrowthTask.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await create(); select('学科', '其他（手工输入）'); change('其他学科', 'Private denied subject'); select('成长维度', '体育');
  submit(); expect(api.createGrowthTask).toHaveBeenCalledTimes(1);
  api.listGrowthTasks.mockRejectedValue({ response: { status: 403, data: { error: { message: 'Denied' } } } });
  change('求助状态', 'pending');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await act(async () => finish({ task: task() }));
  expect(screen.queryByText('任务已创建。')).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic task')).not.toBeInTheDocument();
  api.listGrowthTasks.mockResolvedValue({ items: [], total: 0 });
  fireEvent.click(screen.getByRole('button', { name: '重新读取任务' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '新建任务' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '新建任务' }));
  select('学科', '其他（手工输入）'); expect(screen.getByLabelText('其他学科')).toHaveValue('');
  expect(api.createGrowthTask).toHaveBeenCalledTimes(1);
});

test('OPT-08A child switch clears hidden subject mode and late save cannot revive it', async () => {
  let finish;
  api.createGrowthTask.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const rendered = await create(), session = captureSession('parent');
  select('学科', '其他（手工输入）'); change('其他学科', 'Private old subject'); select('成长维度', '体育');
  submit(); expect(api.createGrowthTask).toHaveBeenCalledTimes(1);
  useFamily.mockReturnValue(family('555555555555555555555555'));
  rendered.rerender(view()); expect(captureSession('parent')).toEqual(session);
  await act(async () => finish({ task: task() }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '新建任务' }));
  select('学科', '其他（手工输入）'); expect(screen.getByLabelText('其他学科')).toHaveValue('');
  expect(api.createGrowthTask).toHaveBeenCalledTimes(1);
  useFamily.mockReturnValue(family(childId)); rendered.rerender(view());
  await screen.findByText('暂无成长任务'); fireEvent.click(screen.getByRole('button', { name: '新建任务' }));
  select('学科', '其他（手工输入）'); expect(screen.getByLabelText('其他学科')).toHaveValue('');
});

test('OPT-08A switching parent and returning clears hidden draft mode and validation errors', async () => {
  await create(); select('学科', '其他（手工输入）'); change('其他学科', '   '); submit();
  expect(screen.getByText('请填写其他学科。')).toBeInTheDocument(); select('成长维度', '体育');
  act(() => saveParentSession({ token: 'other', user: { id: '666666666666666666666666', role: 'parent' } }));
  await screen.findByText('暂无成长任务'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  act(() => saveParentSession({ token: 'synthetic', user: { id: actorId, role: 'parent' } }));
  await screen.findByText('暂无成长任务'); fireEvent.click(screen.getByRole('button', { name: '新建任务' }));
  expect(screen.queryByLabelText('其他学科')).not.toBeInTheDocument();
  expect(screen.queryByText('请填写其他学科。')).not.toBeInTheDocument();
  select('学科', '其他（手工输入）'); expect(screen.getByLabelText('其他学科')).toHaveValue('');
  expect(api.createGrowthTask).not.toHaveBeenCalled();
});

test('OPT-08A logout discards hidden subject draft without clearing unrelated command markers', async () => {
  await create(); select('学科', '其他（手工输入）'); change('其他学科', 'Private old subject'); select('成长维度', '体育');
  localStorage.setItem('family-growth.recurring-marker.v1:preserved', 'original-marker');
  act(() => clearParentSession());
  act(() => saveParentSession({ token: 'synthetic', user: { id: actorId, role: 'parent' } }));
  await screen.findByText('暂无成长任务'); fireEvent.click(screen.getByRole('button', { name: '新建任务' }));
  select('学科', '其他（手工输入）'); expect(screen.getByLabelText('其他学科')).toHaveValue('');
  expect(localStorage.getItem('family-growth.recurring-marker.v1:preserved')).toBe('original-marker');
  expect(api.createGrowthTask).not.toHaveBeenCalled();
});
