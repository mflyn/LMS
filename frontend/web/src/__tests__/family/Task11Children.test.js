import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../../App';
import { createChild, getMyFamily, setChildPin } from '../../services/familyApi';
import { PARENT_SESSION_KEY } from '../../services/familySession';

jest.mock('../../services/familyApi', () => ({
  createChild: jest.fn(),
  getMyFamily: jest.fn(),
  setChildPin: jest.fn()
}));
jest.mock('../../contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }) => children
}));

const firstChild = {
  childId: 'child-a1',
  name: '小明',
  grade: 3,
  school: '向阳小学'
};
const readyFamily = {
  family: { familyId: 'family-a', familyName: '成长之家', timezone: 'Asia/Shanghai' },
  children: [firstChild],
  defaultChildId: firstChild.childId
};

const openChildren = () => {
  localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
    token: 'parent-token',
    user: { id: 'parent-a', name: '小明妈妈', role: 'parent' }
  }));
  window.history.pushState({}, 'children', '/app/children');
  return render(<App />);
};

describe('Task 11 parent child management', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    getMyFamily.mockResolvedValue(readyFamily);
    createChild.mockResolvedValue({ child: { childId: 'child-a2', name: '小红' } });
    setChildPin.mockResolvedValue({ child: firstChild });
  });

  test('renders existing children and marks the parent navigation active', async () => {
    openChildren();

    expect(await screen.findByRole('heading', { name: '孩子' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '小明' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '孩子' })).toHaveClass('is-active');
    expect(screen.getByLabelText('当前孩子')).toHaveValue('child-a1');
    expect(screen.getByText('family-a')).toBeInTheDocument();
    expect(within(screen.getByTestId('child-row-child-a1')).getByText('child-a1')).toBeInTheDocument();
  });

  test('creates a trimmed child then reloads the family selector', async () => {
    getMyFamily
      .mockResolvedValueOnce(readyFamily)
      .mockResolvedValueOnce({
        ...readyFamily,
        children: [...readyFamily.children, { childId: 'child-a2', name: '小红', grade: 2 }]
      });
    openChildren();
    await screen.findByRole('heading', { name: '孩子' });

    fireEvent.change(screen.getByLabelText('孩子姓名'), { target: { value: '  小红  ' } });
    fireEvent.change(screen.getByLabelText('年级'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '添加孩子' }));

    await waitFor(() => {
      expect(createChild).toHaveBeenCalledWith({
        name: '小红',
        grade: 2
      });
      expect(getMyFamily).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole('option', { name: '小红' })).toBeInTheDocument();
  });

  test('keeps child fields after a server validation error', async () => {
    createChild.mockRejectedValueOnce({
      response: { data: { error: { message: '年级格式不正确' } } }
    });
    openChildren();
    await screen.findByRole('heading', { name: '孩子' });

    fireEvent.change(screen.getByLabelText('孩子姓名'), { target: { value: '小红' } });
    fireEvent.change(screen.getByLabelText('年级'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '添加孩子' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('年级格式不正确');
    expect(screen.getByLabelText('孩子姓名')).toHaveValue('小红');
    expect(screen.getByLabelText('年级')).toHaveValue('3');
  });

  test('blocks an invalid PIN and saves a valid PIN without displaying it', async () => {
    openChildren();
    const row = await screen.findByTestId('child-row-child-a1');
    const pinInput = within(row).getByLabelText('小明的 PIN');

    fireEvent.change(pinInput, { target: { value: '12ab' } });
    fireEvent.click(within(row).getByRole('button', { name: '设置 PIN' }));
    expect(await within(row).findByRole('alert')).toHaveTextContent('PIN 需为 4 到 6 位数字');
    expect(setChildPin).not.toHaveBeenCalled();

    fireEvent.change(pinInput, { target: { value: '2468' } });
    fireEvent.click(within(row).getByRole('button', { name: '设置 PIN' }));

    await waitFor(() => {
      expect(setChildPin).toHaveBeenCalledWith('child-a1', '2468');
      expect(pinInput).toHaveValue('');
      expect(within(row).getByRole('status')).toHaveTextContent('PIN 已更新');
    });
    expect(screen.queryByDisplayValue('2468')).not.toBeInTheDocument();
  });

  test('clears a failed PIN and leaves the child row retryable', async () => {
    setChildPin.mockRejectedValueOnce({
      response: { data: { error: { message: '暂时无法更新 PIN' } } }
    });
    openChildren();
    const row = await screen.findByTestId('child-row-child-a1');
    const pinInput = within(row).getByLabelText('小明的 PIN');

    fireEvent.change(pinInput, { target: { value: '2468' } });
    fireEvent.click(within(row).getByRole('button', { name: '设置 PIN' }));

    expect(await within(row).findByRole('alert')).toHaveTextContent('暂时无法更新 PIN');
    expect(pinInput).toHaveValue('');
    expect(within(row).getByRole('button', { name: '设置 PIN' })).toBeEnabled();
  });
});
