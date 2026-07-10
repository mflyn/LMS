const resetListeners = new Set();

export const registerChildScopeReset = (listener) => {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
};

export const resetChildScope = ({ previousChildId, nextChildId }) => {
  resetListeners.forEach((listener) => listener({ previousChildId, nextChildId }));
};
