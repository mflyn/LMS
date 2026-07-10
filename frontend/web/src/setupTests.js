import '@testing-library/jest-dom';

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
