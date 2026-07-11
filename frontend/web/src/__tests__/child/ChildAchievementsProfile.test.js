import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { getOwnProfile, listOwnRewards, listOwnTasks } from '../../services/childApi';
import {
  CHILD_SESSION_EXPIRED_EVENT,
  CHILD_SESSION_KEY,
  PARENT_SESSION_KEY,
  saveChildSession
} from '../../services/familySession';

jest.mock('../../services/childApi', () => ({
  childPinLogin: jest.fn(),
  getOwnProfile: jest.fn(),
  listOwnRewards: jest.fn(),
  listOwnTasks: jest.fn()
}));

const session = {
  token: 'child-token',
  child: { childId: 'child-a1', familyId: 'family-a', name: '小雨' }
};

const openRoute = (path) => {
  saveChildSession(session);
  window.history.pushState({}, 'route', path);
  return render(<App />);
};

describe('child achievements', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    listOwnRewards.mockResolvedValue({
      starBalance: 7,
      rewards: { items: [{ rewardId: 'reward-a1', title: '周末骑行', requiredStars: 10, status: 'active' }] },
      ledger: { items: [
        { ledgerEntryId: 'ledger-a1', type: 'earn', amount: 3, sourceType: 'task_confirmation' },
        { ledgerEntryId: 'ledger-a2', type: 'spend', amount: 2, sourceType: 'reward_redemption' }
      ] }
    });
    listOwnTasks.mockResolvedValue({
      items: [{ taskId: 'task-a1', title: '完成一周晨跑', status: 'confirmed' }],
      total: 1
    });
  });

  test('renders balance, immutable ledger, read-only rewards, and confirmed tasks', async () => {
    openRoute('/child/achievements');

    expect(await screen.findByRole('heading', { name: '成就' })).toBeInTheDocument();
    expect(await screen.findByText('周末骑行')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('完成一周晨跑')).toBeInTheDocument();
    expect(listOwnRewards).toHaveBeenCalledWith(
      { rewardPageSize: 100, ledgerPageSize: 100 },
      expect.any(AbortSignal)
    );
    expect(listOwnTasks).toHaveBeenCalledWith(
      { status: 'confirmed', pageSize: 100 },
      expect.any(AbortSignal)
    );
    expect(screen.queryByRole('button', { name: /兑换|确认|新建奖励/ })).not.toBeInTheDocument();
  });

  test('keeps confirmed tasks visible when rewards fail', async () => {
    listOwnRewards.mockRejectedValueOnce({ response: { status: 503 } });
    openRoute('/child/achievements');

    expect(await screen.findByText('完成一周晨跑')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '星星与奖励加载失败' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载数据' })).toBeInTheDocument();
  });

  test('keeps rewards visible when confirmed tasks have a stable failure', async () => {
    listOwnTasks.mockRejectedValueOnce({
      response: { status: 403, data: { error: { message: '无权查看任务' } } }
    });
    openRoute('/child/achievements');

    expect(await screen.findByText('周末骑行')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '已确认任务加载失败' })).toBeInTheDocument();
    expect(screen.getByText('无权查看任务')).toBeInTheDocument();
  });
});

describe('child profile and logout', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('renders the complete own-child profile', async () => {
    getOwnProfile.mockResolvedValueOnce({ child: {
      childId: 'child-a1',
      name: '小雨',
      grade: 5,
      interests: ['科普阅读'],
      weakSubjects: ['英语'],
      sportsPreferences: ['游泳'],
      artInterests: ['水彩'],
      laborHabits: ['整理书桌'],
      moralGoals: ['守时']
    } });
    openRoute('/child/me');

    expect(await screen.findByRole('heading', { name: '小雨' })).toBeInTheDocument();
    for (const value of ['5 年级', '科普阅读', '英语', '游泳', '水彩', '整理书桌', '守时']) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(getOwnProfile).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  test('uses concise empty copy for sparse optional profile fields', async () => {
    getOwnProfile.mockResolvedValueOnce({ child: { childId: 'child-a1', name: '小雨' } });
    openRoute('/child/me');

    expect(await screen.findByRole('heading', { name: '小雨' })).toBeInTheDocument();
    expect(screen.getAllByText('暂未填写').length).toBeGreaterThanOrEqual(4);
  });

  test('logout clears only child storage and replaces the login route', async () => {
    const parentSnapshot = JSON.stringify({
      token: 'parent-token',
      user: { id: 'parent-a', name: '小雨妈妈', role: 'parent' }
    });
    localStorage.setItem(PARENT_SESSION_KEY, parentSnapshot);
    getOwnProfile.mockResolvedValueOnce({ child: { childId: 'child-a1', name: '小雨' } });
    openRoute('/child/me');

    fireEvent.click(await screen.findByRole('button', { name: '退出孩子端' }));

    expect(await screen.findByRole('heading', { name: '孩子登录' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/child/login');
    expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(parentSnapshot);
  });

  test('redirects to recoverable login when the child token expires', async () => {
    getOwnProfile.mockImplementation(() => new Promise(() => {}));
    openRoute('/child/me');

    act(() => window.dispatchEvent(new Event(CHILD_SESSION_EXPIRED_EVENT)));

    expect(await screen.findByRole('heading', { name: '孩子登录' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('会话已过期，请重新登录。');
    await waitFor(() => expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull());
  });
});
