import { useCallback, useEffect, useRef, useState } from 'react';

const emptyState = (initialData = null) => ({
  state: initialData === null || (Array.isArray(initialData) && initialData.length === 0) ? 'empty' : 'ready',
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

export const useChildDataResource = ({ load, enabled = true, initialData = null }) => {
  const [resource, setResource] = useState(() => (
    enabled ? loadingState(initialData) : emptyState(initialData)
  ));
  const [reloadVersion, setReloadVersion] = useState(0);
  const activeRequestRef = useRef(null);
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;

  useEffect(() => {
    if (!enabled) {
      setResource(emptyState(initialDataRef.current));
      return undefined;
    }

    const controller = new AbortController();
    const request = { controller };
    activeRequestRef.current = request;
    setResource(loadingState(initialDataRef.current));

    Promise.resolve(load({ signal: controller.signal }))
      .then((result) => {
        if (activeRequestRef.current !== request || controller.signal.aborted) return;

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
  }, [enabled, load, reloadVersion]);

  const reload = useCallback(() => {
    setReloadVersion((version) => version + 1);
  }, []);

  return { ...resource, reload };
};
