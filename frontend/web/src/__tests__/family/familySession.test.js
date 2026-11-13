import {
  CHILD_SESSION_KEY,
  PARENT_SESSION_KEY,
  clearParentSession,
  clearChildSession,
  loadParentSession,
  saveChildSession,
  saveParentSession
} from '../../services/familySession';

describe('family parent session storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('restores only the versioned parent session key', () => {
    localStorage.setItem('token', 'legacy-token');
    sessionStorage.setItem(CHILD_SESSION_KEY, JSON.stringify({ token: 'child-token' }));

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

describe('AI2 canonical command exit cleanup', () => {
  const actor = 'a'.repeat(24), family = 'b'.repeat(24), child = 'c'.repeat(24);
  const prefix = 'family-growth.ai2-command.v1:';
  const key = (role, id, childId = child) => prefix + JSON.stringify([role, id, family, childId]);
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  test.each(['parent', 'student'])('%s logout clears corrupt owned bodies without trusting their contents', role => {
    saveParentSession({ token: 'synthetic-parent', user: { id: actor, role: 'parent' } });
    saveChildSession({ token: 'synthetic-child', child: { childId: child, familyId: family, name: 'Synthetic' } });
    const owned = key(role, role === 'parent' ? actor : child);
    const opposite = key(role === 'parent' ? 'student' : 'parent', role === 'parent' ? child : actor);
    const other = key(role, 'd'.repeat(24), role === 'student' ? 'd'.repeat(24) : child);
    for (const k of [owned, opposite, other, `${owned} `, 'unrelated']) sessionStorage.setItem(k, '{broken');
    (role === 'parent' ? clearParentSession : clearChildSession)();
    expect(sessionStorage.getItem(owned)).toBeNull();
    for (const k of [opposite, other, `${owned} `, 'unrelated']) expect(sessionStorage.getItem(k)).toBe('{broken');
  });

  test.each(['parent', 'student'].flatMap(role => ['switch', 'storage', 'pageshow'].flatMap(reason =>
    ['{broken', JSON.stringify({ role: 'forged', actorId: 'd'.repeat(24) })].map(raw => [role, reason, raw]))))(
    '%s %s clears owned corrupt entries even when their body claims another actor: %s', (role, reason, raw) => {
      const id = role === 'parent' ? actor : child, replacement = 'd'.repeat(24);
      const save = next => role === 'parent'
        ? saveParentSession({ token: 'synthetic-parent', user: { id: next, role: 'parent' } })
        : saveChildSession({ token: 'synthetic-child', child: { childId: next, familyId: family, name: 'Synthetic' } });
      save(id);
      const owned = key(role, id), other = key(role, replacement, role === 'student' ? replacement : child);
      const otherRole = key(role === 'parent' ? 'student' : 'parent', id, id);
      for (const k of [owned, other, otherRole]) sessionStorage.setItem(k, raw);
      if (reason === 'switch') save(replacement);
      else {
        localStorage.setItem(`family-growth.session-exit.v1:${role}:${id}`,
          JSON.stringify({ revision: 'synthetic-cross-tab-exit', reason: 'explicit_logout' }));
        if (reason === 'storage') window.dispatchEvent(new StorageEvent('storage', {
          key: `family-growth.session-exit.v1:${role}:${id}`, storageArea: localStorage
        }));
        else window.dispatchEvent(new Event('pageshow'));
      }
      expect(sessionStorage.getItem(owned)).toBeNull();
      for (const k of [other, otherRole]) expect(sessionStorage.getItem(k)).toBe(raw);
    });
});
