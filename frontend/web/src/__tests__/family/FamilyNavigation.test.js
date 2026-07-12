import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import {
  createFamily,
  getNotificationSettings,
  getMyFamily,
  getWeeklyReport,
  listFamilyReminders,
  listGrowthLogs,
  listGrowthTasks,
  listMistakes,
  listRewards
} from '../../services/familyApi';
import { CHILD_SESSION_KEY, PARENT_SESSION_KEY } from '../../services/familySession';

jest.mock('../../services/familyApi', () => ({
  createChild: jest.fn(),
  getMyFamily: jest.fn(),
  createFamily: jest.fn(),
  getNotificationSettings: jest.fn(),
  getWeeklyReport: jest.fn(),
  listFamilyReminders: jest.fn(),
  listGrowthLogs: jest.fn(),
  listGrowthTasks: jest.fn(),
  listMistakes: jest.fn(),
  listRewards: jest.fn(),
  setChildPin: jest.fn()
}));
jest.mock('../../contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }) => children
}));
jest.mock('../../pages/Dashboard', () => () => <div />);
jest.mock('../../pages/Interaction', () => () => <div />);
jest.mock('../../pages/Resources', () => () => <div />);
jest.mock('../../pages/Analytics', () => () => <div />);

const readyFamily = {
  family: { familyId: 'family-a', familyName: '小明的家', timezone: 'Asia/Shanghai' },
  children: [
    { childId: 'child-a1', name: '小明' },
    { childId: 'child-a2', name: '小红' }
  ],
  defaultChildId: 'child-a1'
};

const setParentSession = () => {
  localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
    token: 'parent-token',
    user: { id: 'parent-a', name: '小明妈妈', role: 'parent' }
  }));
};

const openRoute = (path) => {
  window.history.pushState({}, 'route', path);
  return render(<App />);
};

describe('family parent navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    listGrowthTasks.mockResolvedValue({ items: [], total: 0 });
    listGrowthLogs.mockResolvedValue({ items: [], total: 0 });
    getWeeklyReport.mockResolvedValue({ report: null });
    listMistakes.mockResolvedValue({ items: [], total: 0 });
    listFamilyReminders.mockResolvedValue({ items: [], meta: { partial: false, unavailableSources: [] } });
    getNotificationSettings.mockResolvedValue({ settings: {
      taskReminderEnabled: true,
      overdueReminderEnabled: true,
      mistakeReviewReminderEnabled: true,
      dimensionReminderEnabled: true,
      weeklyReportReminderEnabled: true,
      weeklyReportDay: 7,
      quietHours: { start: '21:00', end: '07:00' }
    } });
    listRewards.mockResolvedValue({ starBalance: 0, rewards: { items: [] }, ledger: { items: [] } });
  });

  test('redirects an unauthenticated parent route to parent login', async () => {
    openRoute('/app/today');

    expect(await screen.findByRole('heading', { name: '家长登录' })).toBeInTheDocument();
    expect(screen.queryByText('班级管理')).not.toBeInTheDocument();
  });

  test('does not accept a child session on a parent route', async () => {
    localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify({ token: 'child-token' }));
    openRoute('/app/today');

    expect(await screen.findByRole('heading', { name: '家长登录' })).toBeInTheDocument();
  });

  test('redirects a parent without a family to setup', async () => {
    setParentSession();
    getMyFamily.mockRejectedValueOnce({
      response: { status: 404, data: { error: { code: 'RESOURCE_NOT_FOUND' } } }
    });

    openRoute('/app/today');

    expect(await screen.findByRole('heading', { name: '创建家庭' })).toBeInTheDocument();
  });

  test('redirects /app to today and renders only family navigation', async () => {
    setParentSession();
    getMyFamily.mockResolvedValueOnce(readyFamily);

    openRoute('/app');

    expect(await screen.findByLabelText('当前孩子')).toHaveValue('child-a1');
    expect(window.location.pathname).toBe('/app/today');
    expect(screen.getByRole('button', { name: '打开导航' })).toBeInTheDocument();

    for (const label of ['今日', '任务', '记录', '错题', '周报', '提醒', '星星与奖励', '孩子']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }

    for (const legacyLabel of ['班级管理', '课程', '教师', '家校互动', '会议', '公告', '学习资源', '数据分析', '管理端']) {
      expect(screen.queryByText(legacyLabel)).not.toBeInTheDocument();
    }
  });

  test('renders every required parent placeholder route', async () => {
    const routes = [
      ['tasks', '任务'],
      ['logs', '记录'],
      ['mistakes', '错题'],
      ['reports', '周报'],
      ['reminders', '提醒'],
      ['rewards', '星星与奖励'],
      ['children', '孩子']
    ];

    for (const [path, heading] of routes) {
      localStorage.clear();
      setParentSession();
      getMyFamily.mockResolvedValueOnce(readyFamily);
      const view = openRoute(`/app/${path}`);

      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
      view.unmount();
    }
  });

  test('opens the compact navigation control for keyboard-reachable links', async () => {
    setParentSession();
    getMyFamily.mockResolvedValueOnce(readyFamily);
    openRoute('/app/today');

    await screen.findByRole('heading', { name: '今日成长' });
    const navigation = screen.getByRole('navigation', { name: '家长导航' });
    const toggle = screen.getByRole('button', { name: '打开导航' });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(navigation).toHaveClass('is-open');
    expect(screen.getByRole('link', { name: '任务' })).toHaveAttribute('href', '/app/tasks');
  });

  test('creates a family from setup and enters the parent shell', async () => {
    setParentSession();
    getMyFamily
      .mockRejectedValueOnce({
        response: { status: 404, data: { error: { code: 'RESOURCE_NOT_FOUND' } } }
      })
      .mockResolvedValueOnce(readyFamily);
    createFamily.mockResolvedValueOnce({ family: readyFamily.family });

    openRoute('/family/setup');

    await screen.findByRole('heading', { name: '创建家庭' });
    getMyFamily.mockResolvedValue(readyFamily);
    fireEvent.change(screen.getByLabelText('家庭名称'), { target: { value: '小明的家' } });
    fireEvent.click(screen.getByRole('button', { name: '创建家庭' }));

    await waitFor(() => {
      expect(createFamily).toHaveBeenCalledWith({ familyName: '小明的家' });
      expect(getMyFamily).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('heading', { name: '今日成长' })).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  test('redirects legacy school URLs through the protected family entry', async () => {
    setParentSession();
    getMyFamily.mockResolvedValueOnce(readyFamily);

    openRoute('/dashboard');

    await waitFor(() => expect(screen.getByRole('heading', { name: '今日成长' })).toBeInTheDocument());
  });
});
