import axios from 'axios';
import { createChild, setChildPin } from '../../services/familyApi';
import { PARENT_SESSION_KEY } from '../../services/familySession';

const parentConfig = {
  headers: { Authorization: 'Bearer parent-token' }
};

describe('Task 11 parent child API client', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
      token: 'parent-token',
      user: { id: 'parent-a', name: '家长', role: 'parent' }
    }));
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { success: true, data: {} } });
  });

  test('creates a child with parent authentication and strips familyId', async () => {
    await createChild({ name: ' 小明 ', grade: '三年级', familyId: 'family-a' });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/children',
      { name: ' 小明 ', grade: '三年级' },
      parentConfig
    );
  });

  test('sets a PIN through an encoded child path', async () => {
    await setChildPin('child/a 1', '2468');

    expect(axios.post).toHaveBeenCalledWith(
      '/api/children/child%2Fa%201/pin',
      { pin: '2468' },
      parentConfig
    );
  });
});
