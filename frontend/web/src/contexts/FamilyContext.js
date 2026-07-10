import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { getMyFamily } from '../services/familyApi';
import { resetChildScope } from '../services/childScope';

const FamilyContext = createContext(null);

const EMPTY_FAMILY_STATE = {
  status: 'unknown',
  family: null,
  children: [],
  selectedChildId: null,
  childScopeVersion: 0
};

const apiErrorCode = (error) => error?.response?.data?.error?.code;
const apiStatus = (error) => error?.response?.status;

export const FamilyProvider = ({ children }) => {
  const { logout, status: authStatus } = useAuth();
  const [familyState, setFamilyState] = useState(EMPTY_FAMILY_STATE);
  const familyStateRef = useRef(familyState);
  const requestVersion = useRef(0);

  familyStateRef.current = familyState;

  const loadFamily = useCallback(async () => {
    if (authStatus !== 'authenticated') {
      setFamilyState(EMPTY_FAMILY_STATE);
      return;
    }

    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setFamilyState((current) => ({ ...current, status: 'unknown' }));

    try {
      const payload = await getMyFamily();
      if (requestVersion.current !== version) return;

      const childrenForFamily = Array.isArray(payload?.children) ? payload.children : [];
      const selectedChildId = childrenForFamily.some((child) => child.childId === payload?.defaultChildId)
        ? payload.defaultChildId
        : (childrenForFamily[0]?.childId || null);

      setFamilyState((current) => ({
        status: 'ready',
        family: payload?.family || null,
        children: childrenForFamily,
        selectedChildId,
        childScopeVersion: current.childScopeVersion + 1
      }));
    } catch (error) {
      if (requestVersion.current !== version) return;

      if (apiStatus(error) === 401) {
        logout();
        setFamilyState(EMPTY_FAMILY_STATE);
        return;
      }

      if (apiStatus(error) === 404 && apiErrorCode(error) === 'RESOURCE_NOT_FOUND') {
        setFamilyState((current) => ({
          ...current,
          status: 'needs_family',
          family: null,
          children: [],
          selectedChildId: null
        }));
        return;
      }

      setFamilyState((current) => ({
        ...current,
        status: 'error',
        family: null,
        children: [],
        selectedChildId: null
      }));
    }
  }, [authStatus, logout]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  const selectChild = useCallback((childId) => {
    const current = familyStateRef.current;
    if (current.status !== 'ready' || current.selectedChildId === childId) return;
    if (!current.children.some((child) => child.childId === childId)) return;

    resetChildScope({ previousChildId: current.selectedChildId, nextChildId: childId });
    setFamilyState((latest) => ({
      ...latest,
      selectedChildId: childId,
      childScopeVersion: latest.childScopeVersion + 1
    }));
  }, []);

  const selectedChild = familyState.children.find(
    (child) => child.childId === familyState.selectedChildId
  ) || null;

  const value = useMemo(() => ({
    familyStatus: familyState.status,
    family: familyState.family,
    children: familyState.children,
    selectedChild,
    selectedChildId: familyState.selectedChildId,
    childScopeVersion: familyState.childScopeVersion,
    selectChild,
    retry: loadFamily,
    reload: loadFamily
  }), [familyState, selectedChild, selectChild, loadFamily]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
};

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within FamilyProvider');
  }
  return context;
};
