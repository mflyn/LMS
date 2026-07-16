import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import {
  createParentInvitation,
  getActiveParentInvitation,
  getMyFamily,
  leaveFamily,
  removeFamilyMember,
  revokeParentInvitation,
  transferFamilyOwnership
} from '../../services/familyApi';
import { PARENT_SESSION_KEY } from '../../services/familySession';

jest.mock('../../services/familyApi', () => ({
  createParentInvitation: jest.fn(),
  getActiveParentInvitation: jest.fn(),
  getMyFamily: jest.fn(),
  leaveFamily: jest.fn(),
  removeFamilyMember: jest.fn(),
  revokeParentInvitation: jest.fn(),
  transferFamilyOwnership: jest.fn()
}));

const family = {
  familyId: 'family-a',
  familyName: '明明的家',
  timezone: 'Asia/Shanghai',
  ownerParentId: 'parent-a',
  memberParentIds: ['parent-a', 'parent-b'],
  parents: [
    { parentId: 'parent-a', name: '明明妈妈', familyRole: 'mother', isOwner: true },
    { parentId: 'parent-b', name: '明明爸爸', familyRole: 'father', isOwner: false }
  ]
};

const setSession = (id, name) => localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
  token: `token-${id}`,
  user: { id, name, role: 'parent' }
}));

const openMembers = () => {
  window.history.pushState({}, 'members', '/app/family-members');
  return render(<App />);
};

describe('Task 12 family members page', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    getMyFamily.mockResolvedValue({ family, children: [], defaultChildId: null });
    getActiveParentInvitation.mockResolvedValue({ invitation: null });
  });

  test('TC-T12-UI-001 renders two stable slots and owner governance controls', async () => {
    setSession('parent-a', '明明妈妈');
    openMembers();

    expect(await screen.findByRole('heading', { name: '家庭成员' })).toBeInTheDocument();
    expect(screen.getAllByTestId('parent-slot')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: '明明妈妈' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '明明爸爸' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移除明明爸爸' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '转移给明明爸爸' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '退出家庭' })).not.toBeInTheDocument();
  });

  test('TC-T12-UI-002 exposes a new token once and reloads only invitation metadata', async () => {
    setSession('parent-a', '明明妈妈');
    getMyFamily.mockResolvedValue({
      family: { ...family, memberParentIds: ['parent-a'], parents: [family.parents[0]] },
      children: [],
      defaultChildId: null
    });
    createParentInvitation.mockResolvedValue({
      invitation: { invitationId: 'invite-a', token: 'one-time-secret', expiresAt: '2026-07-19T08:00:00.000Z' }
    });
    revokeParentInvitation.mockResolvedValue(undefined);
    openMembers();

    fireEvent.click(await screen.findByRole('button', { name: '邀请第二家长' }));
    expect(await screen.findByDisplayValue(/#token=one-time-secret$/)).toBeInTheDocument();
    expect(localStorage.getItem(PARENT_SESSION_KEY)).not.toContain('one-time-secret');

    fireEvent.click(screen.getByRole('button', { name: '撤销邀请' }));
    await waitFor(() => expect(revokeParentInvitation).toHaveBeenCalledWith('family-a', 'invite-a'));
    await waitFor(() => expect(screen.queryByDisplayValue(/one-time-secret/)).not.toBeInTheDocument());
  });

  test('TC-T12-UI-004 gives a second parent daily access but only a leave control', async () => {
    setSession('parent-b', '明明爸爸');
    leaveFamily.mockResolvedValue(undefined);
    openMembers();

    expect(await screen.findByRole('heading', { name: '家庭成员' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出家庭' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /邀请第二家长/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /移除明明爸爸/ })).not.toBeInTheDocument();
  });

  test('TC-T12-UI-005 transfers ownership and removes a member after confirmation', async () => {
    setSession('parent-a', '明明妈妈');
    transferFamilyOwnership.mockResolvedValue({ family: { ...family, ownerParentId: 'parent-b' } });
    removeFamilyMember.mockResolvedValue(undefined);
    openMembers();

    fireEvent.click(await screen.findByRole('button', { name: '转移给明明爸爸' }));
    fireEvent.click(screen.getByRole('button', { name: '确认转移' }));
    await waitFor(() => expect(transferFamilyOwnership).toHaveBeenCalledWith('family-a', 'parent-b'));

    fireEvent.click(screen.getByRole('button', { name: '移除明明爸爸' }));
    fireEvent.click(screen.getByRole('button', { name: '确认移除' }));
    await waitFor(() => expect(removeFamilyMember).toHaveBeenCalledWith('family-a', 'parent-b'));
  });
});
