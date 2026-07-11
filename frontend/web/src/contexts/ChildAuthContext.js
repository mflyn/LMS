import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { childPinLogin } from '../services/childApi';
import {
  CHILD_SESSION_EXPIRED_EVENT,
  clearChildSession,
  loadChildSession,
  saveChildSession
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

  const login = useCallback(async (credentials) => {
    try {
      const payload = await childPinLogin(credentials);
      const nextSession = saveChildSession(payload);
      setSession(nextSession);
      setError(null);
      return true;
    } catch (requestError) {
      setError(loginErrorMessage(requestError));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearChildSession();
    setSession(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const handleExpiredSession = () => {
      clearChildSession();
      setSession(null);
      setError('会话已过期，请重新登录。');
    };
    window.addEventListener(CHILD_SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(CHILD_SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  const value = useMemo(() => ({
    status: session ? 'authenticated' : 'anonymous',
    child: session?.child || null,
    token: session?.token || null,
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
