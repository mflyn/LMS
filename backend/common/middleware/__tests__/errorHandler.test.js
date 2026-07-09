const mongoose = require('mongoose');
const { AppError, BadRequestError } = require('../errorTypes');
const {
  catchAsync,
  errorHandler,
  handleUncaughtException,
  handleUnhandledRejection,
  notFoundHandler,
  requestTimeout,
  requestTracker
} = require('../errorHandler');

describe('shared error middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let req;
  let res;
  let next;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    req = {
      app: { locals: { logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } } },
      get: jest.fn(),
      ip: '127.0.0.1',
      method: 'GET',
      originalUrl: '/test',
      requestId: 'request-1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn(),
      setHeader: jest.fn(),
      statusCode: 200
    };
    next = jest.fn();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('returns the approved contract for operational errors', () => {
    errorHandler(new BadRequestError('invalid input'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'invalid input', details: [] }
    });
  });

  test('preserves an explicit stable error code', () => {
    const error = new BadRequestError('stale token');
    error.statusCode = 401;
    error.code = 'STALE_CHILD_TOKEN';

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'STALE_CHILD_TOKEN', message: 'stale token', details: [] }
    });
  });

  test('does not expose non-operational error details', () => {
    errorHandler(new Error('database password leaked'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', details: [] }
    });
  });

  test('treats generic 500 AppError instances as non-operational', () => {
    errorHandler(new AppError('database password leaked', 500), req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误', details: [] }
    });
  });

  test('normalizes mongoose validation errors', () => {
    const error = new mongoose.Error.ValidationError();
    error.addError('name', new mongoose.Error.ValidatorError({ message: 'name is required' }));

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'name is required', details: [] }
    });
  });

  test('normalizes MongoDB connectivity errors to a stable unavailable contract', () => {
    const error = new Error('connection timed out to db.internal');
    error.name = 'MongoNetworkError';

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: '数据库暂时不可用', details: [] }
    });
  });

  test('requestTracker adds a request id and continues', () => {
    req.requestId = undefined;
    requestTracker(req, res, next);

    expect(req.requestId).toEqual(expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
    expect(next).toHaveBeenCalledWith();
  });

  test('requestTimeout sends one bounded timeout response when the request stalls', () => {
    const timeout = requestTimeout({ timeoutMs: 25 });
    req.setTimeout = jest.fn((ms, handler) => {
      expect(ms).toBe(25);
      req.timeoutHandler = handler;
    });
    res.setTimeout = jest.fn((ms, handler) => {
      expect(ms).toBe(25);
      res.timeoutHandler = handler;
    });
    res.headersSent = false;

    timeout(req, res, next);
    req.timeoutHandler();
    res.timeoutHandler();

    expect(next).toHaveBeenCalledWith();
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(408);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out', details: [] }
    });
  });

  test('TC-T6-MEDIA-015 request and error logs omit signed media query values', () => {
    const mediaPath = '/api/media/6656875da7f86a0012c2a111/content';
    req.originalUrl = `${mediaPath}?expires=1&nonce=secret-nonce&signature=secret-signature`;
    let finishHandler;
    res.on.mockImplementation((event, handler) => {
      if (event === 'finish') finishHandler = handler;
    });

    requestTracker(req, res, next);
    finishHandler();
    errorHandler(new BadRequestError('invalid capability'), req, res, next);

    const logger = req.app.locals.logger;
    expect(logger.info).toHaveBeenCalledWith(`请求开始: GET ${mediaPath}`, expect.objectContaining({ url: mediaPath }));
    expect(logger.info).toHaveBeenCalledWith(`请求完成: GET ${mediaPath} 200`, expect.objectContaining({ url: mediaPath }));
    expect(logger.warn).toHaveBeenCalledWith('操作错误', expect.objectContaining({ url: mediaPath }));
    expect(JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls])).not.toMatch(/secret-nonce|secret-signature/);
  });

  test('TC-T6-MEDIA-015 not-found errors omit signed media query values', () => {
    const mediaPath = '/api/media/6656875da7f86a0012c2a111/content';
    req.originalUrl = `${mediaPath}?expires=1&nonce=secret-nonce&signature=secret-signature`;

    notFoundHandler(req, res, next);

    const error = next.mock.calls[0][0];
    expect(error.message).toBe(`路由 ${mediaPath} 不存在`);
    expect(error.message).not.toMatch(/secret-nonce|secret-signature/);
  });

  test('catchAsync forwards rejected promises', async () => {
    const error = new Error('async failure');
    await catchAsync(async () => { throw error; })(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  test('uncaught exception handler logs with the supplied logger before exiting', () => {
    const logger = { error: jest.fn() };
    const processObject = { on: jest.fn(), exit: jest.fn() };
    handleUncaughtException(logger, processObject);
    const handler = processObject.on.mock.calls[0][1];
    const error = new Error('uncaught failure');

    handler(error);

    expect(processObject.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    expect(logger.error).toHaveBeenCalledWith('未捕获异常', {
      error: 'uncaught failure',
      stack: error.stack
    });
    expect(processObject.exit).toHaveBeenCalledWith(1);
  });

  test('unhandled rejection handler logs with the supplied logger before exiting', () => {
    const logger = { error: jest.fn() };
    const processObject = { on: jest.fn(), exit: jest.fn() };
    handleUnhandledRejection(logger, processObject);
    const handler = processObject.on.mock.calls[0][1];

    handler(new Error('rejected'), Promise.resolve());

    expect(processObject.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    expect(logger.error).toHaveBeenCalledWith('未处理的Promise拒绝', {
      reason: 'Error: rejected',
      promise: '[object Promise]'
    });
    expect(processObject.exit).toHaveBeenCalledWith(1);
  });
});
