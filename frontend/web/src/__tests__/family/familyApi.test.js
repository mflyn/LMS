import axios from 'axios';
import { createFamily, getMyFamily } from '../../services/familyApi';
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
});
