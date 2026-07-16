import axios from 'axios';
import {
  acceptParentInvitation,
  createFamily,
  createParentInvitation,
  getActiveParentInvitation,
  getMyFamily,
  leaveFamily,
  previewParentInvitation,
  removeFamilyMember,
  revokeParentInvitation,
  transferFamilyOwnership
} from '../../services/familyApi';
import {
  CHILD_SESSION_KEY,
  PARENT_SESSION_EXPIRED_EVENT,
  PARENT_SESSION_KEY
} from '../../services/familySession';

describe('family API client', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('uses only the parent session token for a family request', async () => {
    localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify({ token: 'child-token' }));
    localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
      token: 'parent-token',
      user: { id: 'parent-a', name: '小明妈妈', role: 'parent' }
    }));
    axios.get.mockResolvedValueOnce({ data: { data: { family: { familyId: 'family-a' } } } });

    await expect(getMyFamily()).resolves.toEqual({ family: { familyId: 'family-a' } });
    expect(axios.get).toHaveBeenCalledWith('/api/families/me', {
      headers: { Authorization: 'Bearer parent-token' }
    });
  });

  test('rejects a family request when only a child session exists', async () => {
    localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify({ token: 'child-token' }));

    await expect(getMyFamily()).rejects.toMatchObject({ response: { status: 401 } });
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('clears and signals an expired parent session for a create request', async () => {
    localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
      token: 'expired-parent-token',
      user: { id: 'parent-a', name: '小明妈妈', role: 'parent' }
    }));
    const onExpired = jest.fn();
    window.addEventListener(PARENT_SESSION_EXPIRED_EVENT, onExpired);
    axios.post.mockRejectedValueOnce({ response: { status: 401 } });

    await expect(createFamily({ familyName: '小明的家' })).rejects.toMatchObject({ response: { status: 401 } });

    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(PARENT_SESSION_EXPIRED_EVENT, onExpired);
  });

  test('TC-T12-API-002 sends invitation secrets only in request bodies', async () => {
    localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
      token: 'parent-token',
      user: { id: 'parent-a', name: 'Parent A', role: 'parent' }
    }));
    axios.post.mockResolvedValue({ data: { data: { invitation: {} } } });

    await createParentInvitation('family-a');
    await previewParentInvitation('fragment-secret');
    await acceptParentInvitation('fragment-secret', 'guardian');

    expect(axios.post).toHaveBeenNthCalledWith(
      1,
      '/api/families/family-a/parent-invitations',
      {},
      { headers: { Authorization: 'Bearer parent-token' } }
    );
    expect(axios.post).toHaveBeenNthCalledWith(
      2,
      '/api/parent-invitations/preview',
      { token: 'fragment-secret' },
      { headers: { Authorization: 'Bearer parent-token' } }
    );
    expect(axios.post).toHaveBeenNthCalledWith(
      3,
      '/api/parent-invitations/accept',
      { token: 'fragment-secret', familyRole: 'guardian' },
      { headers: { Authorization: 'Bearer parent-token' } }
    );
    expect(JSON.stringify(axios.post.mock.calls.map(([url]) => url))).not.toContain('fragment-secret');
  });

  test('TC-T12-API-003 maps invitation and membership governance endpoints', async () => {
    localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
      token: 'parent-token',
      user: { id: 'parent-a', name: 'Parent A', role: 'parent' }
    }));
    axios.get.mockResolvedValue({ data: { data: { invitation: null } } });
    axios.patch.mockResolvedValue({ data: { data: { family: {} } } });
    axios.delete.mockResolvedValue({ status: 204 });

    await getActiveParentInvitation('family-a');
    await revokeParentInvitation('family-a', 'invite-a');
    await leaveFamily('family-a');
    await removeFamilyMember('family-a', 'parent-b');
    await transferFamilyOwnership('family-a', 'parent-b');

    const config = { headers: { Authorization: 'Bearer parent-token' } };
    expect(axios.get).toHaveBeenCalledWith('/api/families/family-a/parent-invitations/active', config);
    expect(axios.delete).toHaveBeenNthCalledWith(1, '/api/families/family-a/parent-invitations/invite-a', config);
    expect(axios.delete).toHaveBeenNthCalledWith(2, '/api/families/family-a/members/me', config);
    expect(axios.delete).toHaveBeenNthCalledWith(3, '/api/families/family-a/members/parent-b', config);
    expect(axios.patch).toHaveBeenCalledWith(
      '/api/families/family-a/owner',
      { newOwnerParentId: 'parent-b' },
      config
    );
  });
});
