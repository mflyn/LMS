import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import * as api from '../../services/childApi';
import { saveChildSession } from '../../services/familySession';

jest.mock('../../services/childApi');
const id = n => String(n).padStart(24, '0');
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveChildSession({ token: 'synthetic', child: { childId: id(1), familyId: id(2), name: '合成孩子', grade: 1 } });
  api.getOwnProfile.mockResolvedValue({ child: { childId: id(1), familyId: id(2), grade: 1 }, timezone: 'Pacific/Honolulu' });
  api.listOwnGrowthLogs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
  api.listOwnTasks.mockResolvedValue({ items: [], total: 0 });
  api.listOwnReminders.mockResolvedValue({ items: [] });
  api.listOwnCompletionRecoveries.mockResolvedValue({ items: [], total: 0 });
  api.getOwnDailyLearningPlan.mockResolvedValue({ plan: { version: 0, items: [] } });
});
test('real App child reflection route saves and refreshes an actual selected week', async () => {
  window.history.pushState({}, '', '/child/reflection?weekStart=2026-10-26'); render(<App />);
  expect(await screen.findByRole('heading', { name: '本周反思' })).toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '新增反思' }));
  expect(screen.getByPlaceholderText('今天学会了什么？写一句话就好。')).toBeInTheDocument();
  await user.type(screen.getByLabelText('记录内容'), '合成数学练习');
  await user.type(screen.getByLabelText('我的反思'), '先读题再计算');
  const log = { logId: id(3), familyId: id(2), childId: id(1), date: '2026-10-26',
    dimension: 'academic', content: '合成数学练习', childReflection: '先读题再计算' };
  api.createOwnGrowthLog.mockResolvedValue({ log });
  api.listOwnGrowthLogs.mockResolvedValue({ items: [log], total: 1, page: 1, pageSize: 100 });
  await user.click(screen.getByRole('button', { name: '保存反思' }));
  expect(await screen.findByText('先读题再计算')).toBeInTheDocument();
  expect(api.createOwnGrowthLog).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: '重新加载反思' }));
  expect(await screen.findByText('先读题再计算')).toBeInTheDocument();
  expect(api.listOwnGrowthLogs.mock.calls.every(([query]) => query.from === '2026-10-26' && query.to === '2026-11-01')).toBe(true);
});
test('Today links to the protected reflection page and can return without another login', async () => {
  window.history.pushState({}, '', '/child/today'); render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('link', { name: '本周反思' }));
  expect(await screen.findByRole('heading', { name: '本周反思' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: '返回今天' }));
  expect(await screen.findByRole('heading', { name: '今天', level: 1 })).toBeInTheDocument();
});
test('default week uses the family Sunday even when UTC has already reached Monday', async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-26T00:30:00Z'));
  try {
    window.history.pushState({}, '', '/child/reflection'); render(<App />);
    await screen.findByRole('button', { name: '新增反思' });
    expect(screen.getByLabelText('反思所在周')).toHaveValue('2026-10-19');
    expect(api.listOwnGrowthLogs).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-10-19', to: '2026-10-25' }), expect.anything(), expect.anything());
  } finally { jest.useRealTimers(); }
});
test.each([undefined, 'Invalid/Timezone'])('missing or invalid family zone %s never loads records or enables a write', async timezone => {
  api.getOwnProfile.mockResolvedValue({ child: { childId: id(1), familyId: id(2), grade: 1 }, timezone });
  window.history.pushState({}, '', '/child/reflection'); render(<App />);
  await screen.findByText('读取失败，请重试。');
  expect(screen.queryByRole('button', { name: '新增反思' })).not.toBeInTheDocument();
  expect(api.listOwnGrowthLogs).not.toHaveBeenCalled();
  expect(api.createOwnGrowthLog).not.toHaveBeenCalled();
});
