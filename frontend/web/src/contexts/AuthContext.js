import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  clearParentSession,
  loadParentSession,
  PARENT_SESSION_EXPIRED_EVENT,
  saveParentSession
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
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      return acceptParentSession(authPayload(response));
    } catch (requestError) {
      clearParentSession();
      setSession(null);
      setError(requestError?.response?.data?.error?.message || '登录失败，请检查账号和密码');
      return false;
    }
  }, [acceptParentSession]);

  const register = useCallback(async (registration) => {
    try {
      const response = await axios.post('/api/auth/register', {
        ...registration,
        role: 'parent'
      });
      return acceptParentSession(authPayload(response));
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || '注册失败，请稍后再试');
      return false;
    }
  }, [acceptParentSession]);

  const logout = useCallback(() => {
    clearParentSession();
    setSession(null);
    setError(null);
  }, []);

  useEffect(() => {
    window.addEventListener(PARENT_SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(PARENT_SESSION_EXPIRED_EVENT, logout);
  }, [logout]);

  const value = useMemo(() => ({
    status: session ? 'authenticated' : 'anonymous',
    user: session?.user || null,
    token: session?.token || null,
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
