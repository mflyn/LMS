import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import * as api from '../../services/familyApi';
import * as childApi from '../../services/childApi';
import { saveParentSession, saveChildSession } from '../../services/familySession';
import { isLearningId } from '../../services/learningSources';

jest.mock('../../services/familyApi');
jest.mock('../../services/childApi');
const id = n => String(n).padStart(24, '0');
const task = { taskId: id(3), familyId: id(4), childId: id(2), title: '原任务作品', subject: '数学',
  dimension: 'academic', area: '计算', dueDate: '2026-10-27', status: 'confirmed',
  taskType: 'practice', completionVersion: 1, checklistVersion: 0, checklistSnapshot: [],
  completionMediaIds: [], completionMediaReferenceState: 'stable', parentConfirmed: true,
  helpStatus: 'none', helpVersion: 0 };
const mistake = { mistakeId: id(5), familyId: id(4), childId: id(2), subject: '数学',
  knowledgePointName: '分数订正', reason: 'concept', corrected: false, reviewed: false, mastered: false,
  sourceTaskId: id(3), sourceAvailable: true,
  source: { id: id(3), familyId: id(4), childId: id(2), title: task.title, subject: '数学' } };
const family = { family: { familyId: id(4), familyName: '合成家庭', timezone: 'Asia/Shanghai' },
  children: [{ childId: id(2), name: '孩子甲' }, { childId: id(9), name: '孩子乙' }], defaultChildId: id(2) };
const open = path => { window.history.pushState({}, '', path); return render(<App />); };
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveParentSession({ token: 'synthetic-parent', user: { id: id(1), name: '合成家长', role: 'parent' } });
  saveChildSession({ token: 'synthetic-child', child: { childId: id(2), familyId: id(4), name: '孩子甲' } });
  api.getMyFamily.mockResolvedValue(family);
  api.listMistakes.mockResolvedValue({ items: [], total: 0 });
  api.listGrowthTasks.mockResolvedValue({ items: [], total: 0 });
  api.getGrowthTask.mockResolvedValue({ task });
  api.getMistake.mockResolvedValue({ mistake });
  api.getNotificationSettings.mockResolvedValue({ settings: null });
  api.listFamilyReminders.mockResolvedValue({ items: [] });
  childApi.listOwnMistakes.mockResolvedValue({ items: [] });
  childApi.getOwnMistake.mockResolvedValue({ mistake });
  childApi.getOwnTask.mockResolvedValue({ task });
});

test('real App routes task evidence to mistake then correction form without losing the source query', async () => {
  const user = userEvent.setup();
  api.createMistake.mockResolvedValue({ mistake });
  open(`/app/tasks?taskId=${id(3)}`);
  const record = await screen.findByRole('link', { name: '记录错题' });
  expect(record).toHaveAttribute('href', `/app/mistakes?sourceTaskId=${id(3)}`);
  await user.click(record);
  expect(await screen.findByLabelText('学科')).toHaveValue('数学');
  expect(window.location.pathname).toBe('/app/mistakes');
  await user.click(screen.getByRole('button', { name: '保存错题' }));
  await user.click(await screen.findByRole('button', { name: '查看已保存错题' }));
  await user.click(await screen.findByRole('button', { name: '创建订正任务' }));
  expect(await screen.findByLabelText('任务类型')).toHaveValue('错题订正');
  expect(window.location.pathname).toBe('/app/tasks');
  await user.click(screen.getByRole('button', { name: '关闭' }));
  expect(api.createMistake).toHaveBeenCalledTimes(1);
  expect(api.updateMistake).not.toHaveBeenCalled();
  expect(api.createGrowthTask).not.toHaveBeenCalled();
  expect(api.confirmGrowthTask).not.toHaveBeenCalled();
});

test('same-route task correction closes the evidence dialog and opens exactly one editor', async () => {
  const user = userEvent.setup(); open(`/app/tasks?taskId=${id(3)}`);
  await user.click(await screen.findByRole('link', { name: '创建订正任务' }));
  expect(await screen.findByLabelText('任务类型')).toHaveValue('错题订正');
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.queryByText('作品查看与审核')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/app/tasks');
});

test('SPA source navigation preserves the non-default selected child across task, mistake and correction', async () => {
  const secondTask = { ...task, taskId: id(10), childId: id(9), title: '乙的作品' };
  const secondMistake = { ...mistake, mistakeId: id(11), childId: id(9), sourceTaskId: id(10),
    source: { ...mistake.source, id: id(10), childId: id(9), title: secondTask.title } };
  api.listGrowthTasks.mockImplementation(({ childId }) => Promise.resolve({
    items: childId === id(9) ? [secondTask] : [], total: childId === id(9) ? 1 : 0
  }));
  api.getGrowthTask.mockResolvedValue({ task: secondTask });
  api.createMistake.mockResolvedValue({ mistake: secondMistake });
  api.getMistake.mockResolvedValue({ mistake: secondMistake });
  const user = userEvent.setup(); open('/app/tasks');
  await user.selectOptions(await screen.findByLabelText('当前孩子'), id(9));
  await user.click(await screen.findByRole('button', { name: '查看 乙的作品' }));
  const record = await screen.findByRole('link', { name: '记录错题' });
  expect(record).toHaveAttribute('href', `/app/mistakes?sourceTaskId=${id(10)}`);
  await user.click(record);
  expect(await screen.findByLabelText('学科')).toHaveValue('数学');
  expect(screen.getByLabelText('当前孩子')).toHaveValue(id(9));
  expect(window.location.pathname).toBe('/app/mistakes');
  await user.click(screen.getByRole('button', { name: '保存错题' }));
  await user.click(await screen.findByRole('button', { name: '查看已保存错题' }));
  await user.click(await screen.findByRole('button', { name: '创建订正任务' }));
  expect(await screen.findByLabelText('任务类型')).toHaveValue('错题订正');
  expect(window.location.pathname).toBe('/app/tasks');
  expect(screen.getByLabelText('当前孩子')).toHaveValue(id(9));
  expect(api.getMyFamily).toHaveBeenCalledTimes(1);
  expect(api.createMistake).toHaveBeenCalledWith(expect.objectContaining({ childId: id(9), sourceTaskId: id(10) }));
  expect(api.getGrowthTask.mock.calls.every(([taskId]) => taskId === id(10))).toBe(true);
  expect(api.getMistake.mock.calls.every(([mistakeId]) => mistakeId === id(11))).toBe(true);
  expect(api.createGrowthTask).not.toHaveBeenCalled();
});

test('parent source return uses real App task route and performs a new detail GET', async () => {
  const user = userEvent.setup(); open(`/app/mistakes?mistakeId=${id(5)}`);
  await user.click(await screen.findByRole('link', { name: '查看来源任务：原任务作品' }));
  expect(await screen.findByText('作品查看与审核')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/app/tasks');
  expect(api.getGrowthTask).toHaveBeenCalledTimes(1);
});

test('task detail can return to its source mistake through real App routing', async () => {
  api.getGrowthTask.mockResolvedValue({ task: { ...task, sourceMistakeId: id(5), sourceAvailable: true,
    source: { id: id(5), familyId: id(4), childId: id(2), title: '分数订正', subject: '数学' } } });
  const user = userEvent.setup(); open(`/app/tasks?taskId=${id(3)}`);
  await user.click(await screen.findByRole('link', { name: '查看来源错题：分数订正' }));
  expect(await screen.findByLabelText('知识点')).toHaveValue('分数订正');
  expect(window.location.pathname).toBe('/app/mistakes');
});

test('parent reminder opens only current-child authoritative mistake; foreign reminders have no action', async () => {
  api.listFamilyReminders.mockResolvedValue({ items: [
    { type: 'mistake_review', sourceId: id(5), childId: id(2), title: '到期复习' },
    { type: 'mistake_review', sourceId: id(6), childId: id(9), title: '其他孩子提醒' }
  ] });
  const user = userEvent.setup(); open('/app/reminders');
  await user.click(await screen.findByRole('link', { name: '复习此错题' }));
  expect(await screen.findByLabelText('知识点')).toHaveValue('分数订正');
  expect(api.getMistake.mock.calls[0][0]).toBe(id(5));
  expect(screen.getByLabelText('当前孩子')).toHaveValue(id(2));
});

test.each([`sourceTaskId=${id(3)}%0A`, `sourceTaskId=${id(3)}&childId=${id(9)}`])('invalid navigation %s cannot switch child or request source', async query => {
  open(`/app/mistakes?${query}`);
  expect(await screen.findByRole('alert')).toHaveTextContent('当前身份无法读取此记录。');
  expect(screen.getByLabelText('当前孩子')).toHaveValue(id(2));
  expect(api.getGrowthTask).not.toHaveBeenCalled();
  expect(isLearningId(`${id(3)}\n`)).toBe(false);
});

test('child reminder destination loads detail independently of non-mastered list and safely returns to task', async () => {
  const user = userEvent.setup(); open(`/child/mistakes?mistakeId=${id(5)}`);
  await user.click(await screen.findByRole('link', { name: '查看来源任务：原任务作品' }));
  expect(await screen.findByRole('heading', { name: '原任务作品' })).toBeInTheDocument();
  expect(window.location.pathname).toBe(`/child/tasks/${id(3)}`);
  expect(childApi.getOwnMistake).toHaveBeenCalledTimes(1);
  expect(childApi.getOwnTask).toHaveBeenCalled();
});

test('source 503 after refreshing task detail removes prior title and source link', async () => {
  const user = userEvent.setup(); open(`/app/tasks?taskId=${id(3)}`);
  await screen.findByRole('link', { name: '记录错题' });
  api.getGrowthTask.mockRejectedValue({ response: { status: 503, data: { error: { code: 'SOURCE_SERVICE_UNAVAILABLE' } } } });
  await user.click(screen.getByRole('button', { name: /刷新|重新读取/ }));
  expect(await screen.findByText('来源服务暂不可用，请重试读取。')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '记录错题' })).not.toBeInTheDocument();
});
