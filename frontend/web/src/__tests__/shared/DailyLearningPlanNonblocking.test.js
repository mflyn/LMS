import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DailyLearningPlanPanel from '../../components/family/DailyLearningPlanPanel';
import * as childApi from '../../services/childApi';
import * as parentApi from '../../services/familyApi';
import { saveChildSession, saveParentSession } from '../../services/familySession';
import { familyLocalDate } from '../../services/dailyLearningPlan';

jest.mock('../../services/childApi');
jest.mock('../../services/familyApi');
const date = () => familyLocalDate('Pacific/Honolulu');
const task = { taskId: 'a', title: '合成估时任务', status: 'pending', dimension: 'academic', dueDate: '2026-01-01' };
const entry = (minutes = 20, role = 'student') => ({ taskId: 'a', childEstimatedMinutes: minutes,
  estimateRecordedBy: minutes === null ? null : { actorId: role === 'parent' ? 'p' : 'c', role }, task });
const plan = (version = 1, items = [entry()]) => ({ plan: { childId: 'c', localDate: date(), version, items, updatedByActor: null } });
const saveApi = role => role === 'student' ? childApi.saveOwnDailyLearningPlan : parentApi.saveDailyLearningPlan;
const bodyAt = (role, index) => saveApi(role).mock.calls[index][role === 'student' ? 1 : 2];
const nativeEdit = (input, value, badInput) => {
  // JSDOM cannot type an incomplete native number; browser tests cover real badInput.
  Object.defineProperty(input, 'validity', { configurable: true, value: { badInput } });
  fireEvent.input(input, { target: { value } });
};
const callSaveHandler = button => {
  // Deliberately invoke the current real handler independently of disabled-button UI.
  // No product hook or alternate save implementation: this tests the second guard itself.
  const key = Object.keys(button).find(name => name.startsWith('__reactProps$'));
  if (!key || typeof button[key].onClick !== 'function') throw Error('Current React handler unavailable');
  act(() => button[key].onClick());
};
const mount = async role => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <DailyLearningPlanPanel role={role} familyId="f" childId="c" grade={1} timezone="Pacific/Honolulu" />
  </MemoryRouter>);
  const input = await screen.findByLabelText('合成估时任务 估计分钟');
  await waitFor(() => expect(input).toHaveValue(20));
  return { input, save: screen.getByRole('button', { name: '保存今日计划' }) };
};
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveChildSession({ token: 'synthetic-child', child: { childId: 'c', familyId: 'f', name: '合成孩子' } });
  saveParentSession({ token: 'synthetic-parent', user: { id: 'p', role: 'parent' } });
  childApi.getOwnProfile.mockResolvedValue({ child: { childId: 'c', familyId: 'f' }, timezone: 'Pacific/Honolulu' });
  childApi.getOwnDailyLearningPlan.mockResolvedValue(plan()); parentApi.getDailyLearningPlan.mockResolvedValue(plan());
  childApi.listOwnTasks.mockResolvedValue({ items: [task], total: 1 });
  parentApi.listGrowthTasks.mockResolvedValue({ items: [task], total: 1 });
  for (const role of ['student', 'parent']) saveApi(role).mockImplementation(async (...args) => {
    const body = args[role === 'student' ? 1 : 2];
    return plan(body.expectedVersion + 1, body.items.map(i => entry(i.childEstimatedMinutes, role)));
  });
});

for (const role of ['student', 'parent']) {
  test.each([['短', 5], ['中', 15], ['长', 30]])(`[T5-NB-001] ${role} invalid input then %s shortcut saves exact %s`, async (label, minutes) => {
    const user = userEvent.setup(), { input, save } = await mount(role);
    const storage = [localStorage.getItem('childSession'), sessionStorage.length];
    nativeEdit(input, '', true);
    expect(input).toHaveAttribute('aria-invalid', 'true'); expect(save).toBeDisabled();
    expect(saveApi(role)).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('group', { name: '计划项 合成估时任务' })).getByRole('button', { name: `${label} ${minutes}分钟` }));
    expect(input).toHaveValue(minutes); expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('估时输入未完成，请填写整数或清空。')).not.toBeInTheDocument();
    expect(save).toBeEnabled(); await user.click(save); await screen.findByText('今日计划已保存。');
    expect(saveApi(role)).toHaveBeenCalledTimes(1);
    expect(bodyAt(role, 0)).toEqual({ expectedVersion: 1, items: [{ taskId: 'a', childEstimatedMinutes: minutes }] });
    expect(input).toHaveValue(minutes); expect(save).toBeDisabled();
    expect([localStorage.getItem('childSession'), sessionStorage.length]).toEqual(storage);
  });
  test(`[T5-NB-002] ${role} native badInput is rejected by real save handler despite bypassed disabled UI`, async () => {
    const { input, save } = await mount(role);
    nativeEdit(input, '', true); expect(save).toBeDisabled();
    callSaveHandler(save);
    expect(screen.getAllByText('估时输入未完成，请填写整数或清空。')).toHaveLength(2);
    expect(saveApi(role)).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '重试原保存' })).not.toBeInTheDocument();
  });
  test.each(['0', '241', '1.5'])(`[T5-NB-002] ${role} internal integer/range guard rejects %s without save`, async value => {
    const { input, save } = await mount(role);
    nativeEdit(input, value, false); expect(save).toBeEnabled(); callSaveHandler(save);
    expect(screen.getByText('估时请留空或填写 1 至 240 的整数。')).toBeInTheDocument();
    expect(saveApi(role)).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '重试原保存' })).not.toBeInTheDocument();
  });
  test(`[T5-NB controls] ${role} legal minimum/maximum and deliberate empty save exact versions and null`, async () => {
    const user = userEvent.setup(), { input, save } = await mount(role);
    for (const [index, value] of ['1', '240', ''].entries()) {
      nativeEdit(input, value, false); await user.click(save);
      await waitFor(() => expect(saveApi(role)).toHaveBeenCalledTimes(index + 1));
      await waitFor(() => expect(save).toBeDisabled());
      expect(bodyAt(role, index)).toEqual({ expectedVersion: index + 1,
        items: [{ taskId: 'a', childEstimatedMinutes: value === '' ? null : Number(value) }] });
    }
  });
}
