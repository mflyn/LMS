import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import App from '../../App';
import {
  acceptParentInvitation,
  getMyFamily,
  previewParentInvitation
} from '../../services/familyApi';
import { PARENT_SESSION_KEY } from '../../services/familySession';

jest.mock('../../services/familyApi', () => ({
  acceptParentInvitation: jest.fn(),
  getActiveParentInvitation: jest.fn().mockResolvedValue({ invitation: null }),
  getMyFamily: jest.fn(),
  previewParentInvitation: jest.fn()
}));

describe('Task 12 invitation authentication return', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    window.history.pushState({}, 'invitation', '/family/invitations#token=fragment-secret');
  });

  const expectPreviewReady = async () => expect(await screen.findByText('明明的家')).toBeInTheDocument();

  test.each([false, true])('TC-T12-UI-003 preserves fragment through login and clears it after acceptance (delayed preview=%s)', async delayed => {
    axios.post.mockResolvedValueOnce({
      data: { data: { token: 'parent-token', user: { id: 'parent-b', name: '第二家长', role: 'parent' } } }
    });
    const preview = {
      invitation: {
        familyName: '明明的家',
        owner: { name: '明明妈妈' },
        expiresAt: '2026-07-19T08:00:00.000Z'
      }
    };
    let releasePreview;
    previewParentInvitation.mockImplementation(() => delayed
      ? new Promise(resolve => { releasePreview = () => resolve(preview); }) : Promise.resolve(preview));
    acceptParentInvitation.mockResolvedValue({ family: { familyId: 'family-a' } });
    getMyFamily.mockResolvedValue({
      family: {
        familyId: 'family-a',
        familyName: '明明的家',
        ownerParentId: 'parent-a',
        parents: [
          { parentId: 'parent-a', name: '明明妈妈', familyRole: 'mother', isOwner: true },
          { parentId: 'parent-b', name: '第二家长', familyRole: 'guardian', isOwner: false }
        ]
      },
      children: []
    });

    render(<App />);
    expect(await screen.findByRole('heading', { name: '家长登录' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'parent-b' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByRole('heading', { name: '加入家庭' })).toBeInTheDocument();
    expect(previewParentInvitation).toHaveBeenCalledWith('fragment-secret');
    if (delayed) {
      expect(screen.getByText('正在核验邀请…')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '接受邀请' })).not.toBeInTheDocument();
      let settled = false;
      const ready = expectPreviewReady().then(() => { settled = true; });
      await Promise.resolve();
      expect(settled).toBe(false);
      await act(async () => releasePreview());
      await ready;
    } else await expectPreviewReady();

    fireEvent.change(screen.getByLabelText('家庭身份'), { target: { value: 'guardian' } });
    fireEvent.click(screen.getByRole('button', { name: '接受邀请' }));

    await waitFor(() => expect(acceptParentInvitation).toHaveBeenCalledWith('fragment-secret', 'guardian'));
    await waitFor(() => expect(window.location.pathname).toBe('/app/family-members'));
    expect(window.location.hash).toBe('');
    expect(localStorage.getItem(PARENT_SESSION_KEY)).not.toContain('fragment-secret');
  });

  test('TC-T12-UI-007 carries the invitation return through the registration link', async () => {
    render(<App />);

    const registration = await screen.findByRole('link', { name: '注册家长账号' });
    fireEvent.click(registration);

    expect(await screen.findByRole('heading', { name: '注册家长账号' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/register');
    expect(JSON.stringify(window.history.state)).toContain('#token=fragment-secret');
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBeNull();
  });
});
