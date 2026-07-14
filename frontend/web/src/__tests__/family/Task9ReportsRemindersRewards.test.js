import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../../pages/family/ReportsPage';
import RemindersPage from '../../pages/family/RemindersPage';
import RewardsPage from '../../pages/family/RewardsPage';
import {
  createReward,
  getNotificationSettings,
  getWeeklyReport,
  listFamilyReminders,
  listRewards,
  redeemReward,
  updateNotificationSettings,
  updateWeeklyReportFeedback
} from '../../services/familyApi';

jest.mock('../../contexts/FamilyContext', () => ({
  useFamily: () => ({
    family: { familyId: 'family-a', timezone: 'Asia/Shanghai' },
    selectedChildId: 'child-a1',
    selectedChild: { childId: 'child-a1', name: '小明' },
    childScopeVersion: 1
  })
}));

jest.mock('../../services/familyApi', () => ({
  createReward: jest.fn(),
  getNotificationSettings: jest.fn(),
  getWeeklyReport: jest.fn(),
  listFamilyReminders: jest.fn(),
  listRewards: jest.fn(),
  redeemReward: jest.fn(),
  updateNotificationSettings: jest.fn(),
  updateWeeklyReportFeedback: jest.fn()
}));

const report = {
  reportId: 'report-1',
  childId: 'child-a1',
  weekStart: '2026-07-06',
  weekEnd: '2026-07-12',
  statistics: {
    recordDays: 5,
    totalDurationMinutes: 320,
    taskCompletionRate: 80,
    mistakeCount: 2,
    dimensionTaskStats: { physical: { completed: 2, planned: 3 } },
    dimensionDurations: { physical: 80 },
    reviewKnowledgePoints: ['分数计算']
  },
  generatedSuggestion: '保持运动和错题复习',
  parentNote: '',
  nextWeekSuggestion: ''
};

const settings = {
  taskReminderEnabled: true,
  overdueReminderEnabled: true,
  mistakeReviewReminderEnabled: true,
  dimensionReminderEnabled: true,
  weeklyReportReminderEnabled: true,
  weeklyReportDay: 7,
  quietHours: { start: '21:00', end: '07:00' }
};

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };
const renderPage = (page) => render(<MemoryRouter future={routerFuture}>{page}</MemoryRouter>);

describe('Task 9 reports', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders nested report statistics and saves parent feedback', async () => {
    const user = userEvent.setup();
    getWeeklyReport.mockResolvedValue({ report });
    updateWeeklyReportFeedback.mockResolvedValue({ report: { ...report, parentNote: '本周坚持得很好' } });
    renderPage(<ReportsPage />);

    expect(await screen.findByText('80%')).toBeInTheDocument();
    expect(screen.getByText('320 分钟')).toBeInTheDocument();
    expect(screen.getByText('分数计算')).toBeInTheDocument();
    expect(screen.getByText(/2\/3 个任务/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('家长寄语'), '本周坚持得很好');
    await user.click(screen.getByRole('button', { name: '保存周报反馈' }));

    await waitFor(() => expect(updateWeeklyReportFeedback).toHaveBeenCalledWith('report-1', expect.objectContaining({
      parentNote: '本周坚持得很好'
    })));
  });
});

describe('Task 9 reminders', () => {
  beforeEach(() => jest.clearAllMocks());

  test('names unavailable sources and saves nested quiet hours', async () => {
    const user = userEvent.setup();
    listFamilyReminders.mockResolvedValue({
      items: [{ type: 'task_due_today', sourceId: 'task-1', title: '今天还有 1 个任务' }],
      meta: { partial: true, unavailableSources: ['mistakes'] }
    });
    getNotificationSettings.mockResolvedValue({ settings });
    updateNotificationSettings.mockResolvedValue({ settings: { ...settings, quietHours: { start: '22:00', end: '07:30' } } });
    renderPage(<RemindersPage />);

    expect(await screen.findByText('今天还有 1 个任务')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '暂不可用的数据来源' })).toHaveTextContent('mistakes');
    const start = await screen.findByLabelText('免打扰开始');
    const end = screen.getByLabelText('免打扰结束');
    await user.clear(start);
    await user.type(start, '22:00');
    await user.clear(end);
    await user.type(end, '07:30');
    await user.click(screen.getByRole('button', { name: '保存提醒设置' }));

    await waitFor(() => expect(updateNotificationSettings).toHaveBeenCalledWith(expect.objectContaining({
      quietHours: { start: '22:00', end: '07:30' }
    })));
  });
});

describe('Task 9 rewards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listRewards.mockResolvedValue({
      starBalance: 42,
      rewards: { items: [{ rewardId: 'reward-1', title: '周末家庭活动', requiredStars: 30, status: 'active' }] },
      ledger: { items: [{ ledgerEntryId: 'ledger-1', type: 'earn', amount: 1, createdAt: '2026-07-11T10:00:00Z' }] }
    });
  });

  test('creates a reward for the selected child', async () => {
    const user = userEvent.setup();
    createReward.mockResolvedValue({ reward: { rewardId: 'reward-2', title: '选择晚餐', requiredStars: 20, status: 'active' } });
    renderPage(<RewardsPage />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '新建奖励' }));
    await user.type(screen.getByLabelText('奖励名称'), '选择晚餐');
    await user.type(screen.getByLabelText('所需星星'), '20');
    await user.click(screen.getByRole('button', { name: '保存奖励' }));

    await waitFor(() => expect(createReward).toHaveBeenCalledWith({
      childId: 'child-a1', title: '选择晚餐', requiredStars: 20
    }));
  });

  test('reuses one idempotency key when a redemption is retried', async () => {
    const user = userEvent.setup();
    redeemReward
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ rewardId: 'reward-1', status: 'redeemed', starBalance: 12, spentStars: 30 });
    renderPage(<RewardsPage />);

    await user.click(await screen.findByRole('button', { name: '兑换 周末家庭活动' }));
    await user.click(screen.getByRole('button', { name: '确认兑换' }));
    await user.click(await screen.findByRole('button', { name: '重试兑换' }));

    await waitFor(() => expect(redeemReward).toHaveBeenCalledTimes(2));
    expect(redeemReward.mock.calls[0][1]).toBe(redeemReward.mock.calls[1][1]);
    expect(await screen.findByText('12')).toBeInTheDocument();
  });

  test('keeps an active reward unchanged when balance is insufficient', async () => {
    const user = userEvent.setup();
    redeemReward.mockRejectedValueOnce({
      response: { status: 409, data: { error: { code: 'INSUFFICIENT_STARS', message: '星星余额不足' } } }
    });
    renderPage(<RewardsPage />);

    await user.click(await screen.findByRole('button', { name: '兑换 周末家庭活动' }));
    await user.click(screen.getByRole('button', { name: '确认兑换' }));

    expect(await screen.findByText('星星余额不足')).toBeInTheDocument();
    expect(screen.getByText('30 颗星 · 可兑换')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试兑换' })).toBeInTheDocument();
  });
});
