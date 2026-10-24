import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  clearParentSession,
  captureSession,
  expireParentSession,
  loadParentSession,
  PARENT_SESSION_EXPIRED_EVENT,
  saveParentSession,
  subscribeSessionChanges
} from '../services/familySession';

const AuthContext = createContext(null);

const authPayload = (response) => response?.data?.data || response?.data;

const createParentSession = (payload) => {
  if (!payload?.token || payload?.user?.role !== 'parent') return null;

  return {
    token: payload.token,
    user: {
      id: payload.user.id,
      name: payload.user.name,
      role: 'parent'
    }
  };
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(loadParentSession);
  const [error, setError] = useState(null);
  const attempt = useRef(0);
  const observedSession = useRef(captureSession('parent'));

  const acceptParentSession = useCallback((payload) => {
    const nextSession = createParentSession(payload);
    if (!nextSession) {
      clearParentSession();
      setSession(null);
      setError('该账号不能进入家长端');
      return false;
    }

    setSession(saveParentSession(nextSession));
    setError(null);
    return true;
  }, []);

  const login = useCallback(async (username, password) => {
    const version = ++attempt.current, initial = captureSession('parent');
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      if (version !== attempt.current || captureSession('parent') !== initial) return false;
      return acceptParentSession(authPayload(response));
    } catch (requestError) {
      if (version !== attempt.current || captureSession('parent') !== initial) return false;
      setError(requestError?.response?.data?.error?.message || '登录失败，请检查账号和密码');
      return false;
    }
  }, [acceptParentSession]);

  const register = useCallback(async (registration) => {
    const version = ++attempt.current, initial = captureSession('parent');
    try {
      const response = await axios.post('/api/auth/register', {
        ...registration,
        role: 'parent'
      });
      if (version !== attempt.current || captureSession('parent') !== initial) return false;
      return acceptParentSession(authPayload(response));
    } catch (requestError) {
      if (version !== attempt.current || captureSession('parent') !== initial) return false;
      setError(requestError?.response?.data?.error?.message || '注册失败，请稍后再试');
      return false;
    }
  }, [acceptParentSession]);

  const logout = useCallback(() => {
    attempt.current += 1;
    clearParentSession();
    setSession(null);
    setError(null);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSessionChanges(event => {
      if (event.role !== 'parent') return;
      const next = captureSession('parent');
      if (event.reason === 'external_change' && next === observedSession.current) return;
      observedSession.current = next;
      attempt.current += 1;
      setSession(loadParentSession());
      setError(event.reason === 'expired' ? '会话已过期，请重新登录。' : null);
    });
    const expired = event => { if (!event.detail?.handled) expireParentSession(); };
    setSession(loadParentSession());
    window.addEventListener(PARENT_SESSION_EXPIRED_EVENT, expired);
    return () => {
      attempt.current += 1;
      unsubscribe();
      window.removeEventListener(PARENT_SESSION_EXPIRED_EVENT, expired);
    };
  }, []);

  const value = useMemo(() => ({
    status: session ? 'authenticated' : 'anonymous',
    user: session?.user || null,
    token: session?.token || null,
    sessionSnapshot: session ? captureSession('parent') : null,
    error,
    login,
    register,
    logout,
    currentUser: session?.user || null,
    userRole: session?.user?.role || null,
    isAuthenticated: Boolean(session),
    loading: false
  }), [session, error, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
