import { useCallback, useEffect, useRef, useState } from 'react';

const isEmpty = (data) => data === null
  || data === undefined
  || (Array.isArray(data) && data.length === 0)
  || (Array.isArray(data?.items) && data.items.length === 0);

const emptyState = (initialData = null, isInitialDataEmpty = isEmpty) => ({
  state: isInitialDataEmpty(initialData) ? 'empty' : 'ready',
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

const isAbortError = (error) => error?.name === 'AbortError' || error?.code === 'ERR_CANCELED';

const isRetryableError = (error) => {
  const status = error?.response?.status;
  return status === undefined || status === 408 || status === 429 || status >= 500;
};

const alwaysCurrent = () => true;

export const useAsyncResource = ({
  load,
  enabled = true,
  initialData = null,
  initiallyLoading = enabled,
  isInitialDataEmpty = isEmpty,
  isCurrentRequest = alwaysCurrent,
  subscribeReset = null
}) => {
  const [resource, setResource] = useState(() => (
    initiallyLoading ? loadingState(initialData) : emptyState(initialData, isInitialDataEmpty)
  ));
  const [reloadVersion, setReloadVersion] = useState(0);
  const activeRequestRef = useRef(null);
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;

  useEffect(() => {
    if (!subscribeReset) return undefined;

    return subscribeReset(() => {
      const activeRequest = activeRequestRef.current;
      if (activeRequest) {
        activeRequest.controller.abort();
        activeRequestRef.current = null;
      }
      setResource(loadingState(initialDataRef.current));
    });
  }, [subscribeReset]);

  useEffect(() => {
    if (!enabled) {
      setResource(emptyState(initialDataRef.current, isInitialDataEmpty));
      return undefined;
    }

    const controller = new AbortController();
    const request = { controller };
    activeRequestRef.current = request;
    setResource(loadingState(initialDataRef.current));

    Promise.resolve(load({ signal: controller.signal }))
      .then((result) => {
        if (
          activeRequestRef.current !== request
          || controller.signal.aborted
          || !isCurrentRequest(request)
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
        if (
          activeRequestRef.current !== request
          || controller.signal.aborted
          || !isCurrentRequest(request)
          || isAbortError(error)
        ) return;

        setResource({
          ...emptyState(initialDataRef.current, isInitialDataEmpty),
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
  }, [enabled, isCurrentRequest, isInitialDataEmpty, load, reloadVersion]);

  const reload = useCallback(() => {
    setReloadVersion((version) => version + 1);
  }, []);

  return { ...resource, reload };
};
