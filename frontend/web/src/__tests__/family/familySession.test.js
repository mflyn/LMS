import {
  CHILD_SESSION_KEY,
  PARENT_SESSION_KEY,
  clearParentSession,
  loadParentSession,
  saveParentSession
} from '../../services/familySession';

describe('family parent session storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('restores only the versioned parent session key', () => {
    localStorage.setItem('token', 'legacy-token');
    localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify({ token: 'child-token' }));

    expect(loadParentSession()).toBeNull();

    saveParentSession({
      token: 'parent-token',
      user: { id: 'parent-a', name: '小明妈妈', role: 'parent', email: 'parent@example.com' }
    });

    expect(loadParentSession()).toEqual({
      token: 'parent-token',
      user: { id: 'parent-a', name: '小明妈妈', role: 'parent' }
    });
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toContain('parent-token');
  });

  test('removes malformed or non-parent saved sessions', () => {
    localStorage.setItem(PARENT_SESSION_KEY, '{not-json');
    expect(loadParentSession()).toBeNull();

    localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
      token: 'student-token',
      user: { id: 'child-a', role: 'student' }
    }));
    expect(loadParentSession()).toBeNull();

    clearParentSession();
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBeNull();
  });
});
