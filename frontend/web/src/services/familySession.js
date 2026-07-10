export const PARENT_SESSION_KEY = 'family-growth.parent-session.v1';
export const CHILD_SESSION_KEY = 'family-growth.child-session.v1';
export const PARENT_SESSION_EXPIRED_EVENT = 'family-growth:parent-session-expired';

const toParentSession = (value) => {
  if (!value || typeof value.token !== 'string' || !value.token.trim()) return null;
  if (!value.user || value.user.role !== 'parent') return null;

  return {
    token: value.token,
    user: {
      id: value.user.id,
      name: value.user.name,
      role: 'parent'
    }
  };
};

export const loadParentSession = () => {
  try {
    const stored = localStorage.getItem(PARENT_SESSION_KEY);
    if (!stored) return null;

    const session = toParentSession(JSON.parse(stored));
    if (!session) localStorage.removeItem(PARENT_SESSION_KEY);
    return session;
  } catch {
    localStorage.removeItem(PARENT_SESSION_KEY);
    return null;
  }
};

export const saveParentSession = (session) => {
  const parentSession = toParentSession(session);
  if (!parentSession) {
    throw new Error('Only parent sessions can be persisted in the parent session store');
  }

  localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify(parentSession));
  return parentSession;
};

export const clearParentSession = () => {
  localStorage.removeItem(PARENT_SESSION_KEY);
};

export const expireParentSession = () => {
  clearParentSession();
  window.dispatchEvent(new Event(PARENT_SESSION_EXPIRED_EVENT));
};
