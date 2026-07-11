import { useCallback, useEffect, useRef, useState } from 'react';
import { useFamily } from '../contexts/FamilyContext';
import { registerChildScopeReset } from '../services/childScope';

const emptyState = (initialData = null) => ({
  state: initialData === null ? 'empty' : 'ready',
  data: initialData,
  partial: false,
  unavailableSources: [],
  error: null
});

const loadingState = (initialData = null) => ({
  state: 'loading',
  data: initialData,
  partial: false,
  unavailableSources: [],
  error: null
});

const isEmpty = (data) => data === null
  || data === undefined
  || (Array.isArray(data) && data.length === 0)
  || (Array.isArray(data?.items) && data.items.length === 0);

const isAbortError = (error) => error?.name === 'AbortError' || error?.code === 'ERR_CANCELED';
const isRetryableError = (error) => {
  const status = error?.response?.status;
  return status === undefined || status === 408 || status === 429 || status >= 500;
};

export const useChildResource = ({ load, enabled = true, initialData = null }) => {
  const { selectedChildId, childScopeVersion } = useFamily();
  const [resource, setResource] = useState(() => emptyState(initialData));
  const [reloadVersion, setReloadVersion] = useState(0);
  const activeRequestRef = useRef(null);
  const scopeRef = useRef({ selectedChildId, childScopeVersion });
  const initialDataRef = useRef(initialData);

  scopeRef.current = { selectedChildId, childScopeVersion };
  initialDataRef.current = initialData;

  useEffect(() => registerChildScopeReset(() => {
    const activeRequest = activeRequestRef.current;
    if (activeRequest) {
      activeRequest.controller.abort();
      activeRequestRef.current = null;
    }
    setResource(loadingState(initialDataRef.current));
  }), []);

  useEffect(() => {
    if (!enabled || !selectedChildId) {
      setResource(emptyState(initialDataRef.current));
      return undefined;
    }

    const controller = new AbortController();
    const request = {
      controller,
      childId: selectedChildId,
      childScopeVersion
    };
    activeRequestRef.current = request;
    setResource(loadingState(initialDataRef.current));

    Promise.resolve(load({ childId: selectedChildId, signal: controller.signal }))
      .then((result) => {
        const currentScope = scopeRef.current;
        if (
          activeRequestRef.current !== request
          || controller.signal.aborted
          || currentScope.selectedChildId !== request.childId
          || currentScope.childScopeVersion !== request.childScopeVersion
        ) return;

        const isEnvelope = result && Object.prototype.hasOwnProperty.call(result, 'data');
        const data = isEnvelope ? result.data : result;
        const partial = Boolean(result?.partial);
        setResource({
          state: partial ? 'partial' : (isEmpty(data) ? 'empty' : 'ready'),
          data,
          partial,
          unavailableSources: Array.isArray(result?.unavailableSources) ? result.unavailableSources : [],
          error: null
        });
      })
      .catch((error) => {
        const currentScope = scopeRef.current;
        if (
          activeRequestRef.current !== request
          || controller.signal.aborted
          || currentScope.selectedChildId !== request.childId
          || currentScope.childScopeVersion !== request.childScopeVersion
          || isAbortError(error)
        ) return;

        setResource({
          ...emptyState(initialDataRef.current),
          state: isRetryableError(error) ? 'retryable_error' : 'error',
          error
        });
      });

    return () => {
      if (activeRequestRef.current === request) {
        controller.abort();
        activeRequestRef.current = null;
      }
    };
  }, [childScopeVersion, enabled, load, reloadVersion, selectedChildId]);

  const reload = useCallback(() => {
    setReloadVersion((version) => version + 1);
  }, []);

  return { ...resource, reload };
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
