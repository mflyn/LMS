import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DailyLearningPlanPanel from '../../components/family/DailyLearningPlanPanel';
import * as childApi from '../../services/childApi';
import * as parentApi from '../../services/familyApi';
import { saveChildSession, saveParentSession, clearChildSession, CHILD_SESSION_KEY } from '../../services/familySession';
import { resetChildScope } from '../../services/childScope';
import { familyLocalDate } from '../../services/dailyLearningPlan';
import * as dates from '../../services/dailyLearningPlan';
jest.mock('../../services/childApi');
jest.mock('../../services/familyApi');
const today = () => familyLocalDate('Pacific/Honolulu');
const task = (taskId, status = 'pending') => ({ taskId, title: `任务${taskId}`, status, dimension: 'academic', dueDate: '2026-01-01' });
const item = (taskId, minutes = null, role = null) => ({ taskId, childEstimatedMinutes: minutes,
  estimateRecordedBy: role ? { actorId: role === 'parent' ? 'p' : 'c', role } : null, task: task(taskId) });
const plan = (version = 0, items = [], childId = 'c') => ({ plan: { childId, localDate: today(), version, items, updatedByActor: null } });
const failure = status => ({ response: { status, data: { error: { code: status === 409 ? 'VERSION_CONFLICT' : 'DENIED' } } } });
const tree = (props = {}) => <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  <DailyLearningPlanPanel role="student" familyId="f" childId="c" grade={1} {...props} />
</MemoryRouter>;
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveChildSession({ token: 'synthetic-child', child: { childId: 'c', familyId: 'f', name: '合成孩子' } });
  saveParentSession({ token: 'synthetic-parent', user: { id: 'p', role: 'parent' } });
  childApi.getOwnProfile.mockResolvedValue({ child: { childId: 'c', familyId: 'f' }, timezone: 'Pacific/Honolulu' });
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan());
  childApi.listOwnTasks.mockResolvedValue({ items: [task('a'), task('b')], total: 2, page: 1, pageSize: 20 });
  childApi.saveOwnDailyLearningPlan.mockImplementation(async (_date, body) => plan(body.expectedVersion + 1,
    body.items.map(i => item(i.taskId, i.childEstimatedMinutes, i.childEstimatedMinutes === null ? null : 'student'))));
  parentApi.getDailyLearningPlan.mockResolvedValue(plan());
  parentApi.listGrowthTasks.mockResolvedValue({ items: [task('a'), task('b')], total: 2, page: 1, pageSize: 20 });
  parentApi.saveDailyLearningPlan.mockImplementation(async (_child, _date, body) => plan(body.expectedVersion + 1,
    body.items.map(i => item(i.taskId, i.childEstimatedMinutes, i.childEstimatedMinutes === null ? null : 'parent'))));
});
afterEach(() => jest.restoreAllMocks());
const add = async (user, id) => user.click(await screen.findByRole('button', { name: `加入今日计划 任务${id}` }));
const nativeEdit = (input, value, badInput) => {
  // JSDOM cannot produce incomplete number editing; real Chromium tests cover that boundary.
  Object.defineProperty(input, 'validity', { configurable: true, value: { badInput } });
  fireEvent.input(input, { target: { value } });
};
test.each(['student', 'parent'])('%s keeps native invalidity per task across reorder and accepts correction without extra payload fields', async role => {
  const api = role === 'student' ? childApi.saveOwnDailyLearningPlan : parentApi.saveDailyLearningPlan;
  const user = userEvent.setup(); render(tree({ role, timezone: 'Pacific/Honolulu' }));
  await add(user, 'a'); await add(user, 'b');
  nativeEdit(screen.getByLabelText('任务a 估计分钟'), '', true);
  fireEvent.change(screen.getByLabelText('任务b 估计分钟'), { target: { value: '20' } });
  await user.click(screen.getByRole('button', { name: '下移 任务a' }));
  expect(screen.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  expect(screen.getByLabelText('任务a 估计分钟')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('估时输入未完成，请填写整数或清空。')).toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
  nativeEdit(screen.getByLabelText('任务a 估计分钟'), '30', false);
  await user.click(screen.getByRole('button', { name: '保存今日计划' })); await screen.findByText('今日计划已保存。');
  expect(api.mock.calls[0][role === 'student' ? 1 : 2]).toEqual({ expectedVersion: 0, items: [
    { taskId: 'b', childEstimatedMinutes: 20 }, { taskId: 'a', childEstimatedMinutes: 30 }
  ] });
});
test('same sanitized empty value can become a deliberate clear, while removing another invalid item clears only that item', async () => {
  const user = userEvent.setup(); childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(1, [item('a', 15, 'student'), item('b', 20, 'student')]));
  render(tree()); await screen.findByLabelText('任务a 估计分钟');
  nativeEdit(screen.getByLabelText('任务a 估计分钟'), '', true);
  nativeEdit(screen.getByLabelText('任务b 估计分钟'), '', true);
  nativeEdit(screen.getByLabelText('任务a 估计分钟'), '', false);
  expect(screen.getByLabelText('任务a 估计分钟')).toHaveAttribute('aria-invalid', 'false');
  expect(screen.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '移出今日计划 任务b' }));
  await user.click(screen.getByRole('button', { name: '保存今日计划' })); await screen.findByText('今日计划已保存。');
  expect(childApi.saveOwnDailyLearningPlan.mock.calls[0][1]).toEqual({ expectedVersion: 1, items: [{ taskId: 'a', childEstimatedMinutes: null }] });
});
test('invalidity does not cross child scope and corrected unknown-result retry retains the original command', async () => {
  const user = userEvent.setup(), view = render(tree()); await add(user, 'a');
  nativeEdit(screen.getByLabelText('任务a 估计分钟'), '', true);
  act(() => saveChildSession({ token: 'synthetic-sibling', child: { childId: 'd', familyId: 'f', name: '合成同胞' } }));
  expect(screen.queryByText('估时输入未完成，请填写整数或清空。')).not.toBeInTheDocument();
  childApi.getOwnProfile.mockResolvedValue({ child: { childId: 'd', familyId: 'f' }, timezone: 'Pacific/Honolulu' });
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(0, [], 'd'));
  view.rerender(tree({ childId: 'd' })); await add(user, 'a');
  fireEvent.change(screen.getByLabelText('任务a 估计分钟'), { target: { value: '30' } });
  childApi.saveOwnDailyLearningPlan.mockRejectedValueOnce(Error('synthetic response loss')).mockResolvedValueOnce(plan(1, [item('a', 30, 'student')], 'd'));
  await user.click(screen.getByRole('button', { name: '保存今日计划' })); await screen.findByRole('button', { name: '重试原保存' });
  expect(screen.getByLabelText('任务a 估计分钟')).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '重试原保存' })); await screen.findByText('今日计划已保存。');
  expect(childApi.saveOwnDailyLearningPlan.mock.calls[0][1]).toEqual({ expectedVersion: 0, items: [{ taskId: 'a', childEstimatedMinutes: 30 }] });
  expect(childApi.saveOwnDailyLearningPlan.mock.calls[1][1]).toEqual(childApi.saveOwnDailyLearningPlan.mock.calls[0][1]);
});
test('child adds, estimates and reorders; save uses the viewed version and reload retains order', async () => {
  const user = userEvent.setup(), view = render(tree()); await add(user, 'a'); await add(user, 'b');
  await user.click(within(screen.getByRole('group', { name: '计划项 任务a' })).getByRole('button', { name: '短 5分钟' }));
  await user.click(screen.getByRole('button', { name: '上移 任务b' }));
  await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  await screen.findByText('今日计划已保存。');
  const sent = childApi.saveOwnDailyLearningPlan.mock.calls[0];
  expect(sent[0]).toBe(today()); expect(sent[1]).toEqual({ expectedVersion: 0,
    items: [{ taskId: 'b', childEstimatedMinutes: null }, { taskId: 'a', childEstimatedMinutes: 5 }] });
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(1, [item('b'), item('a', 5, 'student')]));
  view.unmount(); render(tree());
  await screen.findByRole('group', { name: '计划项 任务b' });
  expect(screen.getAllByRole('group', { name: /计划项/ }).map(n => n.getAttribute('aria-label'))).toEqual(['计划项 任务b', '计划项 任务a']);
  expect(childApi.saveOwnDailyLearningPlan).toHaveBeenCalledTimes(1);
});
test('parent estimates are visibly parent input and clearing/removing changes no task', async () => {
  const user = userEvent.setup(); render(tree({ role: 'parent', timezone: 'Pacific/Honolulu' })); await add(user, 'a');
  fireEvent.change(screen.getByLabelText('任务a 估计分钟'), { target: { value: '30' } });
  await user.click(screen.getByRole('button', { name: '保存今日计划' })); await screen.findByText('家长输入');
  await user.click(screen.getByRole('button', { name: '移出今日计划 任务a' }));
  await user.click(screen.getByRole('button', { name: '保存今日计划' })); await screen.findByText('今日计划已保存。');
  expect(parentApi.saveDailyLearningPlan.mock.calls[1][2]).toEqual({ expectedVersion: 1, items: [] });
});
test('conflict keeps draft and blocks overwrite until explicit adoption of latest version', async () => {
  const user = userEvent.setup(); render(tree()); await add(user, 'a');
  childApi.saveOwnDailyLearningPlan.mockRejectedValueOnce(failure(409));
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(4, [item('b', 15, 'parent')]));
  await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  await screen.findByRole('button', { name: '采用最新计划' });
  expect(screen.getByRole('group', { name: '计划项 任务a' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  expect(childApi.saveOwnDailyLearningPlan).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: '采用最新计划' }));
  expect(screen.queryByRole('group', { name: '计划项 任务a' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('任务b 估计分钟')).toHaveValue(15);
  expect(screen.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('任务b 估计分钟'), { target: { value: '30' } });
  await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  expect(childApi.saveOwnDailyLearningPlan.mock.calls[1][1]).toEqual({ expectedVersion: 4,
    items: [{ taskId: 'b', childEstimatedMinutes: 30 }] });
});
test('unknown response and read failure preserve exact original version and estimates for retry', async () => {
  const user = userEvent.setup(); render(tree()); await add(user, 'a');
  childApi.saveOwnDailyLearningPlan.mockRejectedValueOnce(Error('synthetic network loss'));
  await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  await screen.findByRole('button', { name: '重试原保存' });
  childApi.getOwnDailyLearningPlan.mockRejectedValueOnce(Error('synthetic read failure'));
  await user.click(screen.getByRole('button', { name: '读取最新计划' }));
  await screen.findByText('暂时无法读取计划，原草稿仍保留。');
  await user.click(screen.getByRole('button', { name: '重试原保存' }));
  await screen.findByText('今日计划已保存。');
  expect(childApi.saveOwnDailyLearningPlan.mock.calls[1][1]).toEqual(childApi.saveOwnDailyLearningPlan.mock.calls[0][1]);
});
test('refresh 403 removes private plan, draft and pending retry', async () => {
  const user = userEvent.setup(); render(tree()); await add(user, 'a');
  childApi.saveOwnDailyLearningPlan.mockRejectedValueOnce(Error('loss')); await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  await screen.findByRole('button', { name: '重试原保存' }); childApi.getOwnDailyLearningPlan.mockRejectedValueOnce(failure(403));
  await user.click(screen.getByRole('button', { name: '读取最新计划' }));
  await screen.findByText('当前身份无法查看此计划，请重新登录或切换孩子。');
  expect(screen.queryByText('任务a')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: '重试原保存' })).not.toBeInTheDocument();
});
test('logout during save prevents late success from restoring private items', async () => {
  let resolve; childApi.saveOwnDailyLearningPlan.mockImplementation(() => new Promise(r => { resolve = r; }));
  const user = userEvent.setup(); render(tree()); await add(user, 'a');
  await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  act(() => clearChildSession()); await act(async () => resolve(plan(1, [item('a')])));
  expect(screen.queryByText('任务a')).not.toBeInTheDocument(); expect(screen.queryByText('今日计划已保存。')).not.toBeInTheDocument();
});
test('parent child-scope reset blocks late reads before rerender', async () => {
  let resolve; parentApi.getDailyLearningPlan.mockImplementation(() => new Promise(r => { resolve = r; }));
  render(tree({ role: 'parent', timezone: 'Pacific/Honolulu' }));
  await waitFor(() => expect(parentApi.getDailyLearningPlan).toHaveBeenCalledTimes(1));
  act(() => resetChildScope({ previousChildId: 'c', nextChildId: 'd' }));
  await act(async () => resolve(plan(1, [item('secret')])));
  expect(screen.queryByText('任务secret')).not.toBeInTheDocument();
});
test('a focus item beyond the current candidate page is retained, and old pending tasks remain reachable through pagination', async () => {
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(1, [item('z')]));
  childApi.listOwnTasks.mockResolvedValueOnce({ items: [task('a')], total: 21, page: 1, pageSize: 20 })
    .mockResolvedValueOnce({ items: [task('old')], total: 21, page: 2, pageSize: 20 });
  const user = userEvent.setup(); render(tree());
  await screen.findByRole('group', { name: '计划项 任务z' });
  await user.click(screen.getByRole('button', { name: '下一页待办' }));
  expect(await screen.findByRole('link', { name: '任务old' })).toHaveAttribute('href', '/child/tasks/old');
  expect(childApi.listOwnTasks.mock.calls[1][0]).toEqual({ status: 'pending', page: 2, pageSize: 20 });
  expect(screen.getByRole('group', { name: '计划项 任务z' })).toBeInTheDocument();
});
test('invalid minutes reject before API and completed or unavailable existing tasks cannot be added as new', async () => {
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(1, [{ ...item('done'), task: task('done', 'confirmed') }, { ...item('gone'), task: null }]));
  const user = userEvent.setup(); render(tree()); await add(user, 'a');
  fireEvent.change(screen.getByLabelText('任务a 估计分钟'), { target: { value: '241' } });
  await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  expect(await screen.findByText('估时请留空或填写 1 至 240 的整数。')).toBeInTheDocument();
  expect(childApi.saveOwnDailyLearningPlan).not.toHaveBeenCalled();
  expect(screen.getByText('任务不可用')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '任务done' })).toHaveAttribute('href', '/child/tasks/done');
});
test('unsaved parent estimate does not claim the previously recorded child as its author', async () => {
  parentApi.getDailyLearningPlan.mockResolvedValue(plan(1, [item('a', 5, 'student')]));
  render(tree({ role: 'parent', timezone: 'Pacific/Honolulu' }));
  await screen.findByText('孩子输入');
  fireEvent.change(screen.getByLabelText('任务a 估计分钟'), { target: { value: '15' } });
  expect(screen.queryByText('孩子输入')).not.toBeInTheDocument();
  expect(screen.getByText('待保存 · 家长输入')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('任务a 估计分钟'), { target: { value: '5' } });
  expect(screen.getByText('孩子输入')).toBeInTheDocument();
});
test('parent task links carry the selected child so switching children cannot reopen a stale link', async () => {
  parentApi.getDailyLearningPlan.mockResolvedValue(plan(1, [item('a')]));
  render(tree({ role: 'parent', timezone: 'Pacific/Honolulu' }));
  expect(await screen.findByRole('link', { name: '任务a' })).toHaveAttribute('href', '/app/tasks?childId=c&taskId=a');
});
test('same-version refresh preserves unsaved minutes and the original unknown request until adoption', async () => {
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(1, [item('a', 5, 'student')]));
  const user = userEvent.setup(); render(tree()); await screen.findByLabelText('任务a 估计分钟');
  fireEvent.change(screen.getByLabelText('任务a 估计分钟'), { target: { value: '15' } });
  childApi.saveOwnDailyLearningPlan.mockRejectedValueOnce(Error('loss'));
  await user.click(screen.getByRole('button', { name: '保存今日计划' })); await screen.findByRole('button', { name: '重试原保存' });
  await user.click(screen.getByRole('button', { name: '读取最新计划' })); await screen.findByRole('button', { name: '采用最新计划' });
  expect(screen.getByLabelText('任务a 估计分钟')).toHaveValue(15);
  await user.click(screen.getByRole('button', { name: '重试原保存' })); await screen.findByText('今日计划已保存。');
  expect(childApi.saveOwnDailyLearningPlan.mock.calls[1][1]).toEqual({ expectedVersion: 1, items: [{ taskId: 'a', childEstimatedMinutes: 15 }] });
});
test('late denied save from an old session cannot clear the reauthenticated session plan', async () => {
  let reject; childApi.saveOwnDailyLearningPlan.mockImplementation(() => new Promise((_resolve, r) => { reject = r; }));
  const user = userEvent.setup(); render(tree()); await add(user, 'a');
  await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(2, [item('new')]));
  act(() => saveChildSession({ token: 'synthetic-new-session', child: { childId: 'c', familyId: 'f', name: '合成孩子' } }));
  await screen.findByRole('group', { name: '计划项 任务new' });
  await act(async () => reject(failure(403)));
  expect(screen.getByRole('group', { name: '计划项 任务new' })).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: '计划项 任务a' })).not.toBeInTheDocument();
  expect(screen.queryByText('当前身份无法查看此计划，请重新登录或切换孩子。')).not.toBeInTheDocument();
});
test('permission denial invalidates a pending candidate response and cannot repopulate private titles', async () => {
  let resolve; childApi.listOwnTasks.mockImplementation(() => new Promise(r => { resolve = r; }));
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(1, [item('private')]));
  const user = userEvent.setup(); render(tree()); await screen.findByRole('group', { name: '计划项 任务private' });
  childApi.getOwnDailyLearningPlan.mockRejectedValueOnce(failure(403));
  await user.click(screen.getByRole('button', { name: '读取最新计划' }));
  await screen.findByText('当前身份无法查看此计划，请重新登录或切换孩子。');
  await act(async () => resolve({ items: [task('late-private')], total: 1 }));
  expect(screen.queryByText('任务private')).not.toBeInTheDocument();
  expect(screen.queryByText('任务late-private')).not.toBeInTheDocument();
});
test('twenty items cannot add another; midnight disables writing without copying old items into today', async () => {
  const oldDate = today();
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(1, Array.from({ length: 20 }, (_, i) => item(String(i)))));
  const user = userEvent.setup(); render(tree());
  expect(await screen.findByRole('button', { name: '加入今日计划 任务a' })).toBeDisabled();
  const clock = jest.spyOn(dates, 'familyLocalDate').mockReturnValue('2099-12-31');
  act(() => window.dispatchEvent(new Event('focus')));
  expect(screen.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  expect(screen.getAllByRole('group', { name: /计划项/ })).toHaveLength(20);
  childApi.getOwnDailyLearningPlan.mockResolvedValue({ plan: { childId: 'c', localDate: '2099-12-31', version: 0, items: [] } });
  await user.click(screen.getByRole('button', { name: '打开今天计划' }));
  await screen.findByText('今日计划暂无任务。');
  expect(childApi.saveOwnDailyLearningPlan).not.toHaveBeenCalled(); expect(screen.queryByText(oldDate)).not.toBeInTheDocument();
  clock.mockRestore();
});
test('cross-tab identity replacement clears the old draft and a late success cannot restore it', async () => {
  let resolve; childApi.saveOwnDailyLearningPlan.mockImplementation(() => new Promise(r => { resolve = r; }));
  const user = userEvent.setup(); render(tree()); await add(user, 'a');
  await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  act(() => {
    localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify({ token: 'synthetic-sibling', revision: 'other-tab',
      child: { childId: 'sibling', familyId: 'f', name: '合成兄弟姐妹' } }));
    window.dispatchEvent(new StorageEvent('storage', { key: CHILD_SESSION_KEY, storageArea: localStorage }));
  });
  await act(async () => resolve(plan(1, [item('a')])));
  expect(screen.queryByText('任务a')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重试原保存' })).not.toBeInTheDocument();
  expect(childApi.saveOwnDailyLearningPlan).toHaveBeenCalledTimes(1);
});
test('failed opening of the new day never re-enables saving the preserved yesterday draft', async () => {
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(1, [item('a', 5, 'student')]));
  const user = userEvent.setup(); render(tree()); await screen.findByLabelText('任务a 估计分钟');
  fireEvent.change(screen.getByLabelText('任务a 估计分钟'), { target: { value: '15' } });
  jest.spyOn(dates, 'familyLocalDate').mockReturnValue('2099-12-31');
  act(() => window.dispatchEvent(new Event('focus')));
  childApi.getOwnDailyLearningPlan.mockRejectedValueOnce(Error('new day unavailable'));
  await user.click(screen.getByRole('button', { name: '打开今天计划' }));
  await screen.findByText('暂时无法读取计划，原草稿仍保留。');
  expect(screen.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  expect(screen.getByLabelText('任务a 估计分钟')).toHaveValue(15);
  await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  expect(childApi.saveOwnDailyLearningPlan).not.toHaveBeenCalled();
});
test('submit rechecks family midnight even before the next clock poll or focus event', async () => {
  const user = userEvent.setup(); render(tree()); await add(user, 'a');
  jest.spyOn(dates, 'familyLocalDate').mockReturnValue('2099-12-31');
  await user.click(screen.getByRole('button', { name: '保存今日计划' }));
  expect(childApi.saveOwnDailyLearningPlan).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
});
test.each(['refresh', 'retry-conflict'])('same persisted content after lost response is explained without implicit adoption or another save: %s', async mode => {
  const user = userEvent.setup(); render(tree()); await add(user, 'a');
  childApi.saveOwnDailyLearningPlan.mockRejectedValueOnce(Error('lost committed response'));
  await user.click(screen.getByRole('button', { name: '保存今日计划' })); await screen.findByRole('button', { name: '重试原保存' });
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan(1, [item('a')]));
  if (mode === 'refresh') await user.click(screen.getByRole('button', { name: '读取最新计划' }));
  else {
    childApi.saveOwnDailyLearningPlan.mockRejectedValueOnce(failure(409));
    await user.click(screen.getByRole('button', { name: '重试原保存' }));
  }
  await screen.findByText('服务器已有与原保存相同的顺序和估时，请核对后采用，无需再次保存。');
  const calls = childApi.saveOwnDailyLearningPlan.mock.calls.length;
  expect(screen.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '采用最新计划' }));
  expect(screen.getByRole('button', { name: '保存今日计划' })).toBeDisabled();
  expect(childApi.saveOwnDailyLearningPlan).toHaveBeenCalledTimes(calls);
});
