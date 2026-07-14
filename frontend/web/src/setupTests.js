import '@testing-library/jest-dom';

const formatConsoleValue = (value) => {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
};

let consoleErrorGuard;
let consoleWarnGuard;

beforeEach(() => {
  consoleErrorGuard = jest.spyOn(console, 'error').mockImplementation((...values) => {
    throw new Error(`Unexpected console.error: ${values.map(formatConsoleValue).join(' ')}`);
  });
  consoleWarnGuard = jest.spyOn(console, 'warn').mockImplementation((...values) => {
    throw new Error(`Unexpected console.warn: ${values.map(formatConsoleValue).join(' ')}`);
  });
});

afterEach(() => {
  consoleErrorGuard.mockRestore();
  consoleWarnGuard.mockRestore();
});

jest.mock('axios', () => {
  const client = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } }
  };

  return {
    __esModule: true,
    default: client,
    ...client
  };
});

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

const createMatchMedia = () => ({
  matches: false,
  media: '',
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return false;
  }
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: window.matchMedia || createMatchMedia
});

window.ResizeObserver = window.ResizeObserver || ResizeObserverMock;
window.scrollTo = window.scrollTo || (() => {});
