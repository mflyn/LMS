import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { getMyFamily } from '../services/familyApi';
import { resetChildScope } from '../services/childScope';
import { captureSession, expireParentSession, isSessionCurrent } from '../services/familySession';

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
  const { status: authStatus, sessionSnapshot } = useAuth();
  const [familyState, setFamilyState] = useState(EMPTY_FAMILY_STATE);
  const familyStateRef = useRef(familyState);
  const requestVersion = useRef(0);
  const owner = useRef(null);

  familyStateRef.current = familyState;

  const loadFamily = useCallback(async () => {
    const snapshot = captureSession('parent');
    const version = ++requestVersion.current;
    if (authStatus !== 'authenticated') {
      setFamilyState(EMPTY_FAMILY_STATE);
      return;
    }

    if (!snapshot) return;
    setFamilyState((current) => (
      current.status === 'ready' ? current : { ...current, status: 'unknown' }
    ));

    try {
      const payload = await getMyFamily({ session: snapshot });
      if (requestVersion.current !== version || !isSessionCurrent(snapshot)) return;

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
      if (requestVersion.current !== version || !isSessionCurrent(snapshot)) return;

      if (apiStatus(error) === 401) {
        expireParentSession(snapshot);
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
  }, [authStatus]);

  useEffect(() => {
    if (owner.current !== sessionSnapshot) {
      resetChildScope({ previousChildId: familyStateRef.current.selectedChildId, nextChildId: null });
      owner.current = sessionSnapshot;
      setFamilyState(current => ({ ...EMPTY_FAMILY_STATE, childScopeVersion: current.childScopeVersion + 1 }));
    }
    loadFamily();
    return () => { requestVersion.current += 1; };
  }, [loadFamily, sessionSnapshot]);

  const selectChild = useCallback((childId) => {
    if (!isSessionCurrent(owner.current)) return;
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

  // Hide the previous actor's data in the render before the reload effect runs.
  const visibleState = owner.current === sessionSnapshot && authStatus === 'authenticated' ? familyState : EMPTY_FAMILY_STATE;
  const selectedChild = visibleState.children.find(
    (child) => child.childId === visibleState.selectedChildId
  ) || null;

  const value = useMemo(() => ({
    familyStatus: visibleState.status,
    family: visibleState.family,
    children: visibleState.children,
    selectedChild,
    selectedChildId: visibleState.selectedChildId,
    childScopeVersion: visibleState.childScopeVersion,
    selectChild,
    retry: loadFamily,
    reload: loadFamily
  }), [visibleState, selectedChild, selectChild, loadFamily]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
};

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within FamilyProvider');
  }
  return context;
};
