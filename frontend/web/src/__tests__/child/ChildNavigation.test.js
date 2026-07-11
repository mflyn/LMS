import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import App from '../../App';
import ChildRoute from '../../components/child/ChildRoute';
import { ChildAuthProvider, useChildAuth } from '../../contexts/ChildAuthContext';
import { getMyFamily } from '../../services/familyApi';
import {
  CHILD_SESSION_KEY,
  PARENT_SESSION_KEY,
  saveChildSession
} from '../../services/familySession';

jest.mock('../../services/childApi', () => ({ childPinLogin: jest.fn() }));
jest.mock('../../services/familyApi', () => ({
  getMyFamily: jest.fn(),
  createFamily: jest.fn(),
  getNotificationSettings: jest.fn(),
  getWeeklyReport: jest.fn(),
  listFamilyReminders: jest.fn(),
  listGrowthLogs: jest.fn(),
  listGrowthTasks: jest.fn(),
  listMistakes: jest.fn(),
  listRewards: jest.fn()
}));

const childSession = {
  token: 'child-token',
  child: { childId: 'child-a1', familyId: 'family-a', name: '小雨' }
};

const openRoute = (path) => {
  window.history.pushState({}, 'route', path);
  return render(<App />);
};

const LoginStateProbe = () => {
  const location = useLocation();
  return <output>{location.state?.from?.pathname || 'none'}</output>;
};

const LogoutProbe = () => {
  const { child, logout, status } = useChildAuth();
  return (
    <div>
      <output>{status}:{child?.name || 'none'}</output>
      <button type="button" onClick={logout}>退出孩子端</button>
    </div>
  );
};

describe('child authentication and route isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('redirects an unauthenticated child route and preserves its intended destination', () => {
    render(
      <ChildAuthProvider>
        <MemoryRouter
          initialEntries={['/child/tasks/task-a1']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route element={<ChildRoute />}>
              <Route path="/child/tasks/:taskId" element={<h1>任务详情</h1>} />
            </Route>
            <Route path="/child/login" element={<LoginStateProbe />} />
          </Routes>
        </MemoryRouter>
      </ChildAuthProvider>
    );

    expect(screen.getByText('/child/tasks/task-a1')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '任务详情' })).not.toBeInTheDocument();
  });

  test('restores a valid child session after remount and renders only child navigation', async () => {
    saveChildSession(childSession);
    const first = openRoute('/child/today');

    expect(await screen.findByText('小雨')).toBeInTheDocument();
    expect(getMyFamily).not.toHaveBeenCalled();
    first.unmount();

    const second = openRoute('/child/today');
    expect(await screen.findByRole('navigation', { name: '孩子导航' })).toBeInTheDocument();
    for (const [label, href] of [
      ['今天', '/child/today'],
      ['错题', '/child/mistakes'],
      ['成就', '/child/achievements'],
      ['我的', '/child/me']
    ]) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    expect(screen.queryByText('星星与奖励')).not.toBeInTheDocument();
    second.unmount();
  });

  test('does not accept a parent-only session on a protected child route', async () => {
    localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
      token: 'parent-token',
      user: { id: 'parent-a', name: '小雨妈妈', role: 'parent' }
    }));

    openRoute('/child/today');

    expect(await screen.findByRole('heading', { name: '孩子登录' })).toBeInTheDocument();
  });

  test('does not accept a child-only session on a protected parent route', async () => {
    saveChildSession(childSession);

    openRoute('/app/today');

    expect(await screen.findByRole('heading', { name: '家长登录' })).toBeInTheDocument();
  });

  test('logout clears only the child session', () => {
    saveChildSession(childSession);
    const parentSnapshot = JSON.stringify({ token: 'parent-token' });
    localStorage.setItem(PARENT_SESSION_KEY, parentSnapshot);

    render(<ChildAuthProvider><LogoutProbe /></ChildAuthProvider>);
    expect(screen.getByText('authenticated:小雨')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '退出孩子端' }));

    expect(screen.getByText('anonymous:none')).toBeInTheDocument();
    expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(parentSnapshot);
  });
});
