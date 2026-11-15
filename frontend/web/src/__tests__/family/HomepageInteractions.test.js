import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TodayPage from '../../pages/family/TodayPage';
import ChildTodayPage from '../../pages/child/ChildTodayPage';
import FamilyShell from '../../components/family/FamilyShell';
import { PARENT_NAV_ITEMS } from '../../config/familyNavigation';
import * as parentApi from '../../services/familyApi';
import * as childApi from '../../services/childApi';
import { saveChildSession, saveParentSession } from '../../services/familySession';

const id = n => String(n).padStart(24, '0');
const mockFamily = {
  family: { familyId: id(1), timezone: 'Asia/Shanghai' },
  selectedChild: { childId: id(2), name: '合成孩子' },
  selectedChildId: id(2), childScopeVersion: 1, familyStatus: 'ready', children: []
};
jest.mock('../../contexts/FamilyContext', () => ({ useFamily: () => mockFamily }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: '合成家长' }, logout: jest.fn() }) }));
jest.mock('../../services/familyApi');
jest.mock('../../services/childApi');
// Existing plan/recovery workflows have their own integration and browser coverage.
jest.mock('../../components/family/DailyLearningPlanPanel', () => () => <section aria-label="今日计划" />);
jest.mock('../../components/family/CompletionRecoveryList', () => () => null);

const task = (n, status = 'pending') => ({ taskId: id(n), childId: id(2), familyId: id(1),
  title: `合成任务${n}`, dimension: 'academic', status });
const renderPage = page => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{page}</MemoryRouter>);

beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  parentApi.listGrowthTasks.mockResolvedValue({ items: [], total: 0 });
  parentApi.getWeeklyReport.mockResolvedValue({ report: null });
  parentApi.listMistakes.mockResolvedValue({ items: [], total: 0 });
  parentApi.listFamilyReminders.mockResolvedValue({ items: [], meta: {} });
  childApi.listOwnReminders.mockResolvedValue({ items: [], meta: {} });
});

test('parent home opens task details in the selected child scope and surfaces a pending help request', async () => {
  saveParentSession({ token: 'synthetic-only', user: { id: id(9), role: 'parent' } });
  parentApi.listGrowthTasks.mockResolvedValue({ items: [task(3), { ...task(4), helpRequest: { status: 'pending' } }], total: 2 });
  renderPage(<TodayPage />);
  const tasks = await screen.findByRole('region', { name: '今天的任务' });
  expect(within(tasks).getByRole('link', { name: /合成任务3/ })).toHaveAttribute('href', `/app/tasks?childId=${id(2)}&taskId=${id(3)}`);
  const support = screen.getByRole('region', { name: '需要你的支持' });
  expect(within(support).getByText('合成任务4')).toBeInTheDocument();
  expect(within(support).getByRole('link', { name: '查看求助' })).toHaveAttribute('href', '/app/tasks?helpStatus=pending');
});

test('child can choose a pending task; completed, confirmed and cancelled tasks keep their original behavior', async () => {
  const user = userEvent.setup();
  saveChildSession({ token: 'synthetic-only', child: { childId: id(2), familyId: id(1), name: '合成孩子' } });
  childApi.listOwnTasks.mockResolvedValue({ items: [task(3), task(4), task(5, 'completed'), task(6, 'confirmed'), task(7, 'cancelled')] });
  renderPage(<ChildTodayPage />);
  const focus = await screen.findByRole('region', { name: '接下来可以做' });
  expect(within(focus).getByRole('link', { name: '查看这项任务' })).toHaveAttribute('href', `/child/tasks/${id(3)}`);
  await user.click(screen.getByRole('button', { name: '选择任务 合成任务4' }));
  expect(focus).toHaveFocus();
  expect(within(focus).getByRole('link', { name: '查看这项任务' })).toHaveAttribute('href', `/child/tasks/${id(4)}`);
  expect(within(focus).getByRole('link', { name: '我需要帮助' })).toHaveAttribute('href', `/child/tasks/${id(4)}#task-independent-help`);
  expect(screen.getByRole('link', { name: /合成任务5/ })).toHaveTextContent('等待家长确认');
  expect(screen.getByRole('link', { name: /合成任务6/ })).toHaveTextContent('已确认');
  expect(screen.queryByRole('link', { name: /合成任务7/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '选择任务 合成任务5' })).not.toBeInTheDocument();
});

test('child home does not invent a next task when all tasks have been submitted', async () => {
  saveChildSession({ token: 'synthetic-only', child: { childId: id(2), familyId: id(1), name: '合成孩子' } });
  childApi.listOwnTasks.mockResolvedValue({ items: [task(3, 'completed')] });
  renderPage(<ChildTodayPage />);
  expect(await screen.findByText('等待家长确认')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '接下来可以做' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '我需要帮助' })).not.toBeInTheDocument();
});

test('parent navigation preserves every configured entry including learning packages', () => {
  renderPage(<FamilyShell />);
  const navigation = screen.getByRole('navigation', { name: '家长导航' });
  for (const item of PARENT_NAV_ITEMS) {
    expect(within(navigation).getByRole('link', { name: item.label })).toHaveAttribute('href', item.path);
  }
  expect(within(navigation).getByRole('link', { name: '学习包' })).toHaveAttribute('href', '/app/learning');
});

test('child home preserves weekly reflection and learning package entry points', async () => {
  saveChildSession({ token: 'synthetic-only', child: { childId: id(2), familyId: id(1), name: '合成孩子' } });
  childApi.listOwnTasks.mockResolvedValue({ items: [] });
  renderPage(<ChildTodayPage />);
  expect(await screen.findByRole('link', { name: /本周反思/ })).toHaveAttribute('href', '/child/reflection');
  expect(screen.getByRole('link', { name: '我的学习包' })).toHaveAttribute('href', '/child/learning');
});
