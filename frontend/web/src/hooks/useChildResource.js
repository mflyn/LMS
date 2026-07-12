import { useCallback, useRef } from 'react';
import { useFamily } from '../contexts/FamilyContext';
import { registerChildScopeReset } from '../services/childScope';
import { useAsyncResource } from './useAsyncResource';

const isParentInitialDataEmpty = (initialData) => initialData === null;

export const useChildResource = ({ load, enabled = true, initialData = null }) => {
  const { selectedChildId, childScopeVersion } = useFamily();
  const scopeRef = useRef({ selectedChildId, childScopeVersion });
  scopeRef.current = { selectedChildId, childScopeVersion };

  const scopedLoad = useCallback(({ signal }) => load({
    childId: selectedChildId,
    signal
  }), [load, selectedChildId]);

  const isCurrentRequest = useCallback(() => (
    scopeRef.current.selectedChildId === selectedChildId
    && scopeRef.current.childScopeVersion === childScopeVersion
  ), [childScopeVersion, selectedChildId]);

  return useAsyncResource({
    load: scopedLoad,
    enabled: enabled && Boolean(selectedChildId),
    initialData,
    initiallyLoading: false,
    isInitialDataEmpty: isParentInitialDataEmpty,
    isCurrentRequest,
    subscribeReset: registerChildScopeReset
  });
};

export const useChildMutationGuard = () => {
  const { selectedChildId, childScopeVersion } = useFamily();
  const scopeRef = useRef({ selectedChildId, childScopeVersion });
  scopeRef.current = { selectedChildId, childScopeVersion };

  const captureScope = useCallback(() => ({ ...scopeRef.current }), []);
  const isCurrentScope = useCallback((scope) => (
    scope?.selectedChildId === scopeRef.current.selectedChildId
    && scope?.childScopeVersion === scopeRef.current.childScopeVersion
  ), []);

  return { captureScope, isCurrentScope };
};
