jest.mock('winston', () => {
  const mockFormatFn = jest.fn(() => jest.fn());
  const loggerObject = {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  };

  return {
    format: {
      combine: jest.fn((...fns) => fns),
      timestamp: jest.fn(() => mockFormatFn),
      errors: jest.fn(() => mockFormatFn),
      splat: jest.fn(() => mockFormatFn),
      json: jest.fn(() => mockFormatFn),
      printf: jest.fn((fn) => fn)
    },
    transports: {
      Console: jest.fn()
    },
    addColors: jest.fn(),
    createLogger: jest.fn(() => loggerObject)
  };
});

jest.mock('winston-daily-rotate-file', () => jest.fn().mockImplementation(() => ({})));

jest.setTimeout(20000);

const { performanceLogger, errorLogger } = require('../logger');

describe('logger middleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('performanceLogger', () => {
    const createResponse = () => {
      let finishHandler = null;
      return {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'finish') {
            finishHandler = handler;
          }
        }),
        triggerFinish: () => {
          if (finishHandler) {
            finishHandler();
          }
        }
      };
    };

    const createRequest = (logger) => ({
      method: 'GET',
      originalUrl: '/test',
      app: { locals: logger ? { logger } : {} },
      ip: '127.0.0.1',
      get: jest.fn(() => 'jest-test-agent')
    });

    it('使用 app.locals.logger 记录请求信息', () => {
      const mockLogger = { log: jest.fn() };
      const req = createRequest(mockLogger);
      const res = createResponse();
      const next = jest.fn();

      performanceLogger(req, res, next);

      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(next).toHaveBeenCalled();

      res.triggerFinish();

      expect(mockLogger.log).toHaveBeenCalledWith(expect.objectContaining({
        level: 'http',
        message: expect.stringContaining('GET /test 200')
      }));
    });

    it('在缺少 logger 时退回 console.log', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const req = createRequest(null);
      const res = createResponse();
      const next = jest.fn();

      performanceLogger(req, res, next);

      expect(next).toHaveBeenCalled();

      res.triggerFinish();

      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
        level: 'http',
        message: expect.stringContaining('GET /test 200')
      }));
    });
  });

  describe('errorLogger', () => {
    const baseRequest = (logger) => ({
      method: 'POST',
      originalUrl: '/error',
      ip: '127.0.0.1',
      app: { locals: logger ? { logger } : {} },
      get: jest.fn(() => 'jest-test-agent'),
      body: { foo: 'bar' },
      query: {},
      params: {}
    });

    it('使用 app.locals.logger 记录错误信息', () => {
      const mockLogger = { error: jest.fn() };
      const req = baseRequest(mockLogger);
      const res = {};
      const next = jest.fn();
      const error = new Error('boom');

      errorLogger(error, req, res, next);

      expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({
        message: 'boom',
        stack: expect.any(String),
        meta: expect.objectContaining({
          method: 'POST',
          url: '/error'
        })
      }));
      expect(next).toHaveBeenCalledWith(error);
    });

    it('在缺少 logger 时退回 console.error', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const req = baseRequest(null);
      const res = {};
      const next = jest.fn();
      const error = new Error('fallback');

      errorLogger(error, req, res, next);

      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        message: 'fallback'
      }));
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
