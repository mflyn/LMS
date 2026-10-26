import {
  CHILD_SESSION_EXPIRED_EVENT,
  CHILD_SESSION_KEY,
  PARENT_SESSION_KEY,
  clearChildSession,
  expireChildSession,
  loadChildSession,
  saveChildSession
} from '../../services/familySession';

const childIdentity = {
  childId: 'child-a1',
  familyId: 'family-a',
  name: '小明'
};

describe('child session storage isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('saves only the validated child identity and restores it', () => {
    const parentSnapshot = JSON.stringify({ token: 'parent-token' });
    localStorage.setItem(PARENT_SESSION_KEY, parentSnapshot);

    expect(saveChildSession({
      token: 'child-token',
      child: { ...childIdentity, grade: 3, secret: 'discard-me' }
    })).toEqual({
      token: 'child-token',
      child: { ...childIdentity, grade: 3 }
    });

    expect(loadChildSession()).toEqual({
      token: 'child-token',
      child: { ...childIdentity, grade: 3 }
    });
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(parentSnapshot);
    expect(localStorage.getItem(CHILD_SESSION_KEY)).not.toContain('discard-me');
  });

  test.each([undefined, null, 0, 7, 1.5, '1', true, {}])('invalid grade %p uses the generic identity without rejecting login', grade => {
    saveChildSession({ token: 'synthetic-child', child: { ...childIdentity, grade } });
    expect(loadChildSession().child).toEqual(childIdentity);
  });

  test('new login refreshes grade and switching to an unknown-grade child never retains it', () => {
    saveChildSession({ token: 'first', child: { ...childIdentity, grade: 1 } });
    expect(loadChildSession().child.grade).toBe(1);
    saveChildSession({ token: 'renewed', child: { ...childIdentity, grade: 4 } });
    expect(loadChildSession().child.grade).toBe(4);
    saveChildSession({ token: 'other', child: { ...childIdentity, childId: 'child-b' } });
    expect(loadChildSession().child).toEqual({ ...childIdentity, childId: 'child-b' });
  });

  test.each([
    '{not-json',
    JSON.stringify({ token: '', child: childIdentity }),
    JSON.stringify({ token: 'child-token', child: null }),
    JSON.stringify({ token: 'child-token', child: { ...childIdentity, childId: '' } }),
    JSON.stringify({ token: 'child-token', child: { ...childIdentity, familyId: '' } }),
    JSON.stringify({ token: 'child-token', child: { ...childIdentity, name: '' } })
  ])('removes malformed child storage without touching parent storage', (stored) => {
    const parentSnapshot = JSON.stringify({ token: 'parent-token' });
    localStorage.setItem(PARENT_SESSION_KEY, parentSnapshot);
    localStorage.setItem(CHILD_SESSION_KEY, stored);

    expect(loadChildSession()).toBeNull();
    expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(parentSnapshot);
  });

  test('rejects invalid sessions before writing storage', () => {
    expect(() => saveChildSession({ token: 'child-token', child: { childId: 'child-a1' } }))
      .toThrow('Only child sessions can be persisted in the child session store');
    expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
  });

  test('clears only the child session', () => {
    const parentSnapshot = JSON.stringify({ token: 'parent-token' });
    localStorage.setItem(PARENT_SESSION_KEY, parentSnapshot);
    localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify({ token: 'child-token' }));

    clearChildSession();

    expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(parentSnapshot);
  });

  test('expires the child session and emits one recoverable event', () => {
    const listener = jest.fn();
    window.addEventListener(CHILD_SESSION_EXPIRED_EVENT, listener);
    localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify({ token: 'child-token' }));

    expireChildSession();

    expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(CHILD_SESSION_EXPIRED_EVENT, listener);
  });
});
