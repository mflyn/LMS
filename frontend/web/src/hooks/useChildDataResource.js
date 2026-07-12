import { useAsyncResource } from './useAsyncResource';

const isChildInitialDataEmpty = (initialData) => initialData === null
  || (Array.isArray(initialData) && initialData.length === 0);

export const useChildDataResource = ({ load, enabled = true, initialData = null }) => {
  return useAsyncResource({
    load,
    enabled,
    initialData,
    isInitialDataEmpty: isChildInitialDataEmpty
  });
};
