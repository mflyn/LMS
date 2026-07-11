import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { childPinLogin, listOwnReminders, listOwnTasks } from '../../services/childApi';
import { CHILD_SESSION_KEY } from '../../services/familySession';

jest.mock('../../services/childApi', () => ({
  childPinLogin: jest.fn(),
  listOwnReminders: jest.fn(),
  listOwnTasks: jest.fn()
}));

const openLogin = () => {
  window.history.pushState({}, 'route', '/child/login');
  return render(<App />);
};

const fillLogin = ({ familyId = 'family-a', childId = 'child-a1', pin = '1234' } = {}) => {
  fireEvent.change(screen.getByLabelText('家庭 ID'), { target: { value: familyId } });
  fireEvent.change(screen.getByLabelText('孩子 ID'), { target: { value: childId } });
  fireEvent.change(screen.getByLabelText('PIN'), { target: { value: pin } });
};

describe('child PIN login', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    listOwnTasks.mockResolvedValue({ items: [], total: 0 });
    listOwnReminders.mockResolvedValue({ items: [], meta: { partial: false, unavailableSources: [] } });
  });

  test('validates a numeric 4-to-6 digit PIN before calling the server', () => {
    openLogin();
    fillLogin({ pin: '12a' });

    fireEvent.click(screen.getByRole('button', { name: '进入我的成长空间' }));

    expect(screen.getByRole('alert')).toHaveTextContent('PIN 需要填写 4 到 6 位数字。');
    expect(childPinLogin).not.toHaveBeenCalled();
    expect(screen.getByLabelText('PIN')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText('PIN')).toHaveAttribute('pattern', '[0-9]{4,6}');
  });

  test('stores a child-only session, clears the PIN, and replaces the route after success', async () => {
    childPinLogin.mockResolvedValueOnce({
      token: 'child-token',
      child: { childId: 'child-a1', familyId: 'family-a', name: '小雨', pin: 'must-strip' }
    });
    openLogin();
    fillLogin();

    fireEvent.click(screen.getByRole('button', { name: '进入我的成长空间' }));

    expect(await screen.findByRole('heading', { name: '今天' })).toBeInTheDocument();
    expect(childPinLogin).toHaveBeenCalledWith({ familyId: 'family-a', childId: 'child-a1', pin: '1234' });
    const stored = JSON.parse(localStorage.getItem(CHILD_SESSION_KEY));
    expect(stored).toEqual({
      token: 'child-token',
      child: { childId: 'child-a1', familyId: 'family-a', name: '小雨' }
    });
    expect(localStorage.getItem(CHILD_SESSION_KEY)).not.toContain('1234');
    expect(window.location.pathname).toBe('/child/today');
  });

  test.each([
    [{ response: { status: 401, data: { error: { code: 'INVALID_CHILD_CREDENTIALS' } } } }, '家庭、孩子或 PIN 不正确。'],
    [{ response: { status: 429, data: { error: { code: 'PIN_LOGIN_RATE_LIMITED' } } } }, '尝试次数过多，请稍后再试。'],
    [new Error('network unavailable'), '暂时无法登录，请稍后重试。']
  ])('renders a safe server error and clears only the PIN', async (error, message) => {
    childPinLogin.mockRejectedValueOnce(error);
    openLogin();
    fillLogin();

    fireEvent.click(screen.getByRole('button', { name: '进入我的成长空间' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('家庭 ID')).toHaveValue('family-a');
    expect(screen.getByLabelText('孩子 ID')).toHaveValue('child-a1');
    expect(screen.getByLabelText('PIN')).toHaveValue('');
    expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
  });

  test('disables submission while login is in flight', async () => {
    let resolveLogin;
    childPinLogin.mockImplementationOnce(() => new Promise((resolve) => { resolveLogin = resolve; }));
    openLogin();
    fillLogin();

    const submit = screen.getByRole('button', { name: '进入我的成长空间' });
    fireEvent.click(submit);

    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(childPinLogin).toHaveBeenCalledTimes(1);

    resolveLogin({ token: 'child-token', child: { childId: 'child-a1', familyId: 'family-a', name: '小雨' } });
    await waitFor(() => expect(window.location.pathname).toBe('/child/today'));
  });
});
