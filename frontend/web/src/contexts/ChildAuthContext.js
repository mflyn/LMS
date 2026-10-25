import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { childPinLogin } from '../services/childApi';
import {
  CHILD_SESSION_EXPIRED_EVENT,
  clearChildSession,
  captureSession,
  expireChildSession,
  loadChildSession,
  saveChildSession,
  subscribeSessionChanges
} from '../services/familySession';

const ChildAuthContext = createContext(null);

const loginErrorMessage = (error) => {
  const status = error?.response?.status;
  const code = error?.response?.data?.error?.code;
  if (status === 401 || code === 'INVALID_CHILD_CREDENTIALS') {
    return '家庭、孩子或 PIN 不正确。';
  }
  if (status === 429 || code === 'PIN_LOGIN_RATE_LIMITED') {
    return '尝试次数过多，请稍后再试。';
  }
  return '暂时无法登录，请稍后重试。';
};

export const ChildAuthProvider = ({ children }) => {
  const [session, setSession] = useState(loadChildSession);
  const [error, setError] = useState(null);
  const attempt = useRef(0);
  const observedSession = useRef(captureSession('student'));

  const login = useCallback(async (credentials) => {
    const version = ++attempt.current, initial = captureSession('student');
    try {
      const payload = await childPinLogin(credentials);
      if (version !== attempt.current || captureSession('student') !== initial) return false;
      const nextSession = saveChildSession(payload);
      setSession(nextSession);
      setError(null);
      return true;
    } catch (requestError) {
      if (version !== attempt.current || captureSession('student') !== initial) return false;
      setError(loginErrorMessage(requestError));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    attempt.current += 1;
    clearChildSession();
    setSession(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const unsubscribe = subscribeSessionChanges(event => {
      if (event.role !== 'student') return;
      const next = captureSession('student');
      if (event.reason === 'external_change' && next === observedSession.current) return;
      observedSession.current = next;
      attempt.current += 1;
      setSession(loadChildSession());
      setError(event.reason === 'expired' ? '会话已过期，请重新登录。' : null);
    });
    const handleExpiredSession = event => { if (!event.detail?.handled) expireChildSession(); };
    setSession(loadChildSession());
    window.addEventListener(CHILD_SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => {
      attempt.current += 1;
      unsubscribe();
      window.removeEventListener(CHILD_SESSION_EXPIRED_EVENT, handleExpiredSession);
    };
  }, []);

  const value = useMemo(() => ({
    status: session ? 'authenticated' : 'anonymous',
    child: session?.child || null,
    token: session?.token || null,
    sessionSnapshot: session ? captureSession('student') : null,
    error,
    login,
    logout,
    clearError
  }), [clearError, error, login, logout, session]);

  return <ChildAuthContext.Provider value={value}>{children}</ChildAuthContext.Provider>;
};

export const useChildAuth = () => {
  const context = useContext(ChildAuthContext);
  if (!context) throw new Error('useChildAuth must be used within ChildAuthProvider');
  return context;
};
