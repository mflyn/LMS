const { createTask11ApiClient } = require('./apiClient');

describe('Task 11 public API client', () => {
  test('uses public auth calls and scopes protected calls to one bearer token', async () => {
    const httpClient = {
      post: jest.fn().mockResolvedValue({ status: 200, data: { success: true } }),
      get: jest.fn().mockResolvedValue({ status: 200, data: { success: true } }),
      patch: jest.fn().mockResolvedValue({ status: 200, data: { success: true } }),
      delete: jest.fn().mockResolvedValue({ status: 200, data: { success: true } })
    };
    const api = createTask11ApiClient({ httpClient });

    await api.registerParent({ email: 'parent@example.com' });
    await api.loginParent({ username: 'parent', password: 'password' });
    await api.loginChild({ familyId: 'family-a', childId: 'child-a', pin: '2468' });
    await api.asParent('parent-token').get('/api/families/me');
    await api.asChild('child-token').patch('/api/growth-tasks/task-a/complete', { actualMinutes: 20 });

    expect(httpClient.post).toHaveBeenNthCalledWith(1, '/api/auth/register', { email: 'parent@example.com' });
    expect(httpClient.post).toHaveBeenNthCalledWith(2, '/api/auth/login', { username: 'parent', password: 'password' });
    expect(httpClient.post).toHaveBeenNthCalledWith(3, '/api/auth/child-pin-login', {
      familyId: 'family-a', childId: 'child-a', pin: '2468'
    });
    expect(httpClient.get).toHaveBeenCalledWith('/api/families/me', {
      headers: { Authorization: 'Bearer parent-token' }
    });
    expect(httpClient.patch).toHaveBeenCalledWith(
      '/api/growth-tasks/task-a/complete',
      { actualMinutes: 20 },
      { headers: { Authorization: 'Bearer child-token' } }
    );
  });

  test('rethrows transport failures without request credentials or bodies', async () => {
    const httpClient = {
      get: jest.fn().mockRejectedValue(new Error('Bearer parent-secret pin=2468'))
    };
    const api = createTask11ApiClient({ httpClient });

    await expect(api.asParent('parent-secret').get('/api/families/me'))
      .rejects.toThrow('Task 11 HTTP request failed: GET /api/families/me');

    try {
      await api.asParent('parent-secret').get('/api/families/me');
    } catch (error) {
      expect(error.message).not.toContain('parent-secret');
      expect(error.message).not.toContain('2468');
    }
  });
});
